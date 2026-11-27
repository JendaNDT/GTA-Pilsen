// Všechny polohy v kole jsou relativní k hrací ploše. Zásah se porovnává v pixelech.
export const SERIES_LENGTH = 10;
const TARGET_SECONDS = 5;

export class TargetRound {
  constructor(series = false) {
    this.series = series;
    this.time = this.rest = this.hits = this.attempts = 0;
  }

  get finished() { return this.series && this.attempts === SERIES_LENGTH; }

  step(dt) {
    while (dt > 0 && !this.finished) {
      const wait = Math.min(this.rest, dt);
      this.rest -= wait;
      dt -= wait;
      if (!this.series || this.time + dt < TARGET_SECONDS) {
        this.time += dt;
        return;
      }
      dt -= TARGET_SECONDS - this.time;
      this.advance(false);
    }
  }

  advance(hit) {
    this.attempts++;
    if (hit) this.hits++;
    if (hit || this.series) {
      this.time = 0;
      this.rest = .65;
    }
  }

  position() {
    const phase = this.time * .85 + (this.series ? this.attempts : this.hits) * 2.4;
    return { x: .5 + .36 * Math.sin(phase), y: .5 - .22 * Math.cos(phase * 1.4) };
  }

  attempt(dx, dy, radius) {
    if (this.rest > 0 || this.finished) return null;
    const hit = Math.hypot(dx, dy) <= radius;
    this.advance(hit);
    return hit;
  }
}

export class TargetPractice {
  constructor(game, leave) {
    const el = id => document.getElementById(id);
    this.game = game;
    this.heading = el('target-heading');
    this.attemptLabel = el('target-attempt-label');
    this.record = el('target-record');
    this.timer = el('target-timer');
    this.result = el('target-result');
    this.resultScore = el('target-score');
    this.saveMessage = el('target-save-message');
    this.retry = el('target-retry');
    this.seriesButton = el('target-series');
    this.trainingButton = el('target-training');
    this.confirm = el('target-confirm');
    this.help = el('target-help');
    this.rules = el('target-series-rules');
    this.dialog = el('targets');
    this.field = el('target-field');
    this.disc = el('target-disc');
    this.cursor = el('target-cursor');
    this.hits = el('target-hits');
    this.attempts = el('target-attempts');
    this.feedback = el('target-feedback');
    this.seriesButton.addEventListener('click', () => this.start(true));
    this.trainingButton.addEventListener('click', () => this.start());
    this.retry.addEventListener('click', () => this.saveResult());
    this.confirm.addEventListener('click', () => this.attempt());
    el('target-exit').addEventListener('click', leave);
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); leave(); });
    this.dialog.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Escape') { e.preventDefault(); leave(); return; }
      if (e.target !== this.field) return;
      const arrows = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
      if (arrows[e.code]) {
        e.preventDefault();
        const [dx, dy] = arrows[e.code];
        this.aim(this.x + dx * .025, this.y + dy * .025);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.attempt();
      }
    });
    const point = e => {
      const rect = this.field.getBoundingClientRect();
      this.aim((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    };
    this.field.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      this.field.focus({ preventScroll: true });
      point(e);
      if (e.pointerType === 'mouse') this.attempt();
      else this.field.setPointerCapture(e.pointerId);
    });
    this.field.addEventListener('pointermove', e => {
      if (e.isPrimary && (e.pointerType === 'mouse' || this.field.hasPointerCapture(e.pointerId))) point(e);
    });
  }

  start(series = false) {
    this.round = new TargetRound(series);
    this.heading.textContent = series ? 'Série deseti terčů' : 'Volný trénink';
    this.attemptLabel.textContent = series ? 'Terč' : 'Pokusy';
    this.field.hidden = this.help.hidden = this.rules.hidden = this.confirm.hidden = false;
    this.result.hidden = this.trainingButton.hidden = true;
    this.seriesButton.hidden = series;
    this.seriesButton.textContent = 'Série deseti terčů';
    this.timer.hidden = !series;
    this.updateRecord();
    this.hits.textContent = '0';
    this.attempts.textContent = series ? '1' : '0';
    this.feedback.textContent = '';
    this.show();
    this.aim(.5, .5);
    this.update(0);
  }

  show() {
    if (!this.dialog.open) this.dialog.showModal();
    (this.round.finished ? this.seriesButton : this.field).focus({ preventScroll: true });
  }

  updateRecord() {
    const best = this.game.stats.targetSeriesBest;
    this.record.textContent = best === undefined ? 'Osobní rekord: —' : `Osobní rekord: ${best} / ${SERIES_LENGTH}`;
  }

  saveResult() {
    const score = this.round.hits, { stats } = this.game;
    const better = stats.targetSeriesBest === undefined || score > stats.targetSeriesBest;
    const saved = !better || this.game.commitAccount({ stats: { ...stats, targetSeriesBest: score } });
    this.retry.hidden = saved;
    this.saveMessage.textContent = !saved ? this.game.saveError : better ? 'Nový osobní rekord!' : '';
    this.updateRecord();
  }

  finish() {
    this.field.hidden = this.help.hidden = this.rules.hidden = this.confirm.hidden = this.timer.hidden = true;
    this.result.hidden = this.trainingButton.hidden = this.seriesButton.hidden = false;
    this.heading.textContent = 'Výsledek série';
    this.resultScore.textContent = `${this.round.hits} / ${SERIES_LENGTH}`;
    this.seriesButton.textContent = 'Hrát znovu';
    this.seriesButton.focus({ preventScroll: true });
    this.saveResult();
  }

  hide() {
    if (this.dialog.open) this.dialog.close();
  }

  end() {
    this.hide();
    this.round = null;
  }

  aim(x, y) {
    this.x = Math.max(0, Math.min(1, x));
    this.y = Math.max(0, Math.min(1, y));
    this.cursor.style.left = this.x * 100 + '%';
    this.cursor.style.top = this.y * 100 + '%';
  }

  attempt() {
    if (!this.dialog.open || !this.round) return;
    const { x, y } = this.round.position();
    const hit = this.round.attempt((this.x - x) * this.field.clientWidth,
      (this.y - y) * this.field.clientHeight, this.disc.offsetWidth / 2);
    if (hit === null) return;
    this.feedback.textContent = hit ? 'Zásah!' : 'Vedle';
    this.updateScore();
    this.paint();
  }

  updateScore() {
    this.hits.textContent = String(this.round.hits);
    if (!this.round.series) this.attempts.textContent = String(this.round.attempts);
  }

  update(dt) {
    if (this.round.finished) return;
    const previous = this.round.attempts;
    const waiting = this.round.rest > 0;
    this.round.step(dt);
    if (this.round.attempts !== previous) this.feedback.textContent = 'Čas vypršel';
    else if (this.round.series && waiting && !this.round.rest) this.feedback.textContent = '';
    this.paint();
  }

  paint() {
    const round = this.round;
    if (round.finished) {
      this.attempts.textContent = String(SERIES_LENGTH);
      this.finish();
      return;
    }
    if (round.series) {
      const current = String(round.attempts + (round.rest > 0 ? 0 : 1));
      if (this.attempts.textContent !== current) this.attempts.textContent = current;
      const time = round.rest > 0 ? 'Další terč…' : `Zbývá ${Math.ceil(TARGET_SECONDS - round.time)} s`;
      if (this.timer.textContent !== time) this.timer.textContent = time;
    }
    this.disc.hidden = round.rest > 0;
    const { x, y } = round.position();
    this.disc.style.left = x * 100 + '%';
    this.disc.style.top = y * 100 + '%';
  }
}
