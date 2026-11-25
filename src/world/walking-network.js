// Uzly se propojují v obou směrech. Most a cesta pod ním mohou mít stejné x a z.
const bin = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y);

export class WalkingNetwork {
  constructor(clear) {
    this.clear = clear;
    this.bins = new Map();
    this.vertices = new Map();
  }

  vertex(x, z, y) {
    const key = Math.round(x * 10) + ',' + Math.round(z * 10);
    let levels = this.vertices.get(key);
    if (!levels) this.vertices.set(key, levels = []);
    const same = levels.find(p => Math.abs(p.y - y) < 0.7);
    if (same) return same;
    const p = { x, z, y, neighbours: new Set() };
    levels.push(p);
    const cell = bin(x, z);
    if (!this.bins.has(cell)) this.bins.set(cell, []);
    this.bins.get(cell).push(p);
    return p;
  }

  connect(a, b) {
    if (a === b) return;
    a.neighbours.add(b);
    b.neighbours.add(a);
  }

  segment(a, b) {
    // Mezilehlé body umožní nastoupit také uprostřed dlouhé rovné pěšiny.
    const count = Math.ceil(distance(a, b) / 8);
    let prev = a;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const p = this.vertex(a.x + t * (b.x-a.x), a.z + t * (b.z-a.z), a.y + t * (b.y-a.y));
      this.connect(prev, p);
      prev = p;
    }
    this.connect(prev, b);
  }

  nearby(p, radius) {
    const result = [];
    for (let x = Math.floor((p.x-radius)/16); x <= Math.floor((p.x+radius)/16); x++) {
      for (let z = Math.floor((p.z-radius)/16); z <= Math.floor((p.z+radius)/16); z++) {
        for (const other of this.bins.get(x + ',' + z) ?? []) {
          if (Math.abs(other.y-p.y) < 2 && distance(p, other) <= radius) result.push(other);
        }
      }
    }
    return result.sort((a,b) => distance(p,a)-distance(p,b));
  }

  *route(from, to) {
    const start = { ...from, neighbours: this.nearby(from, 22).filter(n => this.clear(from,n)) };
    const goals = new Set(this.nearby(to, 22).filter(n => this.clear(n,to)));
    if (!start.neighbours.length || !goals.size) return null;
    const cost = new Map([[start, 0]]), parent = new Map();
    const queue = [{ node: start, cost: 0, total: distance(from,to) }];
    let steps = 0;
    while (queue.length) {
      if (++steps % 64 === 0) yield;
      const next = queue.pop(), n = next.node;
      if (next.cost !== cost.get(n)) continue;
      if (n === to) {
        const points = [];
        for (let p = n; p; p = parent.get(p)) points.push(p.z, p.x);
        return points.reverse();
      }
      const neighbours = goals.has(n) ? [...n.neighbours, to] : n.neighbours;
      for (const other of neighbours) {
        const d = next.cost + distance(n,other);
        if (d >= (cost.get(other) ?? Infinity)) continue;
        cost.set(other,d);
        parent.set(other,n);
        const total = d + distance(other,to);
        let lo = 0, hi = queue.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (queue[mid].total > total) lo = mid + 1;
          else hi = mid;
        }
        queue.splice(lo,0,{node:other, cost:d, total});
      }
    }
    return null;
  }
}
