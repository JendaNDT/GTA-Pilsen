import { DAY_SECONDS, parseDay, weekday } from './clock.js';

const timeValue = (value) => value >= 0 ? value : -value - 1;
export const STOP_DWELL = 5;
const APPROACH_SPEED = 8;
const CELL = 128;

function cell(x, z) { return `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`; }

/** Šablony spojů zachovávají datum vypravení i pro časy po 24:00. */
export class Timetable {
  constructor(data, routes = data.routes) {
    const { calendar } = data;
    this.startDay = parseDay(calendar.start);
    this.endDay = parseDay(calendar.end);
    this.monday = parseDay(calendar.monday);
    this.calendar = calendar;
    this.stops = data.stops;
    this.byService = [];
    this.stopEntries = this.stops.map(() => []);
    this.stopGrid = new Map();
    this.transfers = this.stops.map(() => []);
    this.maxOffset = 0;
    for (const [i, [, x, z]] of this.stops.entries()) {
      const key = cell(x, z);
      if (!this.stopGrid.has(key)) this.stopGrid.set(key, []);
      this.stopGrid.get(key).push(i);
    }
    for (const [from, to, minimum] of data.transfers ?? []) this.transfers[from].push({ to, minimum });
    const patterns = data.patterns.map(([ri, stops, destination, direction, entry, exit]) => {
      const route = routes[ri];
      if (!route || stops.length < 2 || !stops.every(([, i]) => route.stops[i])) return null;
      return { route, stops: stops.map(([stop, i]) => ({ stop, target: route.stops[i] })),
        destination, direction, entry, exit };
    });
    for (const [id, service, pattern, values] of data.trips) {
      const p = patterns[pattern];
      if (!p) continue;
      const startS = p.stops[0].target[0], lastS = p.stops.at(-1).target[0];
      const endS = p.exit ? p.route.length : lastS;
      const firstDeparture = timeValue(values[1]), lastArrival = timeValue(values.at(-2));
      const trip = {
        id, ...p, times: values, startS, lastS, endS,
        start: firstDeparture - STOP_DWELL - Math.round(p.entry ? startS / APPROACH_SPEED : 0),
        end: lastArrival + STOP_DWELL + Math.round((endS - lastS) / APPROACH_SPEED),
      };
      this.maxOffset = Math.max(this.maxOffset, Math.floor(trip.end / DAY_SECONDS));
      (this.byService[service] ??= []).push(trip);
      for (let i = 0; i + 1 < p.stops.length; i++) {
        if (values[i * 2 + 1] >= 0) this.stopEntries[p.stops[i].stop].push([service, trip, i]);
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
      for (let dayFrom = day - this.maxOffset; dayFrom <= day + 1; dayFrom++) {
        const midnight = dayFrom * DAY_SECONDS;
        for (const service of this.profile(dayFrom)) for (const trip of this.byService[service] ?? []) {
          const start = midnight + trip.start, end = midnight + trip.end;
          if (start < (day + 1) * DAY_SECONDS && end > day * DAY_SECONDS) {
            events.push({ key: `${dayFrom}:${trip.id}`, day: dayFrom, start, end, trip });
          }
        }
      }
      events.sort((a, b) => a.start - b.start);
      this.dayCache.set(day, events);
      if (this.dayCache.size > 3) this.dayCache.delete(this.dayCache.keys().next().value);
    }
    return this.dayCache.get(day);
  }

  /** Vzdálenost a stav dveří při prvním zobrazení vozu. Mimo dohled stačí plánovaná poloha. */
  state(event, now) {
    const { trip, day } = event, { stops, times } = trip;
    const elapsed = now - day * DAY_SECONDS;
    const firstDeparture = timeValue(times[1]);
    if (elapsed < firstDeparture) {
      const opening = firstDeparture - STOP_DWELL;
      if (trip.entry && elapsed < opening) {
        return { s: trip.startS * Math.max(0, (now - event.start) / (opening - trip.start)), index: 0, wait: 0 };
      }
      return { s: trip.startS, index: 0, wait: firstDeparture - elapsed };
    }
    let previousRelease = firstDeparture;
    for (let i = 1; i < stops.length; i++) {
      const arrival = timeValue(times[i * 2]), departure = timeValue(times[i * 2 + 1]);
      const s = stops[i].target[0];
      const end = i === stops.length - 1;
      const toNext = end ? 0 : timeValue(times[(i + 1) * 2]) - arrival;
      const release = end ? arrival + STOP_DWELL
        : Math.max(arrival + Math.max(1, Math.min(STOP_DWELL, toNext * 0.45)), departure);
      if (elapsed >= release) { previousRelease = release; continue; }
      if (elapsed >= arrival) return { s, index: i, wait: release - elapsed };
      const start = previousRelease, a = stops[i - 1].target[0];
      const progress = Math.max(0, (elapsed - start) / Math.max(1, arrival - start));
      return { s: a + (s - a) * progress, index: i, wait: 0 };
    }
    const exitDuration = (trip.endS - trip.lastS) / APPROACH_SPEED;
    const progress = Math.max(0, Math.min(1, (elapsed - (trip.end - exitDuration)) / Math.max(1, exitDuration)));
    return { s: trip.lastS + (trip.endS - trip.lastS) * progress, index: stops.length, wait: 0 };
  }

  position(event, now) { return this.state(event, now).s; }

  nearest(x, z, radius = 55) {
    let selected = -1, distance = radius ** 2;
    for (const [i, sx, sz] of this.nearby(x, z, radius)) {
      const d = (x - sx) ** 2 + (z - sz) ** 2;
      if (d < distance) { selected = i; distance = d; }
    }
    return selected;
  }

  *nearby(x, z, radius) {
    for (let a = Math.floor((x - radius) / CELL); a <= Math.floor((x + radius) / CELL); a++) {
      for (let b = Math.floor((z - radius) / CELL); b <= Math.floor((z + radius) / CELL); b++) {
        for (const i of this.stopGrid.get(`${a}:${b}`) ?? []) {
          const [, sx, sz] = this.stops[i];
          if ((x - sx) ** 2 + (z - sz) ** 2 <= radius ** 2) yield [i, sx, sz];
        }
      }
    }
  }

  departures(x, z, clock, horizon = 90 * 60, live) {
    const station = this.nearest(x, z);
    return station < 0 ? null : this.departuresAt(station, clock, horizon, live);
  }

  departuresAt(station, clock, horizon = 90 * 60, live) {
    const now = clock.now, edge = now + horizon, rows = [];
    for (let day = clock.day - this.maxOffset - Number(Boolean(live)); day <= Math.floor(edge / DAY_SECONDS); day++) {
      const active = new Set(this.profile(day));
      for (const [service, trip, index] of this.stopEntries[station]) {
        if (!active.has(service)) continue;
        const planned = day * DAY_SECONDS + trip.times[index * 2 + 1];
        const vehicle = live?.get(`${day}:${trip.id}`);
        const estimate = vehicle?.visible || vehicle?.waitingForSpace ? this.estimate(vehicle, index, now, planned) : null;
        if (estimate === false || !estimate && (planned < now || planned >= edge)) continue;
        const time = estimate?.time ?? planned;
        if (time >= edge) continue;
        rows.push({ time, ref: trip.route.ref, type: trip.route.type, destination: trip.destination,
          lastStop: trip.exit ? trip.stops.at(-1).target[1] : null, boarding: estimate?.boarding ?? false,
          delayed: time - planned >= 60 });
      }
    }
    rows.sort((a, b) => Number(b.boarding) - Number(a.boarding) || a.time - b.time || a.ref.localeCompare(b.ref));
    const [stop, x, z, code] = this.stops[station];
    const nearby = live ? this.transfers[station]
      .map(({ to, minimum }) => {
        const [name, sx, sz, sign] = this.stops[to];
        return { name, platform: sign?.split('/')[1], metres: Math.round(Math.hypot(sx - x, sz - z)), minimum };
      })
      .filter(({ name, metres, platform }) => metres <= 220 && metres > 8 && (name !== stop || platform))
      .sort((a, b) => a.minimum - b.minimum || a.metres - b.metres)[0] : undefined;
    return { stop, code, nearby, rows: rows.slice(0, live ? 5 : 3) };
  }

  estimate(vehicle, index, now, planned) {
    const { stopIndex, s, doorsOpen, wait, event: { trip } } = vehicle;
    if (index < stopIndex) return false;
    if (index === stopIndex && vehicle.visible && doorsOpen) {
      return { time: Math.max(planned, now + wait), boarding: true };
    }
    const remaining = Math.max(0, trip.stops[index].target[0] - s);
    const dwell = (index - stopIndex) * STOP_DWELL + Math.max(STOP_DWELL, wait);
    return { time: Math.max(planned, now + remaining / APPROACH_SPEED + dwell) };
  }
}
