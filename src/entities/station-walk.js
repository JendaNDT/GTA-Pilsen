import { DAY_SECONDS } from '../game/clock.js';
import { stationPaving } from '../world/station-forecourt.js';
import { stepTo } from './pedestrian-walks.js';

// Osy pěších cest v distribuovaném OSM: jižní chodník Šumavské, pěšina k Mikulášské
// a spodní předprostor. Před budovou 96864 se pěšina vyhne jejímu koliznímu obrysu.
const path = [
  [742.1, 341.1], [709.5, 355.7], [695.2, 359.9], [683.7, 365.5],
  [682, 378.2], [680, 392.2], [677.6, 406], [672.5, 415.4], [669.2, 419.1],
  [647.1, 440.9], [618.1, 461], [620.8, 504.6], [622.3, 506.8], [624.4, 506.9],
  [651, 495.7], [658, 488.7], [670, 483.7], [677, 484.8], [686.4, 480.9],
  [691.1, 479.5], [702, 480], [708, 482], [716, 486.3],
  stationPaving.origin.map((v, i) => v + 0.8 * stationPaving.axisX[i]),
];

export const stationEntrance = path.at(-1);

// Ze společné pěšiny odbočíme v Šumavské přes vozovku na odjezdovou stranu.
const from = path[2], to = [690.5, 347.1];
const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
const crossing = {
  a: from, b: to, x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2,
  dx: (to[0] - from[0]) / length, dz: (to[1] - from[1]) / length, length, unmarked: true,
};
const outbound = [...path.slice(2, -1).reverse(), to, [700.1, 342.6], [707.3, 337.4]];

// Směr prvního úseku odjezdové 49 v Šumavské, odvozený z osy dodané trasy.
export const departureHeading = { tx: -0.9113, tz: 0.4117 };

// Nástupní prostor od zadní části trolejbusu až před jeho přední dveře.
export function blocksDeparturePlatform(x, z, yaw, carLength, carWidth) {
  const [px, pz] = outbound.at(-1);
  const dx = x - px, dz = z - pz;
  if (Math.abs(dx) > 30 || Math.abs(dz) > 30) return false;
  const { tx, tz } = departureHeading;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const parallel = Math.abs(fx * tx + fz * tz), across = Math.abs(fx * tz - fz * tx);
  const halfLength = (carLength * parallel + carWidth * across) / 2;
  const halfWidth = (carLength * across + carWidth * parallel) / 2;
  const along = dx * tx + dz * tz, side = dx * tz - dz * tx;
  return along + halfLength > -16 && along - halfLength < 9 &&
    side + halfWidth > -1 && side - halfWidth < 8;
}

export function stationTicket(timetable, station, clock) {
  let ticket = null;
  const earliest = clock.now + 305, latest = clock.now + 420;
  for (let day = clock.day - timetable.maxOffset; day <= Math.floor(latest / DAY_SECONDS); day++) {
    const services = timetable.profile(day);
    for (const [service, trip, index] of timetable.stopEntries[station] ?? []) {
      if (index !== 0 || trip.route.ref !== '49' || trip.route.type !== 'trolleybus' || !services.includes(service)) continue;
      const time = day * DAY_SECONDS + trip.times[1];
      if (time < earliest || time > latest || (ticket && time >= ticket.time)) continue;
      ticket = { station, ref: '49', kind: 'trolleybus', destination: trip.destination, time, eventKey: day + ':' + trip.id };
    }
  }
  return ticket;
}

// V okolí příjezdu necháme ve stávajícím rozpočtu jedno místo pro vystupujícího.
export function nearStationPlatform(x, z) {
  return (x - path[0][0]) ** 2 + (z - path[0][1]) ** 2 < 145 ** 2;
}

export function walksToStation(vehicle, platformCode) {
  return platformCode === '53408/2' && vehicle.route.type === 'trolleybus' &&
    vehicle.route.ref === '49' && vehicle.stopIndex === vehicle.stops.length - 1;
}

export function stepStationWalk(person, dt) {
  const points = person.ticket?.eventKey ? outbound : path;
  const point = points[person.stationWaypoint];
  if (!stepTo(person, point[0], point[1], dt)) return false;
  person.stationWaypoint++;
  if (points === outbound && point === from) {
    person.crossing = { crossing, from, to };
    person.state = 'crossApproach';
  }
  return person.stationWaypoint === points.length;
}
