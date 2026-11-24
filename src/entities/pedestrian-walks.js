import { gardenWalks } from '../world/sady-layout.js';
import { easternWalks } from '../world/strouha-layout.js';

// Souvislá pěší cesta po hranách místního výřezu OSM, z prostoru před muzeem na lávku.
const museumWalk = [[151,298.4],[151.3,293.9],[157.1,232],[162.7,177.5],[166.2,144.2],
  [167.1,135.6],[190.9,134.3],[200.8,132.4],[205.3,117.6],[207.4,110.9],
  [222.6,63.5],[225.5,45.5],[228.3,40.8],[228.9,34.3],[228.1,32.3],[236.2,28.4],
  [243,30.2],[257.1,18.1],[253.2,13],[253.5,10],[260.9,-1.4],[268.4,-10],
  [282.4,-18.1],[291,-24.8],[296.5,-37.3],[295.8,-37.7],[283.2,-45.6],[281.9,-46.4]];
const gaps = new Map([4, 8, 10, 14].map(index => {
  const a = museumWalk[index], b = museumWalk[index + 1];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [index, { a, b, length, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2,
    dx: (b[0] - a[0]) / length, dz: (b[1] - a[1]) / length, unmarked: true }];
}));

export function parkCrossing(trip) {
  if (trip.path !== museumWalk) return null;
  const crossing = gaps.get(Math.min(trip.index, trip.index - trip.direction));
  if (!crossing) return null;
  return { crossing, from: trip.direction > 0 ? crossing.a : crossing.b, to: trip.direction > 0 ? crossing.b : crossing.a };
}

// Stejné osy pěšin jako na povrchu parku a v pěší navigaci na lávku.
const walks = [museumWalk, ...gardenWalks, ...easternWalks];
export function parkTrip(x, z, radius = 24) {
  let best = radius ** 2, trip = null;
  for (const path of walks) {
    if (path.length < 2) continue;
    for (const direction of [1, -1]) {
      const start = direction === 1 ? 0 : path.length - 1;
      const [px, pz] = path[start];
      const distance = (px - x) ** 2 + (pz - z) ** 2;
      const end = direction === 1 ? path.at(-1) : path[0];
      if (distance >= best || Math.hypot(px - end[0], pz - end[1]) < 12) continue;
      trip = { path, index: start + direction, direction, x: px, z: pz };
      best = distance;
    }
  }
  return trip;
}

export function stepTo(person, x, z, dt) {
  const dx = x - person.x, dz = z - person.z, distance = Math.hypot(dx, dz);
  const step = Math.min(distance, dt * person.speed);
  if (distance > 0.01) {
    person.x += dx * step / distance;
    person.z += dz * step / distance;
    person.yaw = Math.atan2(dx, dz);
  }
  return distance - step <= 0.03;
}

export function followParkTrip(person, dt) {
  const trip = person.trip;
  if (trip.pause > 0) {
    trip.pause -= dt;
    return 0;
  }
  const [x, z] = trip.path[trip.index];
  const [ax, az] = trip.path[trip.index - trip.direction];
  const length = Math.hypot(x - ax, z - az) || 1;
  // Každý se drží svého pravého okraje, také na úzké lávce.
  const tx = (x - ax) / length, tz = (z - az) / length;
  const along = (person.x - ax) * tx + (person.z - az) * tz;
  const next = Math.min(length, Math.max(0, along) + 1.6);
  if (stepTo(person, ax + next * tx - 0.42 * tz, az + next * tz + 0.42 * tx, dt) && next === length) {
    if (trip.index + trip.direction < 0 || trip.index + trip.direction >= trip.path.length) {
      trip.direction *= -1;
      trip.pause = 2.5;
    }
    trip.index += trip.direction;
  }
  return person.speed;
}
