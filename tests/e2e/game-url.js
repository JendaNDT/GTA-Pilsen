import { test } from '@playwright/test';

// Pondělí v 10.00 jako ve zkouškách provozu. Doplní se jen tehdy, když adresa nastavuje
// hodinu bez data nebo datum bez hodiny; chybějící část by hra jinak vzala z hodin počítače.
export const TEST_DATE = '2026-11-09';
export const TEST_HOUR = '10';

// Hra bez parametru `weather` losuje počasí podle herního času po tříhodinových úsecích.
// Na sněhu klesne přilnavost kol až na 0,35, takže by výsledek zkoušky závisel na chvíli
// spuštění. Proto má každá zkouška jasno. Zkouška, která počasí ověřuje záměrně, ho nastaví
// v adrese sama (`weather=snow`, `weather=rain` …). Volba `{ weather: null }` ponechá
// proměnlivé počasí podle herního data, například u referenčních pohledů.
export function gameUrl(path, { defaultRenderer = false, weather = 'clear', seed = 1 } = {}) {
  const { name, use } = test.info().project;
  const url = new URL(path, use.baseURL);
  const params = url.searchParams;
  if (seed !== null && !params.has('seed')) params.set('seed', seed);
  if (weather && !params.has('weather')) params.set('weather', weather);
  if (params.has('hour') && !params.has('date')) params.set('date', TEST_DATE);
  if (params.has('date') && !params.has('hour')) params.set('hour', TEST_HOUR);
  if (!defaultRenderer && name === 'webgl2') params.set('renderer', 'webgl');
  return url.href;
}
