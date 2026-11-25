import { DRIVABLE_MAX } from '../config.js';
import { streetCorners, streetFixtures } from './street-furniture.js';

// Zaměřené označníky už jsou součástí ručního modelu terminálu E25.
const terminal = new Map([
  ['53408/1', [706.31, 335.88, 1.16]],
  ['53408/2', [746.8, 336.9, 1.16]],
  ['53408/3', [609.6, 257.6, 0]],
  ['53408/4', [595.1, 251.2, 0]]
]);

function addToTile(tiles, tile, item) {
  if (!tiles.has(tile)) tiles.set(tile, []);
  tiles.get(tile).push(item);
}

function platformServices(schedule, routes) {
  const services = schedule.stops.map(() => ({
    lines: new Set(),
    modes: new Set(),
    directions: new Set(),
    distance: Infinity
  }));
  for (const [ri, calls, destination] of schedule.patterns) {
    const route = routes[ri];
    if (!route) continue;
    for (const [index, station] of calls) {
      const target = route.stops[station];
      if (!target) continue;
      const service = services[index],
        [, x, z] = schedule.stops[index];
      service.lines.add(route.ref);
      service.modes.add(route.type);
      if (destination && station !== calls.at(-1)[1]) service.directions.add(route.ref + '  ' + destination);
      const p = route.posAt(target[0], 0, {});
      const distance = Math.hypot(p.x - x, p.z - z);
      if (distance < service.distance && Math.hypot(p.tx, p.tz) > 0.9) Object.assign(service, p, { distance });
    }
  }
  return services;
}

function clearPoint(w, x, z) {
  return (
    w.inBounds(x, z) &&
    w.buildingAt(x, z) < 0 &&
    !w.isWater(x, z) &&
    !w.insideOtherCarriageway(-1, x, z, 0.15) &&
    !w.blocksTramTrack(x, z, w.terrainHeightAt(x, z), 0, 0.65, 0.65)
  );
}

function locate(w, sx, sz, service, occupied) {
  const road = w.nearestRoad(sx, sz, 22, DRIVABLE_MAX);
  let dx = service.tx ?? road?.dx ?? 1,
    dz = service.tz ?? road?.dz ?? 0;
  if (road && Math.abs(road.dx * dx + road.dz * dz) > 0.65) {
    const side = Math.sign(road.dx * dx + road.dz * dz);
    dx = side * road.dx;
    dz = side * road.dz;
  }
  // Je-li bod už na chodníku, odsazujeme vybavení dále od nejbližší vozovky.
  const lateral = road ? (sz - road.z) * dx - (sx - road.x) * dz : 0;
  const side = lateral < -1 ? -1 : 1;
  const nx = -dz * side,
    nz = dx * side;
  const available = (x, z) => clearPoint(w, x, z) && !occupied.some((p) => Math.hypot(x - p.x, z - p.z) < 1.4);
  const yaw = Math.atan2(dz, dx);
  if (available(sx, sz)) return { x: sx, z: sz, yaw, nx, nz };
  const edge = road ? Math.max(0, w.r.w[road.road] / 2 + 0.75 - Math.abs(lateral)) : 0;
  for (const offset of [edge, edge + 1.2, edge + 3, edge + 6, edge + 10, edge + 16]) {
    for (const along of [0, 2, -2, 5, -5, 9, -9, 16, -16]) {
      const x = sx + nx * offset + dx * along,
        z = sz + nz * offset + dz * along;
      if (available(x, z)) return { x, z, yaw, nx, nz };
    }
  }
  // Stísněná konečná nebo společný nástupní bod: projít i druhou stranu.
  for (let radius = 2; radius <= 48; radius += 2)
    for (let k = 0; k < 16; k++) {
      const a = yaw + (k * Math.PI) / 8,
        x = sx + radius * Math.cos(a),
        z = sz + radius * Math.sin(a);
      if (available(x, z)) return { x, z, yaw, nx, nz };
    }
  return null;
}

