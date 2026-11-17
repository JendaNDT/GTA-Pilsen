import { CLOCK_RATE, DAY_SECONDS, formatTime } from './clock.js';
import { STOP_DWELL } from './timetable.js';

// Stanoviště rozlišují oba směry i jednotlivé větve v přestupních uzlech.
const RUNS = [
  ['tram', '1', '53408/3', '53167/3'], ['tram', '1', '53167/4', '53408/4'],
  ['trolleybus', '16', '53408/1', '53090/1'], ['trolleybus', '16', '53090/2', '53408/2'],
  ['bus', '30', '57061/4', '57125/2'], ['bus', '30', '57125/1', '57061/3'],
];

export const SHIFT_TYPES = { tram: 'Tramvaj', trolleybus: 'Trolejbus', bus: 'Autobus' };
export const SHIFT_LEAD = 5;

export function shiftOffers(table, clock) {
  const offers = [];
  for (const [type, ref, from, to] of RUNS) {
    const start = table.stops.findIndex((s) => s[3] === from);
    const end = table.stops.findIndex((s) => s[3] === to);
    if (start < 0 || end < 0) continue;
    let selected;
    for (let day = clock.day - table.maxOffset; day <= clock.day + 2; day++) {
      if (selected?.departure < day * DAY_SECONDS) break;
      const profile = new Set(table.profile(day));
      for (const [service, trip, first] of table.stopEntries[start]) {
        if (trip.route.type !== type || trip.route.ref !== ref || !profile.has(service)) continue;
        const departure = day * DAY_SECONDS + trip.times[first * 2 + 1];
        if (departure < clock.now + SHIFT_LEAD * CLOCK_RATE || departure >= (selected?.departure ?? Infinity)) continue;
        const last = trip.stops.findIndex(({ stop }, index) => index > first && stop === end);
        if (last < first + 2) continue;
        const part = trip.stops.slice(first, last + 1);
        if (part.some((stop, i) => i > 0 && (stop.target[0] <= part[i - 1].target[0]
            || trip.times[2 * (first + i)] < 0)) || part.slice(0, -1).some((_, i) => trip.times[2 * (first + i) + 1] < 0)) continue;
        selected = {
          id: `${type}/${ref}/${from}`, departure, first, last, type, ref,
          from: table.stops[start][0], to: table.stops[end][0], destination: trip.destination,
          event: { key: `${day}:${trip.id}`, day, trip, start: day * DAY_SECONDS + trip.start, end: day * DAY_SECONDS + trip.end },
        };
      }
    }
    if (selected) offers.push(selected);
  }
  return offers;
}

export function shiftName(offer) {
  return `${SHIFT_TYPES[offer.type]} ${offer.ref} · ${offer.from} → ${offer.to}`;
}

export function shiftStops(offer, table) {
  const { trip } = offer.event;
  const stops = [];
  for (let i = offer.first; i <= offer.last; i++) {
    const { stop, target } = trip.stops[i];
    const [name, x, z, code] = table.stops[stop];
    const s = target[0], previous = stops.at(-1);
    const publishedRide = trip.times[i * 2] - trip.times[i * 2 - 1];
    const publishedDwell = trip.times[i * 2 + 1] - trip.times[i * 2];
    // Herní den běží 45× rychleji. Cestovní čas má rezervu na fyzický průjezd a světla.
    const arrive = previous ? previous.depart + Math.max(publishedRide, ((s - previous.s) / 6.6 + 28) * CLOCK_RATE)
      : offer.departure - SHIFT_LEAD * CLOCK_RATE;
    const depart = previous ? arrive + Math.max(publishedDwell, STOP_DWELL * CLOCK_RATE) : offer.departure;
    stops.push({ i, s, name, x, z, platform: code?.split('/')[1], arrive, depart });
  }
  return stops;
}

export function shiftResult(run, terminalServed) {
  const count = run.stops.length;
  const stops = Math.round(run.served * 45 / count);
  const punctuality = Math.max(0, Math.round(20 - run.late / Math.max(1, run.served) / 4 - run.early / 3));
  const rules = Math.max(0, Math.round(25 - run.red * 7 - run.ignoredStop * 5 - run.yield * 4
    - run.speeding * 0.5 - run.safetyStops * 4));
  const comfort = Math.max(0, Math.round(10 - run.harsh * 1.6));
  const score = stops + punctuality + rules + comfort;
  const success = terminalServed && run.served >= Math.ceil(count * 0.8) && score >= 60;
  const distance = run.stops.at(-1).s - run.stops[0].s;
  const fullPay = 95 + 0.16 * distance + count * 20;
  return {
    name: shiftName(run.offer), state: success ? 'paid' : 'failed',
    note: !terminalServed ? 'Konečná bez obsluhy' : success ? '' : 'Pro výplatu je třeba 60 bodů a obsluha alespoň 80 % zastávek',
    amount: success ? Math.round(fullPay * score / 500) * 5 : 0,
    score, served: run.served, count, stops, punctuality, rules, comfort, red: run.red, ignoredStop: run.ignoredStop,
    yielding: run.yield, speeding: Math.round(run.speeding), safetyStops: run.safetyStops,
  };
}

export function shiftTime(time) {
  const date = new Date(Math.floor(time / DAY_SECONDS) * DAY_SECONDS * 1000);
  return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}. ${formatTime(time)}`;
}
