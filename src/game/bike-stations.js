export const BIKE_COLOR = '#91e57d';

// Záznam stanovišť z veřejného GBFS Pilsen Bike. Souřadnice se převádějí až v herním světě.
export const BIKE_STATIONS = [
  { id: '43', name: 'Západočeské muzeum', lat: 49.744827, lon: 13.378635, capacity: 10, yaw: Math.PI * 0.52 },
  { id: '57', name: 'DEPO 2015', lat: 49.738721, lon: 13.383591, capacity: 5, yaw: -0.11 },
];

export function loadBikeStock(stations, saved) {
  return Object.fromEntries(stations.map(({ id, capacity }) => {
    const count = saved?.stock?.[id];
    const parked = Number.isSafeInteger(count) && count >= 0 && count <= capacity ? count : 1;
    return [id, Math.min(capacity, parked + Number(saved?.origin === id && parked === count))];
  }));
}
