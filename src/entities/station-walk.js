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

// V okolí příjezdu necháme ve stávajícím rozpočtu jedno místo pro vystupujícího.
export function nearStationPlatform(x, z) {
  return (x - path[0][0]) ** 2 + (z - path[0][1]) ** 2 < 145 ** 2;
}

export function walksToStation(vehicle, platformCode) {
  return platformCode === '53408/2' && vehicle.route.type === 'trolleybus' &&
    vehicle.route.ref === '49' && vehicle.stopIndex === vehicle.stops.length - 1;
}

export function stepStationWalk(person, dt) {
  const [x, z] = path[person.stationWaypoint];
  if (stepTo(person, x, z, dt)) person.stationWaypoint++;
  return person.stationWaypoint === path.length;
}
