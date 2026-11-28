import { walksToStation } from './station-walk.js';
import { RC } from '../config.js';
import { stepTo } from './pedestrian-walks.js';

function doorPoint(v, lateral, behind = 0) {
  const mesh = v.doorsOpen && v.meshes?.[0];
  if (mesh) {
    const tx = Math.sin(mesh.rotation.y), tz = Math.cos(mesh.rotation.y);
    const along = v.sections[0].doors[0] - behind;
    return { x: mesh.position.x + tx * along - tz * lateral, z: mesh.position.z + tz * along + tx * lateral, tx, tz };
  }
  const section = v.sections[0];
  const s = v.stops[v.stopIndex][0] - section.length / 2 + section.doors[0] - behind;
  const side = v.berth?.index === v.stopIndex ? v.lane + v.berth.extra : v.side;
  return v.route.posAt(s, side + lateral, {});
}

export function passengerMatches(person, v) {
  const ticket = person.ticket;
  return ticket && ticket.station === v.event.trip.stops[v.stopIndex]?.stop &&
    ticket.ref === v.route.ref && ticket.kind === v.route.type && ticket.destination === v.destination;
}

// Pěší se po výstupu napojí na chodník na stejné straně silnice.
function sidewalk(world, point) {
  const road = world.nearestRoad(point.x, point.z, 14, RC.LIVING, RC.PRIMARY);
  if (!road) return null;
  const direction = road.dx * point.tx + road.dz * point.tz >= 0 ? 1 : -1;
  const route = world.traffic.locate(road.road, point.x, point.z, direction) ??
    world.traffic.locate(road.road, point.x, point.z, 1);
  if (!route) return null;
  const side = (point.z - route.z) * route.tx - (point.x - route.x) * route.tz;
  return { edge: route.edge, s: route.s, side: Math.sign(side || 1) * (world.r.w[road.road] / 2 + 1.75) };
}

function gatherPassengers(manager, v, focus, capacity, queue) {
  const { peds, world } = manager, { trip } = v.event;
  const index = v.stopIndex, stop = v.stops[index], station = trip.stops[index].stop;
  if (stop[0] - v.s < 2 || queue.length >= 3 || index === v.stops.length - 1 || trip.times[index * 2 + 1] < 0) return;
  const place = doorPoint(v, 3.6, 1.0 + queue.length * 1.2);
  if (world.blocked(place.x, place.z, 0.42) || world.isWater(place.x, place.z)) return;
  const walker = peds.find(p => {
    const dx = p.x - place.x, dz = p.z - place.z;
    return p.state === 'walk' && !p.trip && p.stationWaypoint === undefined && p.edge >= 0 && !p.platformCooldown &&
      Math.hypot(dx, dz) < 10 && Math.abs(p.y - v.y) < 3 && dz * place.tx - dx * place.tz > -1.2;
  });
  let p = walker;
  if (!p && peds.length < capacity - 1 && Math.hypot(place.x - focus.x, place.z - focus.z) > 38) {
    const road = sidewalk(world, place);
    if (road) p = Object.assign(manager._person(place.x, place.z), road);
  }
  if (p) {
    p.ticket = { station, kind: v.route.type, ref: v.route.ref, destination: v.destination };
    p.goal = place;
    p.state = 'platform';
    p.timer = 90;
  }
}

export function servicePlatform(manager, v, focus, capacity) {
  const index = v.stopIndex, stop = v.stops[index];
  if (!v.visible || !stop || Math.abs(stop[0] - v.s) > 95) return;
  const platform = doorPoint(v, 3.6);
  if (Math.hypot(platform.x - focus.x, platform.z - focus.z) > 145) return;
  const { peds, world } = manager;
  const queue = peds.filter(p => p.state === 'platform' && passengerMatches(p, v));
  if (!v.doorsOpen) {
    gatherPassengers(manager, v, focus, capacity, queue);
    return;
  }

  if (v.doorFraction < 0.85) return;
  const door = doorPoint(v, 1.38);
  if (v.exchangeIndex !== index) {
    v.exchangeIndex = index;
    v.leaving = v.canAlight ? Math.min(v.passengerCount, index === v.stops.length - 1 ? Infinity : 1) : 0;
  }
  if (peds.some(p => p.service === v && (p.state === 'alight' || p.state === 'board'))) return;
  // Pokud se další postava do rozpočtu nevejde, proběhne výstup jen v počtu cestujících.
  if (v.leaving > 0 && peds.length >= capacity) {
    v.passengerCount -= v.leaving;
    v.leaving = 0;
  }
  if (v.leaving > 0) {
    const road = sidewalk(world, platform);
    v.leaving--;
    v.passengerCount--;
    if (road && !world.blocked(platform.x, platform.z, 0.4)) {
      const p = Object.assign(manager._person(door.x, door.z), road);
      Object.assign(p, { state: 'alight', service: v, goal: platform });
      const platformCode = manager.game.transit.timetable.stops[v.event.trip.stops[index].stop][3];
      if (walksToStation(v, platformCode)) p.stationWaypoint = 0;
      v.wait = Math.max(v.wait, 2.5);
      return;
    }
  }
  const next = v.canBoard && queue.find(p => Math.hypot(p.x - door.x, p.z - door.z) <= 6);
  if (next) {
    Object.assign(next, { state: 'board', service: v, goal: door });
    v.wait = Math.max(v.wait, 0.45 + Math.hypot(next.x - door.x, next.z - door.z) / next.speed);
  }
}

export function stepPassenger(p, dt) {
  if (p.state === 'platform') {
    p.timer -= dt;
    if (p.timer <= 0) { p.ticket = null; p.state = 'walk'; return 0; }
  } else if (!p.service?.visible || !p.service.doorsOpen) {
    p.service = null; p.ticket = null; p.state = 'walk';
    return 0;
  }
  if (!stepTo(p, p.goal.x, p.goal.z, dt)) return p.speed;
  if (p.state === 'board') {
    p.service.passengerCount++;
    p.state = 'aboard';
  } else if (p.state === 'alight') {
    p.state = 'walk'; p.platformCooldown = 15; p.service = null;
  } else p.yaw = Math.atan2(p.goal.tz, -p.goal.tx);
  return 0;
}
