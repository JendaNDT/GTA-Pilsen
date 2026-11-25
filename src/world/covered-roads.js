import { DRIVABLE_MAX, RF } from '../config.js';
import { pathNormal } from './road-profile.js';
import { Tunnel } from './tunnels.js';

// Některé krátké podjezdy vedl původní model přes vršek náspu.
// Spodní vozovka propojí odkryté konce. Terén nad průjezdným prostorem dál nese horní cestu.
export function coveredRoads(world) {
  const result = new Map(), { r, rpx, rpz, rpy, rOff } = world;
  const openEnds = new Map();
  const key = k => rpx[k] + '/' + rpz[k];
  for (let road = 0; road < world.rCount; road++) {
    if (!(r.flags[road] & RF.TUNNEL) || r.cls[road] > DRIVABLE_MAX || r.layer[road] >= 0) continue;
    openEnds.set(key(rOff[road]), []);
    openEnds.set(key(rOff[road + 1] - 1), []);
  }
  for (let road = 0; road < world.rCount; road++) {
    if (r.cls[road] > DRIVABLE_MAX || r.flags[road] & (RF.TUNNEL | RF.BRIDGE) || world.elevatedWidths.has(road)) continue;
    const first = rOff[road], last = rOff[road + 1] - 1;
    for (const [k, sign] of [[first, 1], [last, -1]]) {
      openEnds.get(key(k))?.push({ road, k, sign });
    }
  }
  // U krátké propusti může výškopis zachytit násep i v ústí.
  // Odkrytý příjezd dá spolehlivější odhad výšky podlahy.
  const entrance = k => {
    const heights = [];
    for (const link of openEnds.get(key(k)) ?? []) {
      let rest = 12, p = link.k;
      const bound = link.sign > 0 ? rOff[link.road + 1] - 1 : rOff[link.road];
      while (p !== bound) {
        const q = p + link.sign, dx = rpx[q] - rpx[p], dz = rpz[q] - rpz[p];
        const length = Math.hypot(dx, dz), t = Math.min(1, rest / (length || 1));
        if (length >= rest || q === bound) {
          if (rest - length < 5) heights.push(world.terrainHeightAt(rpx[p] + t * dx, rpz[p] + t * dz) + 0.05);
          break;
        }
        rest -= length;
        p = q;
      }
    }
    heights.sort((a, b) => a - b);
    const estimate = heights[Math.floor(heights.length / 2)];
    return estimate < rpy[k] - 0.8 ? Math.max(rpy[k] - 4, estimate) : rpy[k];
  };
  for (let road = 0; road < world.rCount; road++) {
    if (!(r.flags[road] & RF.TUNNEL) || r.cls[road] > DRIVABLE_MAX || r.layer[road] >= 0 ||
        world.tunnelRoads.has(road) || world.elevatedWidths.has(road)) continue;
    const first = rOff[road], last = rOff[road + 1] - 1, stations = [0];
    for (let k = first; k < last; k++) stations.push(stations.at(-1) + Math.hypot(rpx[k+1] - rpx[k], rpz[k+1] - rpz[k]));
    const length = stations.at(-1);
    if (length < 6 || length > 200) continue;
    const start = rpy[first], end = rpy[last], slope = (end - start) / length;
    let cover = 0;
    for (let k = first; k < last; k++) {
      const l = stations[k-first+1] - stations[k-first];
      for (let d = 1; d < l; d += 2) {
        const x = rpx[k] + d / l * (rpx[k+1] - rpx[k]), z = rpz[k] + d / l * (rpz[k+1] - rpz[k]);
        cover = Math.max(cover, world.terrainHeightAt(x, z) - (start + slope * (stations[k-first] + d)));
      }
    }
    if (cover < 2.6) continue;
    const floorStart = entrance(first), floorEnd = entrance(last);
    const floorSlope = (floorEnd - floorStart) / length;
    for (let k = first; k <= last; k++) rpy[k] = floorStart + floorSlope * stations[k-first];
    for (const [k, towards] of [[first, -floorSlope], [last, floorSlope]]) {
      for (const link of openEnds.get(key(k)) ?? []) {
        if (!world.coveredApproaches.has(link.road)) world.coveredApproaches.set(link.road, []);
        world.coveredApproaches.get(link.road).push({ start: link.sign > 0, x: rpx[k], z: rpz[k], y: rpy[k], slope: towards });
      }
    }
    const tube = new Tunnel(world, road, 0);
    tube.clearance = Math.min(4.5, cover - 0.25);
    tube.cuts = [];
    for (let k = first; k < last; k++) {
      const l = stations[k-first+1] - stations[k-first];
      if (!l) continue;
      tube.cuts.push({ x: rpx[k], z: rpz[k], dx: (rpx[k+1]-rpx[k])/l, dz: (rpz[k+1]-rpz[k])/l,
        y: rpy[k], slope: floorSlope, width: tube.halfWidth, length: l, start: k === first ? -3 : -0.25, end: l + (k + 1 === last ? 3 : 0.25), clearance: tube.clearance });
    }
    result.set(road, tube);
  }
  for (const tube of result.values()) {
    tube.neighbours = [...result.values()].filter(other => other !== tube && other.minX <= tube.maxX &&
      other.maxX >= tube.minX && other.minZ <= tube.maxZ && other.maxZ >= tube.minZ);
  }
  return result;
}

