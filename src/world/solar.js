const DEG = Math.PI / 180;
const MINUTES_PER_DAY = 24 * 60;
const DAY_MS = 86400000;
const LATITUDE = 49.7475 * DEG;
const LONGITUDE = 13.3776;
const cosLatitude = Math.cos(LATITUDE), sinLatitude = Math.sin(LATITUDE);
const pragueTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague', hour: 'numeric', hourCycle: 'h23',
});

/** Posun občanského času pro herní den, který má vždy 24 hodin. */
export function pragueOffset(day) {
  return Number(pragueTime.format((day + 0.5) * DAY_MS)) - 12;
}

/** Směr od pozorovatele ke slunci. X míří na východ, Z na jih. */
export function solarDirection(day, hour, utcOffset = pragueOffset(day)) {
  const date = new Date(day * DAY_MS);
  const year = date.getUTCFullYear();
  date.setUTCMonth(0, 1);
  const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
  // Roční členy a časová rovnice podle NOAA General Solar Position Calculations.
  const yearAngle = 2 * Math.PI / daysInYear * (day - date.getTime() / DAY_MS + (hour - utcOffset - 12) / 24);
  const c = Math.cos(yearAngle), s = Math.sin(yearAngle);
  const c2 = Math.cos(2 * yearAngle), s2 = Math.sin(2 * yearAngle);
  const equation = 229.18 * (0.000075 + 0.001868 * c - 0.032077 * s - 0.014615 * c2 - 0.040849 * s2);
  const declination = 0.006918 - 0.399912 * c + 0.070257 * s - 0.006758 * c2 + 0.000907 * s2
    - 0.002697 * Math.cos(3 * yearAngle) + 0.00148 * Math.sin(3 * yearAngle);
  const hourAngle = ((hour - utcOffset) * 60 + equation + 4 * LONGITUDE - MINUTES_PER_DAY / 2) * DEG / 4;
  const cosDeclination = Math.cos(declination), sinDeclination = Math.sin(declination);
  const meridian = cosDeclination * Math.cos(hourAngle);
  return [
    -cosDeclination * Math.sin(hourAngle),
    sinLatitude * sinDeclination + cosLatitude * meridian,
    sinLatitude * meridian - cosLatitude * sinDeclination,
  ];
}

export function skyProbeDue(minutes, directionDot) {
  return Math.abs(minutes) >= 10 || directionDot < Math.cos(2 * DEG);
}
