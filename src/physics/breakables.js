import { DAY_SECONDS, HOUR_SECONDS } from '../game/clock.js';

// Dlaždice a pořadí jsou ze zdrojového seznamu, před seskupením podle materiálu.
export function breakableId(kind, tile, source) {
  return `${kind}/${tile}/${source}`;
}

export class Breakables {
  constructor() {
    this.damaged = new Map();
    this.visuals = new Map();
  }

  state(id) {
    return this.damaged.get(id)?.state ?? 'intact';
  }

  attach(visual) {
    this.detach(this.visuals.get(visual.id));
    this.visuals.set(visual.id, visual);
    visual.show(this.state(visual.id) === 'intact');
  }

  detach(visual) {
    if (!visual || this.visuals.get(visual.id) !== visual) return;
    visual.remove?.();
    this.visuals.delete(visual.id);
  }

  damage(id, state, now) {
    if (state !== 'bent' && state !== 'broken' && state !== 'moved') throw new Error('Neznámý druh poškození.');
    const current = this.state(id);
    if (current === state || current === 'broken') return false;
    const repairAt = (Math.floor(now / DAY_SECONDS) + 1) * DAY_SECONDS + 4 * HOUR_SECONDS;
    this.damaged.set(id, { state, repairAt });
    this.visuals.get(id)?.show(false);
    return true;
  }

  bendPose(id, pose) {
    const damage = this.damaged.get(id);
    if (damage?.state !== 'bent') return;
    this.setPose(id, pose);
  }

  setPose(id, pose) {
    const damage = this.damaged.get(id);
    if (!damage) return;
    damage.pose = pose;
    this.visuals.get(id)?.show(false);
  }

  repairDue(now) {
    const repaired = [];
    for (const [id, item] of this.damaged) {
      if (now < item.repairAt) continue;
      this.damaged.delete(id);
      this.visuals.get(id)?.show(true);
      repaired.push(id);
    }
    return repaired;
  }
}