// Bok zářezu končí na svahu. V místě, kde se pod náspem sbíhají dvě cesty, zůstane průjezd.
export function coveredFaces(world, tube, path, quad) {
  let previous;
  for (let k = 0; k < path.n; k++) {
    const n = pathNormal(path, k), floor = path.y[k];
    const section = [-1, 1].map(side => {
      const offset = side * n.scale * tube.halfWidth;
      const x = path.x[k] + n.x * offset, z = path.z[k] + n.z * offset;
      const top = Math.min(floor + tube.clearance, Math.max(floor, world.heightAt(x, z)));
      return [[x, floor, z], [x, top, z]];
    });
    if (previous) {
      for (let i = 0; i < 2; i++) {
        const [a, b] = previous[i], [c, d] = section[i];
        if (Math.max(b[1] - a[1], d[1] - c[1]) < 0.02) continue;
        const shared = tube.neighbours.some(other => other.position((a[0] + c[0]) / 2,
          (a[2] + c[2]) / 2, other.halfWidth + 0.2, {}));
        if (!shared) {
          if (i === 0) quad(a, c, d, b);
          else quad(a, b, d, c);
        }
      }
      const x = (path.x[k-1] + path.x[k]) / 2, z = (path.z[k-1] + path.z[k]) / 2;
      if (world.heightAt(x, z) >= (floor + path.y[k-1]) / 2 + tube.clearance) {
        const ceiling = ([x, y, z]) => [x, y + tube.clearance, z];
        quad(ceiling(previous[0][0]), ceiling(section[0][0]), ceiling(section[1][0]), ceiling(previous[1][0]));
      }
    }
    previous = section;
  }
}

// Při rozvětvení sdílejí překrývající se pruhy povrch. Na ose rozhoduje výška
// vlastního pruhu a směrem k druhé ose se plynule přenáší vliv jeho sklonu.
export function coveredHeight(tube, x, z, fallback) {
  if (!tube.neighbours.length) return fallback;
  let weighted = 0, sum = 0;
  for (const candidate of [tube, ...tube.neighbours]) {
    const hit = candidate.position(x, z, candidate.halfWidth + 2, {});
    if (!hit) continue;
    const width = candidate.halfWidth + 2;
    const weight = (1 - hit.distance / width) ** 2 / (0.04 + hit.distance ** 2);
    weighted += weight * hit.floor;
    sum += weight;
  }
  return sum ? weighted / sum : fallback;
}

export function coveredFloor(tube, path, quad) {
  const parts = tube.neighbours.length ? Math.ceil(2 * tube.halfWidth / 0.75) : 1;
  let previous, along = 0;
  for (let k = 0; k < path.n; k++) {
    if (k) along += Math.hypot(path.x[k] - path.x[k-1], path.z[k] - path.z[k-1]);
    const n = pathNormal(path, k), row = [];
    for (let i = 0; i <= parts; i++) {
      const across = (2 * i / parts - 1) * tube.halfWidth;
      const x = path.x[k] + n.x * n.scale * across, z = path.z[k] + n.z * n.scale * across;
      row.push([x, coveredHeight(tube, x, z, path.y[k]), z, along, across]);
    }
    if (previous) for (let i = 0; i < parts; i++) quad(previous[i], previous[i+1], row[i+1], row[i]);
    previous = row;
  }
}
