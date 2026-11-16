// Občanský kalendář hry. Každý herní den má 24 hodin a trvá 32 minut aktivní hry.
export const DAY_SECONDS = 86400;
export const HOUR_SECONDS = 3600;
const SPEED = 45;
const DAY_MS = DAY_SECONDS * 1000;
export const WEEKDAYS = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];

export function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(milliseconds) || formatDay(milliseconds / DAY_MS) !== value) return null;
  return milliseconds / DAY_MS;
}

export function formatDay(day) { return new Date(day * DAY_MS).toISOString().slice(0, 10); }
export function weekday(day) { return ((day + 3) % 7 + 7) % 7; }

export function formatTime(seconds) {
  const inDay = seconds % DAY_SECONDS;
  const minute = Math.floor((inDay < 0 ? inDay + DAY_SECONDS : inDay) / 60);
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export class GameClock {
  constructor(day) { this.set(day, 9); }

  set(day, hour) {
    this.day = day;
    this.seconds = hour * HOUR_SECONDS;
  }

  add(seconds) {
    this.seconds += seconds;
    const days = Math.floor(this.seconds / DAY_SECONDS);
    this.day += days;
    this.seconds -= days * DAY_SECONDS;
  }

  tick(dt) { this.add(dt * SPEED); }
  get hour() { return this.seconds / HOUR_SECONDS; }
  get now() { return this.day * DAY_SECONDS + this.seconds; }
}
