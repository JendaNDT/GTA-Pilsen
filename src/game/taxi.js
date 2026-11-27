import { DRIVABLE_MAX } from '../config.js';
import { curbStop } from './work-sites.js';

export const TAXI_RIDES = {
  regular: { name: 'Běžná jízda', request: 'Dovez cestujícího k cíli.', bonus: 0 },
  train: { name: 'Spěch na nádraží', request: 'Cestující spěchá na vlak. Včasný příjezd přidá bonus.', bonus: 120 },
  quiet: { name: 'Klidná jízda', request: 'Jezdi plynule, bez prudkého brzdění a nárazů.', bonus: 90 },
};

const STATION = { name: 'Hlavní nádraží · u spodního vstupu', x: 699.4, z: 497.4 };
const REFERENCE = {
  regular: [['Husova 301/4', -388.7, 226.8], ['Papírnická 14', 596.7, 1125.9]],
  train: [['Prokopova 21', 124.2, 555.1]],
  quiet: [['Štruncovy sady 3', 484, -261.4], ['Husova 56', -951.5, 160.4]],
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const five = (amount) => Math.round(amount / 5) * 5;

export function taxiStop(world, place, acceptsWaiting) {
  const station = place === STATION;
  const access = station && world.nearestRoad(place.x, place.z, 6, DRIVABLE_MAX, 0, {},
    world.groundY(place.x, place.z), true, { tx: 0, tz: -1 });
  const stop = curbStop(world, place.x, place.z, station ? 6 : 58, {
    serviceEdge: access ? world.edgeOfPt[access.seg] : undefined,
    minWidth: station ? 3.5 : 4,
    accept(stop) {
      const { x, z, tx, tz, waiting } = stop;
      const ground = world.groundY(x, z);
      const door = { x: (x + waiting.x) / 2, z: (z + waiting.z) / 2 };
      return (!acceptsWaiting || acceptsWaiting(stop)) && Math.abs(ground - world.groundY(waiting.x, waiting.z)) < 0.55
        && !world.blocked(door.x, door.z, 0.4)
        && !world.blocksTramTrack(x, z, ground, Math.atan2(tx, tz), 5, 2);
    },
  });
  if (!stop) return null;
  return { ...stop, label: place.name, y: world.groundY(stop.x, stop.z) };
}

export function taxiRoadPosition(world, car) {
  const heading = { tx: Math.sin(car.yaw), tz: Math.cos(car.yaw) };
  // Cesta začíná v aktuálním směru, pokud se dá určit z polohy auta.
  const road = world.nearestRoad(car.x, car.z, 12, DRIVABLE_MAX, 0, {}, car.y, true, heading);
  const fallback = () => ({ node: world.nearestNode(car.x, car.z, 125, car.y), edge: -1 });
  if (!road) return fallback();
  const base = world.edgeOfPt[road.seg];
  if (base < 0) return fallback();
  const forward = road.dx * heading.tx + road.dz * heading.tz >= 0;
  const edge = forward ? base : world.reverseEdge(base);
  if (edge < 0) return fallback();
  let along = Math.hypot(road.x - world.rpx[road.seg], road.z - world.rpz[road.seg]);
  for (let i = world.eA[base]; i < road.seg; i++) {
    along += Math.hypot(world.rpx[i + 1] - world.rpx[i], world.rpz[i + 1] - world.rpz[i]);
  }
  return { node: world.eTo[edge], edge, along: forward ? along : world.eLen[edge] - along };
}

export function taxiRoute(world, from, to, maxExpand = 9000) {
  const sameEdge = from.edge === to.edge && from.along <= to.along;
  const path = sameEdge ? [] : world.findPath(from.node ?? world.eTo[from.edge], world.eFrom[to.edge],
    maxExpand, from.edge, 0, to.edge);
  if (!path) return null;
  let len = 0, seconds = 0;
  const add = (edge, length) => {
    const speed = world.roadSpeed(world.eRoad[edge], world.eA[edge] < world.eB[edge]);
    len += length;
    seconds += length / (Math.max(15, Math.min(55, speed)) / 3.6);
  };
  if (sameEdge) add(to.edge, to.along - from.along);
  else {
    if (from.edge >= 0) add(from.edge, Math.max(0, world.eLen[from.edge] - from.along));
    for (const edge of path) add(edge, world.eLen[edge]);
    add(to.edge, to.along);
  }
  return { path, sameEdge, len, seconds };
}

export function taxiFare(id, pick, drop, firstLeg, trip) {
  return { id, pick, drop, name: pick.label, label: drop.label, len: trip.len,
    pickupTime: Math.max(180, Math.ceil(firstLeg.seconds * 1.5 + 70)),
    limit: Math.ceil(trip.seconds * 1.5 + 70), reward: five(125 + trip.len * 0.15) };
}

export function taxiOffers(world, car) {
  const start = taxiRoadPosition(world, car);
  if (start.node < 0) return [];
  const stops = new Map(), approach = new Map();
  const stopFor = (place) => {
    const key = place.x + ',' + place.z;
    if (!stops.has(key)) stops.set(key, taxiStop(world, place));
    return stops.get(key);
  };
  const reach = (place) => {
    const pick = stopFor(place);
    if (!pick) return null;
    if (!approach.has(pick)) approach.set(pick, taxiRoute(world, start, pick));
    const route = approach.get(pick);
    return route && route.len <= 2200 ? { pick, route } : null;
  };
  const makeOffer = (id, origin, address) => {
    const access = reach(origin), drop = address && stopFor(address);
    if (!access || !drop || distance(access.pick, drop) < 280) return null;
    const { pick, route: firstLeg } = access;
    const trip = taxiRoute(world, pick, drop);
    if (!trip || trip.len < 400 || trip.len > 4400) return null;
    return taxiFare(id, pick, drop, firstLeg, trip);
  };
  const place = ([name, x, z]) => ({ name, x, z });
  const offers = new Map();
  for (const [id, [origin, destination]] of Object.entries(REFERENCE)) {
    const pick = place(origin);
    if (distance(car, pick) > 850) continue;
    const offer = makeOffer(id, pick, destination ? place(destination) : STATION);
    if (offer) offers.set(id, offer);
  }
  if (offers.size === Object.keys(TAXI_RIDES).length) return [...offers.values()];

  const near = [], far = [];
  const stationNearby = distance(car, STATION) < 3200;
  for (const [x, z, street, number] of world.meta.addresses) {
    const d = distance(car, { x, z });
    const name = world.meta.roadNames[street];
    if (!name || !number) continue;
    if (d > 120 && d < 850) near.push({ x, z, name: name + ' ' + number, rank: Math.abs(d - 420) });
    if (d > 950 && d < 2700) far.push({ x, z, name: name + ' ' + number, rank: Math.abs(d - 1450) });
  }
  const diverse = (list, count, spacing) => {
    const choices = [];
    list.sort((a, b) => a.rank - b.rank);
    for (const p of list) {
      if (choices.some((other) => distance(p, other) < spacing)) continue;
      choices.push(p);
      if (choices.length === count) break;
    }
    return choices;
  };
  const origins = diverse(near, 12, 75), addresses = diverse(far, 14, 170);
  const used = [...offers.values()];
  for (const id of Object.keys(TAXI_RIDES)) {
    if (offers.has(id) || (id === 'train' && !stationNearby)) continue;
    findOffer: for (const origin of origins) {
      if (!reach(origin)) continue;
      for (const destination of id === 'train' ? [STATION] : addresses) {
        const offer = makeOffer(id, origin, destination);
        if (!offer || used.some((other) => distance(other.pick, offer.pick) < 55 && distance(other.drop, offer.drop) < 55)) continue;
        offers.set(id, offer);
        used.push(offer);
        break findOffer;
      }
    }
  }
  return [...offers.values()];
}

export function atTaxiStop(car, stop, speed) {
  const dx = car.x - stop.x, dz = car.z - stop.z;
  const along = dx * stop.tx + dz * stop.tz;
  const across = dz * stop.tx - dx * stop.tz;
  return speed < 1.6 && Math.abs(car.y - stop.y) < 1.35 && Math.abs(along) < 4.5 && Math.abs(across) < 1
    && Math.sin(car.yaw) * stop.tx + Math.cos(car.yaw) * stop.tz > 0.8;
}

export function taxiBonus(job) {
  const maximum = TAXI_RIDES[job.id].bonus;
  if (job.id === 'quiet') return five(job.comfort);
  if (job.id === 'train') {
    const grace = Math.max(45, job.limit / 3);
    return five(maximum * Math.max(0, 1 + Math.min(0, job.time) / grace));
  }
  return 0;
}

export function scoreTaxiMotion(job, dt, speed) {
  const braking = dt > 0 && job.speed > 5 && job.speed - speed > 5.5 * dt;
  if (braking) {
    const duration = job.braking + dt;
    if (job.braking < 0.18 && duration >= 0.18) {
      job.comfort = Math.max(0, job.comfort - 15);
      job.hardBrakes++;
    }
    job.braking = duration;
  } else {
    job.braking = 0;
  }
  job.speed = speed;
}
