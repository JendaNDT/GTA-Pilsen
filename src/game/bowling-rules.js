const FRAMES = 10;
const PINS = 10;

const strike = hits => hits[0] === PINS;
const spare = hits => hits.length >= 2 && !strike(hits) && hits[0] + hits[1] === PINS;
const mark = pins => pins === PINS ? 'X' : pins === 0 ? '–' : String(pins);

function symbols(hits, last) {
  return hits.map((pins, index) => {
    if (index === 1 && spare(hits)) return '/';
    if (last && index === 2 && strike(hits) && hits[1] < PINS && pins + hits[1] === PINS) return '/';
    return mark(pins);
  });
}

export class BowlingRound {
  frames = [[]];

  get index() { return this.frames.length - 1; }
  get hits() { return this.frames[this.index]; }
  get last() { return this.index === FRAMES - 1; }

  get complete() {
    const hits = this.hits;
    return this.last && (hits.length === 3 || hits.length === 2 && !strike(hits) && !spare(hits));
  }

  get freshRack() {
    const hits = this.hits;
    return !hits.length || this.last && (hits.length === 1 && strike(hits) ||
      hits.length === 2 && (spare(hits) || hits[1] === PINS));
  }

  get available() {
    const hits = this.hits;
    if (this.complete) return 0;
    if (!hits.length || strike(hits) && hits.length === 1) return PINS;
    if (hits.length === 1) return PINS - hits[0];
    return spare(hits) || hits[1] === PINS ? PINS : PINS - hits[1];
  }

  roll(pins) {
    if (this.complete || !Number.isInteger(pins) || pins < 0 || pins > this.available) return false;
    this.hits.push(pins);
    if (!this.last && (strike(this.hits) || this.hits.length === 2)) this.frames.push([]);
    return true;
  }

  get sheet() {
    const all = this.frames.flat();
    let next = 0, total = 0;
    return this.frames.map((hits, i) => {
      next += hits.length;
      const finalFrame = i === FRAMES - 1;
      let score = null;
      if (finalFrame ? this.complete : strikesResolved(hits, all.length - next)) {
        const pins = hits.reduce((sum, n) => sum + n, 0);
        const bonusRolls = finalFrame ? 0 : strike(hits) ? 2 : spare(hits) ? 1 : 0;
        total += pins + all.slice(next, next + bonusRolls).reduce((sum, n) => sum + n, 0);
        score = total;
      }
      return { marks: symbols(hits, finalFrame), score };
    });
  }

  get total() { return this.sheet.findLast(frame => frame.score !== null)?.score ?? 0; }
}

function strikesResolved(hits, nextRolls) {
  if (strike(hits)) return nextRolls >= 2;
  return hits.length === 2 && (!spare(hits) || nextRolls >= 1);
}

export function validBowlingRecord(points) {
  return Number.isInteger(points) && points >= 0 && points <= 300;
}
