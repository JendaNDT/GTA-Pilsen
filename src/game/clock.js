// Občanský kalendář hry a převod skutečného času na místní čas v Plzni.
export const DAY_SECONDS = 86400;
export const HOUR_SECONDS = 3600;
const DAY_MS = DAY_SECONDS * 1000;
export const WEEKDAYS = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];
const pragueTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
});

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
  constructor(day) {
    if (day === undefined) this.setPrague();
    else this.set(day, 9);
  }

  set(day, hour) {
    this.followsPrague = false;
    this.day = day;
    this.seconds = hour * HOUR_SECONDS;
  }

  setTime(time) {
    const day = Math.floor(time / DAY_SECONDS);
    this.set(day, (time - day * DAY_SECONDS) / HOUR_SECONDS);
  }

  setPrague(instant = Date.now()) {
    const fields = {};
    for (const { type, value } of pragueTime.formatToParts(instant)) {
      if (type !== 'literal') fields[type] = Number(value);
    }
    const { year, month, day, hour, minute, second } = fields;
    this.followsPrague = true;
    this.day = Date.UTC(year, month - 1, day) / DAY_MS;
    this.seconds = hour * HOUR_SECONDS + minute * 60 + second + ((instant % 1000 + 1000) % 1000) / 1000;
  }

  add(seconds) {
    this.seconds += seconds;
    const days = Math.floor(this.seconds / DAY_SECONDS);
    this.day += days;
    this.seconds -= days * DAY_SECONDS;
  }

  tick(dt) { this.add(dt); }
  get hour() { return this.seconds / HOUR_SECONDS; }
  get now() { return this.day * DAY_SECONDS + this.seconds; }
}
