import { validGolfRecord } from './minigolf-rules.js';
import { validBowlingRecord } from './bowling-rules.js';

export const SAVE_KEY = 'plzen-naplno-v1';

function activity(value) {
  if (!value || typeof value !== 'object') return null;
  // Souhrny přerušených zakázek a směn obsahují jen text a číselné výsledky.
  const last = value.last && Object.fromEntries(Object.entries(value.last).filter(([, v]) =>
    typeof v === 'string' || Number.isFinite(v)));
  return { active: typeof value.active === 'string' ? value.active : null, last };
}

export function parseSave(raw) {
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (s?.v !== 1 && s?.v !== 2) return null;
  const counters = s.stats && typeof s.stats === 'object' && !Array.isArray(s.stats) ? s.stats : {};
  const stats = Object.fromEntries(Object.entries(counters).filter(([, value]) =>
    Number.isSafeInteger(value) && value >= 0));
  if (!validGolfRecord(stats.minigolfBest)) delete stats.minigolfBest;
  if (!validBowlingRecord(stats.bowlingBest)) delete stats.bowlingBest;
  const pursuit = s.pursuit;
  return {
    ...s,
    pursuit: Number.isInteger(pursuit?.stars) && pursuit.stars >= 1 && pursuit.stars <= 5 &&
      typeof pursuit.reason === 'string' && pursuit.reason.length > 0 && pursuit.reason.length <= 100
      ? { stars: pursuit.stars, reason: pursuit.reason, serious: pursuit.serious === true } : null,
    money: Number.isSafeInteger(s.money) && s.money >= 0 ? s.money : 500,
    stats,
    found: Array.isArray(s.found) ? s.found.filter(name => typeof name === 'string') : [],
    car: typeof s.car?.model === 'string' ? s.car : null,
    job: activity(s.job), shift: activity(s.shift),
    activity: typeof s.activity === 'string' ? s.activity : null,
  };
}

export function readSave() {
  try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
