import { DAY_SECONDS, HOUR_SECONDS } from '../game/clock.js';

// Dlaždice a pořadí jsou ze zdrojového seznamu, před seskupením podle materiálu.
export function breakableId(kind, tile, source) {
  return `${kind}/${tile}/${source}`;
}

export class Breakables {
  constructor() {
    this.damaged = new Map();
  }

  state(id) {
    return this.damaged.get(id)?.state ?? 'intact';
  }

  damage(id, state, now) {
    if (state !== 'bent' && state !== 'broken') throw new Error('Neznámý druh poškození.');
    const current = this.state(id);
    if (current === state || current === 'broken') return false;
    const repairAt = (Math.floor(now / DAY_SECONDS) + 1) * DAY_SECONDS + 4 * HOUR_SECONDS;
    this.damaged.set(id, { state, repairAt });
    return true;
  }

  repairDue(now) {
    const repaired = [];
    for (const [id, item] of this.damaged) {
      if (now < item.repairAt) continue;
      this.damaged.delete(id);
      repaired.push(id);
    }
    return repaired;
  }
}
