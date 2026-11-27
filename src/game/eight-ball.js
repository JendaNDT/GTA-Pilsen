// Domácí osmička U Papírny se hraje bez hlášení kapes.
export function ballGroup(number) {
  if (number >= 1 && number <= 7) return 'plné';
  if (number >= 9 && number <= 15) return 'půlené';
  return null;
}

export class EightBall {
  constructor(starter = 1, computer = false) {
    this.computer = computer;
    this.player = this.starter = starter;
    this.groups = [null, null, null];
    this.remaining = { plné: 7, půlené: 7 };
    this.breakShot = true;
    this.inHand = false;
    this.winner = null;
    this.message = 'Rozstřel.';
  }

  settle({ first, pocketed, railAfterContact, scratch }) {
    if (this.winner) return;
    const player = this.player, other = 3 - player;
    const group = this.groups[player];
    const onBlack = !!group && this.remaining[group] === 0;
    let foul = '';
    if (scratch) foul = 'Bílá spadla do kapsy.';
    else if (!first) foul = 'Bílá netrefila žádnou kouli.';
    else if (onBlack ? first !== 8 : first === 8 || (group && ballGroup(first) !== group)) {
      foul = 'Bílá zasáhla nejdřív nesprávnou kouli.';
    } else if (!pocketed.length && !railAfterContact) foul = 'Po zásahu chyběl odraz od mantinelu.';

    if (pocketed.includes(8)) {
      if (this.breakShot) {
        // Při černé z rozstřelu se staví celý nový trojúhelník.
        return { rerack: true, starter: foul ? other : player };
      }
      this.winner = onBlack && !foul ? player : other;
      this.message = foul || (onBlack ? 'Černá je v kapse.' : 'Černá spadla předčasně.');
      return;
    }

    for (const number of pocketed) this.remaining[ballGroup(number)]--;
    if (!group && !this.breakShot && !foul && pocketed.length) {
      this.groups[player] = ballGroup(pocketed[0]);
      this.groups[other] = this.groups[player] === 'plné' ? 'půlené' : 'plné';
    }
    const scored = pocketed.some(n => !this.groups[player] || ballGroup(n) === this.groups[player]);
    if (foul || !scored) this.player = other;
    this.inHand = !!foul;
    this.message = foul;
    if (!foul && scored && (!this.computer || player === 1)) this.message = 'Pokračuješ.';
    if (!foul && !scored && !this.computer) this.message = 'Předejte si telefon.';
    this.breakShot = false;
  }

  get status() {
    if (this.winner) {
      if (this.computer) return (this.winner === 1 ? 'Vyhráváš! ' : 'Vyhrává počítač. ') + this.message;
      return `Vyhrává hráč ${this.winner}. ${this.message}`;
    }
    const group = this.groups[this.player];
    const target = !group ? 'Otevřený stůl' : this.remaining[group] ? `${group} · zbývá ${this.remaining[group]}` : 'na řadě je černá';
    const label = this.computer ? (this.player === 1 ? 'Tvůj tah' : 'Na tahu je počítač') : `Hráč ${this.player}`;
    return `${label} · ${target}.${this.message ? ' ' + this.message : ''}`;
  }
}
