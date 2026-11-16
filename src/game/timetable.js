import { DAY_SECONDS, parseDay, weekday } from './clock.js';

const dep = (value) => value >= 0 ? value : -value - 1;

/** Služební den GTFS může přesáhnout 24:00. Instance nese datum vypravení i přes půlnoc. */
export class Timetable {
  constructor(data, routes) {
    const { calendar } = data;
    this.startDay = parseDay(calendar.start);
    this.endDay = parseDay(calendar.end);
    this.monday = parseDay(calendar.monday);
    this.calendar = calendar;
    this.stops = data.stops;
    this.byService = [];
    this.stopEntries = this.stops.map(() => []);
    this.maxOffset = 0;
    const patterns = data.patterns.map(([ri, stops, destination]) => {
      const route = routes[ri];
      if (!route || !stops.every(([, i]) => route.stops[i])) return null;
      return { route, stops: stops.map(([stop, i]) => ({ stop, target: route.stops[i] })), destination };
    });
    for (const [id, service, pattern, values] of data.trips) {
      const p = patterns[pattern];
      if (!p) continue;
      const trip = {
        id, ...p, times: values, start: dep(values[1]), end: values.at(-2),
        startS: p.stops[0].target[0], endS: p.stops.at(-1).target[0],
      };
      this.maxOffset = Math.max(this.maxOffset, Math.floor(trip.end / DAY_SECONDS));
      (this.byService[service] ??= []).push(trip);
      for (let i = 0; i + 1 < p.stops.length; i++) {
        if (values[i * 2 + 1] >= 0) this.stopEntries[p.stops[i].stop].push([service, trip, values[i * 2 + 1]]);
      }
    }
    this.dayCache = new Map();
  }

  profile(day) {
    const { days, weekly, profiles } = this.calendar;
    return profiles[day >= this.startDay && day <= this.endDay ? days[day - this.startDay] : weekly[weekday(day)]];
  }

  events(day) {
    if (!this.dayCache.has(day)) {
      const events = [];
      for (let dayFrom = day - this.maxOffset; dayFrom <= day; dayFrom++) {
        const midnight = dayFrom * DAY_SECONDS;
        for (const service of this.profile(dayFrom)) for (const trip of this.byService[service] ?? []) {
          const end = midnight + trip.end;
          if (end > day * DAY_SECONDS) events.push({ key: `${dayFrom}:${trip.id}`, day: dayFrom,
            start: midnight + trip.start, end, trip });
        }
      }
      events.sort((a, b) => a.start - b.start);
      this.dayCache.set(day, events);
      if (this.dayCache.size > 3) this.dayCache.delete(this.dayCache.keys().next().value);
    }
    return this.dayCache.get(day);
  }

  position(event, now) {
    const { trip, day } = event;
    const elapsed = now - day * DAY_SECONDS, { times, stops } = trip;
    for (let i = 1; i < stops.length; i++) {
      if (elapsed >= times[i * 2]) {
        if (elapsed < dep(times[i * 2 + 1])) return stops[i].target[0];
        continue;
      }
      const start = dep(times[i * 2 - 1]), a = stops[i - 1].target[0];
      const t = Math.max(0, (elapsed - start) / Math.max(1, times[i * 2] - start));
      return a + (stops[i].target[0] - a) * t;
    }
    return trip.endS;
  }

  departures(x, z, clock) {
    let station = -1, dist = 55 ** 2;
    for (let i = 0; i < this.stops.length; i++) {
      const [, sx, sz] = this.stops[i];
      const d = (x - sx) ** 2 + (z - sz) ** 2;
      if (d < dist && this.stopEntries[i].length) { dist = d; station = i; }
    }
    if (station < 0) return null;
    const now = clock.now, edge = now + 90 * 60, rows = [];
    for (let day = clock.day - this.maxOffset; day <= Math.floor(edge / DAY_SECONDS); day++) {
      const active = new Set(this.profile(day));
      for (const [service, trip, seconds] of this.stopEntries[station]) {
        const time = day * DAY_SECONDS + seconds;
        if (time >= now && time < edge && active.has(service)) {
          rows.push({ time, ref: trip.route.ref, destination: trip.destination });
        }
      }
    }
    rows.sort((a, b) => a.time - b.time || a.ref.localeCompare(b.ref));
    return { stop: this.stops[station][0], rows: rows.slice(0, 3) };
  }
}
