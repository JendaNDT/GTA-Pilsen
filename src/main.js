// Start hry: načtení dat, menu a hlavní smyčka.
import * as THREE from 'three';
import { loadAll } from './data.js';
import { Game } from './game/game.js';
import { initInput, input } from './game/input.js';
import { QUALITY, IS_TOUCH, IS_MOBILE, DEBUG, PARAMS } from './config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const loadText = $('loadtext');
const bar = document.querySelector('#bar i');

const HELP_HTML = IS_TOUCH ? `
  <h3>Ovládání na dotykové obrazovce</h3>
  <table>
    <tr><td>Páčka vlevo</td><td>chůze, zatáčení autem</td></tr>
    <tr><td>▲ / ▼</td><td>plyn / brzda a zpátečka (ve vrtulníku nahoru / dolů)</td></tr>
    <tr><td>⎵</td><td>ruční brzda, pěšky skok</td></tr>
    <tr><td>F</td><td>nastoupit / vystoupit (auto, tramvaj, vrtulník)</td></tr>
    <tr><td>✉</td><td>vzít nebo zrušit zakázku na rozvoz jídla</td></tr>
    <tr><td>🗺</td><td>velká mapa (klepnutím nastavíš cíl)</td></tr>
    <tr><td>Tah prstem</td><td>otáčení kamery</td></tr>
  </table>` : `
  <h3>Ovládání</h3>
  <table>
    <tr><td>W A S D / šipky</td><td>chůze, řízení auta</td></tr>
    <tr><td>Shift</td><td>běh (ve vrtulníku klesání)</td></tr>
    <tr><td>Mezerník</td><td>ruční brzda, pěšky skok, ve vrtulníku stoupání</td></tr>
    <tr><td>F nebo E</td><td>nastoupit / vystoupit (auto, tramvaj, vrtulník)</td></tr>
    <tr><td>J</td><td>vzít nebo zrušit zakázku na rozvoz jídla</td></tr>
    <tr><td>M</td><td>velká mapa (kliknutím nastavíš cíl navigace)</td></tr>
    <tr><td>Myš</td><td>tažením otáčíš kameru, kolečkem přibližuješ</td></tr>
    <tr><td>C · H · R</td><td>kamera · klakson · vrátit na silnici</td></tr>
    <tr><td>N · Esc</td><td>posunout čas o 3 hodiny · menu</td></tr>
  </table>`;

const ABOUT_HTML = `
  <h3>O hře</h3>
  <p>Otevřený svět postavený ze skutečných dat Plzně: půdorysy a výšky zhruba 48 tisíc budov, silnice,
  tramvajové a trolejbusové linky se zastávkami, řeky, parky, restaurace i adresy.</p>
  <p>Co se dá dělat: chodit, půjčovat si auta, vozit se tramvají a trolejbusem, létat vrtulníkem,
  rozvážet jídlo ze skutečných podniků, objevovat památky a ujíždět policii.</p>
  <h3>Zdroje dat</h3>
  <p>Mapová data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>
  (licence ODbL). Výšky budov vypočteny z digitálního modelu povrchu DMP 1G a modelu reliéfu DMR 5G © ČÚZK.</p>
  <p>Vzhled budov (barvy, okna) a provoz jsou vymyšlené, názvy ulic, podniků a zastávek jsou skutečné.
  Hra je nezávislý fanouškovský projekt a není oficiálním produktem města ani dopravního podniku.</p>
  <p>Inspirováno projektem HrejBrno.cz.</p>`;

function fail(e) {
  console.error(e);
  loadText.textContent = `Hru se nepodařilo spustit: ${e.message}`;
}

