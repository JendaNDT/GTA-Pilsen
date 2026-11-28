// Identifikátory stanovišť PMDP u úseků s atributem OSM bus_bay.
const bayPlatforms = new Set(['47081/1', '47081/2', '53408/2', '57126/2']);

export function stopBerth(vehicle, timetable) {
  const index = vehicle.stopIndex;
  const stop = vehicle.event.trip.stops[index];
  const platform = stop && timetable.stops[stop.stop];
  if (!platform || !bayPlatforms.has(platform[3])) return null;
  const s = stop.target[0], point = vehicle.route.posAt(s, 0, {});
  const lateral = (platform[2] - point.z) * point.tx - (platform[1] - point.x) * point.tz;
  const extra = Math.min(3.2, lateral - 1.5 - vehicle.lane);
  if (extra < 1.4) return null;
  return { index, s, extra, lane: vehicle.route.posAt(s + 12, vehicle.lane, {}) };
}

export function berthOffset(berth, s) {
  if (!berth) return 0;
  const distance = Math.abs(s - berth.s);
  const t = Math.max(0, 1 - distance / (s <= berth.s ? 22 : 17));
  return berth.extra * t * t * (3 - 2 * t);
}

export function nextLaneOffset(side, lane, berth, s, dt) {
  const target = lane + berthOffset(berth, s);
  return side + (target - side) * Math.min(1, dt * 4);
}

// Mezera je za zádí autobusu. Záporná hodnota znamená, že auto už jede vedle.
export function pulloutGap(bus, lane, car) {
  if (!lane || Math.abs(car.y - bus.y) > 3 || car.mode === 'parked') return Infinity;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  if (fx * lane.tx + fz * lane.tz < 0.88) return Infinity;
  const side = (car.z - lane.z) * lane.tx - (car.x - lane.x) * lane.tz;
  if (Math.abs(side) > 1.65) return Infinity;
  const behind = (bus.x - car.x) * lane.tx + (bus.z - car.z) * lane.tz;
  if (behind < -bus.halfLen - car.halfLen - 1.5 || behind > 50) return Infinity;
  return behind - bus.halfLen - car.halfLen;
}

export function canYieldAtPullout(gap, speed) {
  return Number.isFinite(gap) && gap >= 0 && speed ** 2 <= 7 * Math.max(0.25, gap);
}