function seatLocation(world, sign, width, depth, signs, seats) {
  const { x, z, yaw, nx, nz } = sign;
  for (const along of [-3.4, 3.4, -6.4, 6.4])
    for (const back of [1.3, 2.5, 3.7]) {
      const px = x + along * Math.cos(yaw) + back * nx,
        pz = z + along * Math.sin(yaw) + back * nz;
      if (
        signs.some((p) => Math.hypot(p.x - px, p.z - pz) < width / 2 + 0.5) ||
        seats.some((p) => Math.hypot(p.x - px, p.z - pz) < (p.width + width) / 2 + 0.3)
      )
        continue;
      if (
        streetCorners(px, 0, pz, yaw, width, depth).every(([cx, , cz]) => clearPoint(world, cx, cz)) &&
        clearPoint(world, px, pz)
      )
        return { x: px, z: pz };
    }
  return null;
}

export function installTransitStops(world, schedule, routes, survey = {}) {
  const services = platformServices(schedule, routes),
    signs = [],
    tiles = new Map(),
    fixtures = new Map();
  const authoredIds = new Set();
  for (const [index, [name, sx, sz, code]] of schedule.stops.entries()) {
    const service = services[index],
      sampled = survey[code],
      authored = terminal.get(code);
    const position = authored
      ? { x: authored[0], z: authored[1], yaw: authored[2] }
      : locate(world, sampled?.[0] ?? sx, sampled?.[1] ?? sz, service, signs);
    if (!position) continue;
    const id = 'pmdp-' + String(code ?? index).replaceAll('/', '-'),
      number = code?.split('/')[1] ?? '';
    const sign = {
      ...position,
      kind: 'stopBoard',
      id,
      code,
      index,
      name,
      number,
      lines: [...service.lines].sort((a, b) => a.localeCompare(b, 'cs', { numeric: true })),
      directions: [...service.directions].sort((a, b) => a.localeCompare(b, 'cs', { numeric: true })),
      modes: [...service.modes]
    };
    signs.push(sign);
    const tile = world.chunkIndex(sign.x, sign.z);
    addToTile(tiles, tile, sign);
    if (authored) authoredIds.add('street/' + tile + '/' + id + '/oznacnik');
  }
  const seats = [];
  for (const sign of signs) {
    const sampled = survey[sign.code];
    if (terminal.has(sign.code) || !sampled || !(sampled[2] || sampled[3])) continue;
    const width = sampled[2] ? 3.2 : 1.85;
    const seat = seatLocation(world, sign, width, sampled[2] ? 1.4 : 0.8, signs, seats);
    if (!seat) continue;
    seats.push({ ...seat, width });
    const yaw = Math.atan2(-sign.nx, sign.nz);
    for (const [enabled, kind] of [
      [sampled[2], 'shelter'],
      [sampled[3], 'bench']
    ]) {
      if (enabled)
        addToTile(tiles, world.chunkIndex(seat.x, seat.z), { ...seat, yaw, id: sign.id + '-' + kind, kind });
    }
  }
  return {
    tiles,
    authoredIds,
    signs,
    fixtures(tile) {
      if (!tiles.has(tile)) return [];
      if (!fixtures.has(tile)) {
        const parts = [];
        for (const item of tiles.get(tile)) {
          const y = world.walkY(item.x, item.z, world.terrainHeightAt(item.x, item.z) + 2);
          const holder = item.kind === 'stopBoard' ? { ...item, kind: 'platformSign' } : item;
          for (const f of streetFixtures(holder, world, y)) {
            if (item.kind === 'stopBoard') Object.assign(f, { kind: 'stopBoard', board: item });
            parts.push(f);
          }
        }
        fixtures.set(tile, parts);
      }
      return fixtures.get(tile);
    },
    nearest(x, z, radius = 6) {
      let index = -1,
        best = radius * radius;
      const nearby = new Set();
      for (const dx of [-radius, radius])
        for (const dz of [-radius, radius]) nearby.add(world.chunkIndex(x + dx, z + dz));
      for (const tile of nearby)
        for (const item of tiles.get(tile) ?? []) {
          if (item.kind !== 'stopBoard') continue;
          const d = (item.x - x) ** 2 + (item.z - z) ** 2;
          if (d < best) {
            best = d;
            index = item.index;
          }
        }
      return index;
    }
  };
}