async function boot() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('Tento prohlížeč nebo zařízení nepodporuje WebGL.');
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);

  const data = await loadAll((p) => { bar.style.width = `${Math.round(p * 80)}%`; });
  loadText.textContent = 'Stavím město…';
  await new Promise((r) => setTimeout(r, 30));
  const game = new Game(renderer, data);
  initInput(canvas);
  if (PARAMS.has('hour')) game.hour = +PARAMS.get('hour');
  game.env.setHour(game.hour);

  // představí okolí startu, ať hra nezačíná v prázdnu
  const f = game.focus;
  let built = 0;
  const total = Math.max(1, (() => { game.chunks.update(f.x, f.z, QUALITY.view, 0); return Math.min(game.chunks.pending, 60); })());
  while (built < total) {
    built += game.chunks.update(f.x, f.z, QUALITY.view, 4) || 4;
    bar.style.width = `${80 + Math.round((built / total) * 20)}%`;
    await new Promise((r) => setTimeout(r, 0));
  }
  bar.style.width = '100%';
  game._updateCamera(0.016);
  game.env.update(game.camera);
  game.render();

  $('loading').classList.add('hidden');
  $('menu-buttons').classList.remove('hidden');
  $('btn-play').textContent = game.hasSave ? 'Pokračovat' : 'Hrát';
  $('panel-help').innerHTML = HELP_HTML;
  $('panel-about').innerHTML = ABOUT_HTML;
  if (IS_TOUCH) $('touch').classList.remove('hidden');

  let running = false, last = 0, firstPlay = true;
  const menu = $('menu');
  const openMenu = () => {
    running = false; input.enabled = false; game.paused = true;
    menu.classList.remove('hidden'); game.hud.show(false);
    game.audio.suspend(); game.save();
    $('btn-play').textContent = 'Pokračovat';
  };
  const play = () => {
    menu.classList.add('hidden'); game.hud.show(true);
    running = true; input.enabled = true; game.paused = false; last = performance.now();
    game.audio.start(); game.audio.resume();
    if (firstPlay) {
      firstPlay = false;
      if (!game.hasSave) {
        game.hud.toast('Vítej v Plzni! Stojíš na náměstí Republiky.', 'big', 5000);
        setTimeout(() => game.hud.toast(IS_TOUCH ? 'Tlačítkem F nastoupíš do auta, ✉ ti dá zakázku.' : 'Klávesou F nastoupíš do auta, J ti dá zakázku, M otevře mapu.', '', 7000), 1500);
      }
    }
  };
  $('btn-play').addEventListener('click', play);
  $('btn-help').addEventListener('click', () => { $('panel-help').classList.toggle('hidden'); $('panel-about').classList.add('hidden'); });
  $('btn-about').addEventListener('click', () => { $('panel-about').classList.toggle('hidden'); $('panel-help').classList.add('hidden'); });
  $('btn-reset').addEventListener('click', () => {
    if (confirm('Opravdu začít od začátku? Smažou se peníze i objevené památky.')) { Game.clearSave(); location.reload(); }
  });
  $('btn-menu').addEventListener('click', openMenu);
  $('bigmap-close').addEventListener('click', () => game.toggleMap(false));
  $('bigmap-canvas').addEventListener('click', (e) => {
    if (!game.mapToWorld) return;
    const p = game.mapToWorld(e.clientX, e.clientY);
    game.jobs.setWaypoint(p.x, p.z);
    game.toggleMap(false);
  });
  addEventListener('resize', () => { game.resize(); if (!running) game.render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) openMenu(); });
  addEventListener('pagehide', () => game.save());

  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!running) { input.pressed.clear(); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.pressed.has('menu')) {
      input.pressed.delete('menu');
      if (game.mapOpen) game.toggleMap(false); else { openMenu(); return; }
    }
    game.update(dt);
    game.render();
    game.adapt(dt);
  };
  requestAnimationFrame(loop);

  if (DEBUG) {
    window.__play = play;
    window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) game.update(dt); game.render(); };
    window.__freeze = (b) => { running = !b; };
    window.__view = (x, y, z, tx, ty, tz) => {
      game.camera.position.set(x, y, z); game.camera.lookAt(tx, ty, tz);
      game.env.update(game.camera); game.render();
    };
  }
  window.__ready = true;
  if (PARAMS.has('autoplay')) play();
}

boot().catch(fail);
