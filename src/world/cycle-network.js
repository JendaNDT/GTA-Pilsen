import { TurnRules } from './turns.js';

const CELL = 80;
const SNAP = 30;
const START_COST = 4;
const clamp = (value, max = 1) => Math.max(0, Math.min(value, max));
const cellKey = (col, row) => col * 65536 + row;
const costFactor = [2.8, 2.8, 2.3, 2.3, 2, 2, 1.65, 1.65, 1.4, 1.4, 1.23, 1.18, 1.12, 1.2, 1.12, 1.45, 1.12, 1.35, 1];

function insert(queue, entry) {
  let low = 0, high = queue.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (queue[mid].estimate > entry.estimate) low = mid + 1;
    else high = mid;
  }
  queue.splice(low, 0, entry);
}

export class CycleNetwork {
  constructor(pack) {
    Object.assign(this, { pack, nodeCount: pack.x.length, edgeCount: 0, grid: new Map() });
  }

  *prepare() {
    const { pack: p } = this;
    this.nodeX = Float32Array.from(p.x, value => value / 10);
    this.nodeZ = Float32Array.from(p.z, value => value / 10);
    const capacity = p.a.length * 2;
    this.eFrom = new Uint32Array(capacity);
    this.eTo = new Uint32Array(capacity);
    this.eRoad = new Uint32Array(capacity);
    this.eCost = new Float32Array(capacity);
    this.forward = new Int32Array(p.a.length).fill(-1);
    this.reverse = new Int32Array(p.a.length).fill(-1);
    this.outStart = new Uint32Array(this.nodeCount + 1);
    const edge = (from, to, way, cost) => {
      const e = this.edgeCount++;
      this.eFrom[e] = from;
      this.eTo[e] = to;
      this.eRoad[e] = way;
      this.eCost[e] = cost;
      this.outStart[from + 1]++;
      return e;
    };
    for (let i = 0; i < p.a.length; i++) {
      if (i % 512 === 0) yield;
      const a = p.a[i], b = p.b[i], way = p.way[i];
      const ax = this.nodeX[a], az = this.nodeZ[a], bx = this.nodeX[b], bz = this.nodeZ[b];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < .05) continue;
      const cost = length * costFactor[p.kind[way]];
      if (p.direction[way] & 1) this.forward[i] = edge(a, b, way, cost);
      if (p.direction[way] & 2) this.reverse[i] = edge(b, a, way, cost);
      for (let col = Math.floor(Math.min(ax, bx) / CELL); col <= Math.floor(Math.max(ax, bx) / CELL); col++) {
        for (let row = Math.floor(Math.min(az, bz) / CELL); row <= Math.floor(Math.max(az, bz) / CELL); row++) {
          const key = cellKey(col, row);
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(i);
        }
      }
    }
    for (let i = 1; i <= this.nodeCount; i++) this.outStart[i] += this.outStart[i - 1];
    this.outEdges = new Uint32Array(this.edgeCount);
    const fill = this.outStart.slice();
    for (let e = 0; e < this.edgeCount; e++) this.outEdges[fill[this.eFrom[e]]++] = e;
    this.turns = new TurnRules(this, p.header.restrictions);
  }

  candidates(point, connect) {
    const { x, z } = point, seen = new Set(), found = [];
    for (let col = Math.floor((x - SNAP) / CELL); col <= Math.floor((x + SNAP) / CELL); col++) {
      for (let row = Math.floor((z - SNAP) / CELL); row <= Math.floor((z + SNAP) / CELL); row++) {
        for (const segment of this.grid.get(cellKey(col, row)) ?? []) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          const a = this.pack.a[segment], b = this.pack.b[segment], way = this.pack.way[segment];
          const ax = this.nodeX[a], az = this.nodeZ[a];
          const dx = this.nodeX[b] - ax, dz = this.nodeZ[b] - az;
          const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
          const sx = ax + dx * t, sz = az + dz * t;
          const distance = Math.hypot(sx - x, sz - z);
          if (distance <= SNAP) found.push({ segment, t, x: sx, z: sz, distance, way });
        }
      }
    }
    found.sort((a, b) => a.distance - b.distance);
    const selected = [], ways = new Set();
    for (const candidate of found) {
      if (selected.length >= 7) break;
      const { way } = candidate;
      if (ways.has(way) || !connect(point, candidate, this.pack.level[way], this.pack.kind[way])) continue;
      ways.add(way);
      selected.push(candidate);
    }
    return selected;
  }

  *route(from, to, connect = () => true) {
    const goal = new Map(), best = new Map(), queue = [];
    const heuristic = node => Math.hypot(this.nodeX[node] - to.x, this.nodeZ[node] - to.z);
    const arrivals = this.candidates(to, connect);
    const starts = this.candidates(from, connect);
    if (!starts.length || !arrivals.length) return null;

    let result = null, resultCost = Infinity;
    const accept = (cost, start, end, parent) => {
      if (cost >= resultCost) return;
      resultCost = cost;
      result = { start, end, parent };
    };
    for (const end of arrivals) {
      for (const [edge, fraction] of [[this.forward[end.segment], end.t], [this.reverse[end.segment], 1 - end.t]]) {
        if (edge < 0) continue;
        const node = this.eFrom[edge];
        if (!goal.has(node)) goal.set(node, []);
        goal.get(node).push({ end, edge, cost: end.distance * START_COST + fraction * this.eCost[edge] });
      }
    }

    const visit = (node, via, context, cost, start, previous) => {
      const key = context * this.edgeCount + via;
      if (cost >= (best.get(key)?.cost ?? Infinity)) return;
      const entry = { node, via, key, context, cost, start, previous, estimate: cost + heuristic(node) };
      best.set(key, entry);
      insert(queue, entry);
    };
    for (const start of starts) {
      const { segment } = start;
      const offset = start.distance * START_COST;
      for (const [edge, sign] of [[this.forward[segment], 1], [this.reverse[segment], -1]]) {
        if (edge < 0) continue;
        const length = this.eCost[edge];
        for (const end of arrivals) {
          const fraction = (end.t - start.t) * sign;
          if (end.segment === segment && fraction >= 0) accept(offset + fraction * length + end.distance * START_COST, start, end, null);
        }
        const remaining = sign === 1 ? 1 - start.t : start.t;
        visit(this.eTo[edge], edge, 0, offset + remaining * length, start, null);
      }
    }

    let expanded = 0;
    while (queue.length) {
      if (++expanded % 96 === 0) yield;
      const current = queue.pop();
      if (current.estimate >= resultCost) break;
      if (current !== best.get(current.key)) continue;
      const { node, via, context, cost, start } = current;
      for (const destination of goal.get(node) ?? []) {
        if (this.eTo[destination.edge] !== this.eFrom[via] && this.turns.advance(via, destination.edge, context) >= 0) {
          accept(cost + destination.cost, start, destination.end, current);
        }
      }
      for (let i = this.outStart[node]; i < this.outStart[node + 1]; i++) {
        const edge = this.outEdges[i];
        if (this.eTo[edge] === this.eFrom[via]) continue;
        const next = this.turns.advance(via, edge, context);
        if (next < 0) continue;
        visit(this.eTo[edge], edge, next, cost + this.eCost[edge], start, current);
      }
    }
    if (!result) return null;
    const nodes = [];
    for (let step = result.parent; step; step = step.previous) nodes.push(step.node);
    const points = [];
    const append = (x, z) => {
      if (points.length && Math.hypot(x - points.at(-2), z - points.at(-1)) < .01) return;
      points.push(x, z);
    };
    append(from.x, from.z);
    append(result.start.x, result.start.z);
    for (const node of nodes.reverse()) append(this.nodeX[node], this.nodeZ[node]);
    append(result.end.x, result.end.z);
    append(to.x, to.z);
    return points;
  }
}
