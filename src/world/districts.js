// Obvody slouží jako vodítko pro materiály, druh zástavby má přednost před hranicí obvodu.
function contains(ring, x, z) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const a = ring[i + 1], b = ring[j + 1];
    if ((a > z) !== (b > z) && x < ring[i] + (ring[j] - ring[i]) * (z - a) / (b - a)) hit = !hit;
  }
  return hit;
}

export class Districts {
  constructor(entries) {
    this.areas = entries.map(([id, [outer, ...holes]]) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let p = 0; p < outer.length; p += 2) {
        x0 = Math.min(x0, outer[p]); x1 = Math.max(x1, outer[p]);
        z0 = Math.min(z0, outer[p + 1]); z1 = Math.max(z1, outer[p + 1]);
      }
      return { id, outer, holes, x0, z0, x1, z1 };
    });
  }

  at(x, z) {
    for (const a of this.areas) {
      if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1
          && contains(a.outer, x, z) && !a.holes.some((hole) => contains(hole, x, z))) return a.id;
    }
    return 0;
  }
}
