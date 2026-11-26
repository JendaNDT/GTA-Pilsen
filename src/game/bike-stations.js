import network from './bike-stations-data.json' with { type: 'json' };

export const BIKE_COLOR = '#91e57d';
export const BIKE_STATION_ALIASES = ['Pilsen Bike', 'sdílená kola', 'elektrokolo'];
export const BIKE_STATIONS = network.stations;
export const BIKE_LICENSE = network.license;

export function loadBikeStock(stations, saved) {
  return Object.fromEntries(stations.map(({ id, capacity }) => {
    const count = saved?.stock?.[id];
    const parked = Number.isSafeInteger(count) && count >= 0 && count <= capacity ? count : 1;
    return [id, Math.min(capacity, parked + Number(saved?.origin === id && parked === count))];
  }));
}
