import { normalizeSearchText } from './search-text.js';
import stands from './taxi-stops.json' with { type: 'json' };
import { taxiFare, taxiRoadPosition, taxiRoute } from './taxi.js';

export const TAXI_STANDS = [...stands].sort((a,b) => a.area.localeCompare(b.area, 'cs') || a.label.localeCompare(b.label, 'cs'));

const searchKeys = TAXI_STANDS.map(stand => normalizeSearchText(stand.area + ' ' + stand.label));

export function taxiDestinations(query, pickup) {
  const words = normalizeSearchText(query).split(' ');
  return TAXI_STANDS.filter((stand, index) => stand !== pickup &&
    words.every(word => searchKeys[index].includes(word)));
}

function stopAt(world, stand) {
  const { edge, along } = stand;
  const half = world.r.w[world.eRoad[edge]] / 2;
  const point = world.edgePoint(edge, along, Math.max(1.2, half - 1), {});
  const waiting = world.edgePoint(edge, along, half + .85, {});
  return { ...point, y: world.groundY(point.x,point.z), edge, along, waiting,
    label: stand.area === stand.label ? stand.area : stand.area + ' · ' + stand.label };
}

export function regionalPickup(world, car) {
  const start = taxiRoadPosition(world,car);
  if (start.node < 0) return null;
  const distance = stand => Math.hypot(stand.x-car.x,stand.z-car.z);
  const nearby = [...TAXI_STANDS].sort((a,b) => distance(a)-distance(b));
  for (const stand of nearby) {
    const pick = stopAt(world,stand);
    const approach = taxiRoute(world,start,pick,world.edgeCount);
    if (approach) return { stand, pick, approach };
  }
  return null;
}

export function regionalOffer(world, origin, destination) {
  if (!origin || !destination || origin.stand === destination) return null;
  const drop = stopAt(world,destination);
  const trip = taxiRoute(world,origin.pick,drop,world.edgeCount);
  if (!trip || trip.len < 100) return null;
  return { ...taxiFare('regular',origin.pick,drop,origin.approach,trip), regional: true };
}
