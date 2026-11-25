import { coveredFaces, coveredFloor } from '../world/covered-roads.js';
import {segmentHalfWidth} from '../world/rail-deck.js';
import { CHUNK, COLL_CELL, RF } from '../config.js';
import { prazdrojThickness } from '../world/prazdroj-bridge.js';
import { BRIDGE_THICKNESS, densePath, offsetDeck, pathNormal } from '../world/road-profile.js';
import { TUNNEL_HEIGHT } from '../world/tunnels.js';

export class RoadStructures {
  constructor(world) {
    this.world = world;
    this.tiles = new Map();
    for (let i = 0; i < world.rCount; i++) {
      const flags = world.r.flags[i];
      if (flags & RF.SHARED_DECK || (!(flags & RF.BRIDGE) && !world.elevatedWidths?.has(i))) continue;
      const a = world.rOff[i], b = world.rOff[i + 1] - 1;
      const path = densePath(world.rpx, world.rpz, world.rpy, a, b, a, b, 4);
      this.strip(offsetDeck(path, world.deckCalibrations.get(i)), world.deckHalfWidth(i),
        null, i === world.prazdrojRoad ? prazdrojThickness : undefined);
    }
    for (const [road, entry] of world.upperApproaches ?? []) {
      for (const { path } of entry.spans) this.strip(path, world.r.w[road] / 2, null);
    }
    if (world.roadApproach) this.strip(world.roadApproach.path, world.roadApproach.halfWidth, null);
    for (const rail of world.rails) if (rail.y) {
      const xs = [], zs = [];
      for (let i = 0; i < rail.pts.length; i += 2) { xs.push(rail.pts[i]); zs.push(rail.pts[i + 1]); }
      this.strip(rail.deck ?? densePath(xs, zs, rail.y, 0, xs.length - 1, 0, xs.length - 1, 4), rail.cls === 1 ? 2.4 : 1.7);
    }
    for (const [road, tube] of world.coveredRoads ?? []) {
      const a = world.rOff[road], b = world.rOff[road + 1] - 1;
      const floor = densePath(world.rpx, world.rpz, world.rpy, a, b, a, b, 1);
      coveredFloor(tube, floor, (a, b, c, d) => this.quad(a.slice(0, 3), b.slice(0, 3), c.slice(0, 3), d.slice(0, 3)));
      coveredFaces(world, tube, floor, (a, b, c, d) => this.quad(a, b, c, d));
    }
    for (const tunnel of world.tunnels) {
      const pts = tunnel.points, end = pts.length - 1;
      const path = densePath(pts.map((p) => p.x), pts.map((p) => p.z), pts.map((p) => p.y), 0, end, 0, end, 4);
      this.strip(path, tunnel.halfWidth, tunnel);
    }
  }

  quad(a, b, c, d) {
    const w = this.world;
    const cx = Math.floor(((a[0] + b[0] + c[0] + d[0]) / 4 - w.minX) / CHUNK);
    const cz = Math.floor(((a[2] + b[2] + c[2] + d[2]) / 4 - w.minZ) / CHUNK);
    if (cx < 0 || cz < 0 || cx >= w.cols || cz >= w.rows) return;
    const ci = cz * w.cols + cx;
    if (!this.tiles.has(ci)) this.tiles.set(ci, []);
    this.tiles.get(ci).push(a, b, c, a, c, d);
  }

  // V ústí odbočky se široké pásy vozovek překrývají. Oběma částem dáme
  // společnou výšku, uprostřed každé komunikace určenou jejím vlastním profilem.
  junctionHeight(x, y, z) {
    const w = this.world, segments = w.bridgeSeg;
    const nearby = w.bridgeGrid.get(Math.floor(x / COLL_CELL) * 8192 + Math.floor(z / COLL_CELL));
    let sum = 0, weights = 0;
    for (const s of nearby ?? []) {
      const ax = segments[s], az = segments[s + 1], dx = segments[s + 3] - ax, dz = segments[s + 4] - az;
      const length2 = dx * dx + dz * dz;
      if (length2 < 0.0001) continue;
      const t = ((x - ax) * dx + (z - az) * dz) / length2;
      if (t < -0.0001 || t > 1.0001) continue;
      const d2 = (ax + t * dx - x) ** 2 + (az + t * dz - z) ** 2;
      if (d2 > segmentHalfWidth(w,s,t) ** 2) continue;
      const height = segments[s + 2] + t * (segments[s + 5] - segments[s + 2]);
      if (Math.abs(height - y) > 0.5) continue;
      const weight = 1 / (0.0025 + d2) ** 2;
      weights += weight;
      sum += height * weight;
    }
    return weights ? sum / weights : y;
  }

  deck(a, b, f, e) {
    const sample = (u, v) => a.map((coord, i) => (1 - u) * ((1 - v) * coord + v * e[i])
      + u * ((1 - v) * b[i] + v * f[i]));
    const onDeck = (p) => [p[0], this.junctionHeight(...p), p[2]];
    const changes = [a, b, f, e, sample(0.5, 0.5), sample(0.25, 0.5), sample(0.75, 0.5)]
      .some((p) => Math.abs(this.junctionHeight(...p) - p[1]) > 0.01);
    if (!changes) { this.quad(a, b, f, e); return; }
    const across = Math.ceil(Math.hypot(a[0] - b[0], a[2] - b[2]));
    const along = Math.max(1, Math.ceil(Math.hypot(a[0] - e[0], a[2] - e[2])));
    const row = Array.from({ length: across + 1 }, (_, i) => onDeck(sample(i / across, 0)));
    for (let j = 1; j <= along; j++) {
      let left = onDeck(sample(0, j / along));
      for (let i = 1; i <= across; i++) {
        const right = onDeck(sample(i / across, j / along));
        this.quad(row[i - 1], row[i], right, left);
        row[i - 1] = left;
        left = right;
      }
      row[across] = left;
    }
  }

  strip(path, width, tunnel = null, thickness = BRIDGE_THICKNESS) {
    let previous;
    for (let k = 0; k < path.n; k++) {
      const { x, z, scale } = pathNormal(path, k);
      const point = (side, lift) => [path.x[k] + x * side * scale, path.y[k] + lift, path.z[k] + z * side * scale];
      const h = tunnel ? TUNNEL_HEIGHT : -thickness;
      const hw = path.widths?.[k] ?? width;
      const section = [point(-hw, 0), point(hw, 0), point(-hw, h), point(hw, h)];
      if (previous) {
        const [a, b, c, d] = previous, [e, f, g, j] = section;
        if (tunnel) this.quad(a, b, f, e);
        else this.deck(a, b, f, e);
        if (tunnel) {
          const mx = (path.x[k] + path.x[k - 1]) / 2, mz = (path.z[k] + path.z[k - 1]) / 2;
          if (tunnel.position(mx, mz, width, {})?.inside) {
            this.quad(a, e, g, c);
            this.quad(b, d, j, f);
            this.quad(c, g, j, d);
          }
        } else {
          this.quad(a, e, g, c);
          this.quad(b, d, j, f);
          this.quad(c, g, j, d);
        }
      }
      previous = section;
    }
  }

  emit(ci, triangle) {
    const points = this.tiles.get(ci) ?? [];
    for (let k = 0; k < points.length; k += 3) triangle(points[k], points[k + 1], points[k + 2]);
  }
}
