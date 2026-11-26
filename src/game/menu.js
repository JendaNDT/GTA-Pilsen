import { readSave } from './save-data.js';
import { RC } from '../config.js';
import { jobTitle } from './missions.js';

const el = id => document.getElementById(id);
const sections = ['rides', 'jobs', 'garage', 'shifts', 'help', 'about', 'settings', 'save'];

function locationName(world, { x, z }) {
  const road = world.nearestRoad(x, z, 45, RC.PEDESTRIAN);
  const street = road && world.roadNames[world.r.name[road.road]];
  return [street, world.districtAt(x, z)].filter(Boolean).join(' · ') || 'Okolí Plzně';
}

export function menuObjective({ activities, jobs, shifts }) {
  if (activities?.active) return activities.title;
  if (shifts.active) {
    if (shifts.active.pending) return 'Uzavři výsledek v nabídce Směny MHD.';
    return `Linka ${shifts.active.offer.ref} · ${shifts.stop.name}`;
  }
  const job = jobs.job;
  if (job?.pending) return 'V nabídce Zakázky můžeš znovu uložit odměnu.';
  const target = jobs.target();
  if (!job) return target?.name ? 'Cíl na mapě · ' + target.name : '';
  const name = job.phase === 'pickup' ? job.name : target?.label || target?.name || job.label;
  return [jobTitle(job), name].filter(Boolean).join(' · ');
}

export function initMenu(game, updateWork, showClock) {
  let section = null;
  const refresh = () => {
    const paused = el('menu').dataset.screen === 'pause';
    const place = locationName(game.world, game.focus);
    const label = el('menu-location');
    label.hidden = !paused && !game.hasSave;
    label.textContent = paused ? place : 'Poslední poloha · ' + place;
    if (section === 'save') {
      const saved = readSave();
      const position = Number.isFinite(saved?.x) && Number.isFinite(saved.z) ? saved : game.focus;
      el('save-location').textContent = saved ? 'Uložená poloha · ' + locationName(game.world, position) : 'Zatím nemáš uloženou hru.';
    }
    const objective = el('menu-objective');
    objective.textContent = paused ? menuObjective(game) : '';
    objective.hidden = !objective.textContent;
  };
  function select(next) {
    const previous = section;
    section = next;
    for (const name of sections) {
      const visible = name === section;
      el('panel-' + name).classList.toggle('hidden', !visible);
      el('btn-' + name).setAttribute('aria-expanded', String(visible));
    }
    el('menu-sheet').hidden = !section;
    refresh();
    if (section) {
      if (['jobs', 'garage', 'shifts'].includes(section)) updateWork(section);
      if (section === 'settings') showClock();
      if (section === 'rides') el('ride-feedback').textContent = '';
      el('menu-sheet').scrollTop = 0;
      el('menu-back').focus({ preventScroll: true });
      el('menu-sheet').scrollIntoView({ block: 'start' });
    } else if (previous) {
      el('btn-' + previous).focus();
    }
  }
  for (const name of sections) {
    el('btn-' + name).onclick = () => select(section === name ? null : name);
  }
  el('menu-back').onclick = () => select(null);
  return {
    show(paused) {
      el('menu').dataset.screen = paused ? 'pause' : 'start';
      el('menu-title').innerHTML = paused ? 'Pauza' : 'Plzeň <span>naplno</span>';
      el('btn-play').textContent = paused ? 'Zpět do hry' : game.hasSave ? 'Pokračovat' : 'Hrát';
      el('btn-map').hidden = !paused;
      select(null);
      el('menu-card').scrollTop = 0;
      el('btn-play').focus({ preventScroll: true });
    },
    back() {
      if (!section) return false;
      select(null);
      return true;
    },
    refresh
  };
}
