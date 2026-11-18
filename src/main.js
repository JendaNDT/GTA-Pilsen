// Start hry: načtení dat, menu a hlavní smyčka.
import * as THREE from 'three/webgpu';
import { loadAll } from './data.js';
import { Game } from './game/game.js';
import { initInput, input } from './game/input.js';
import { initMapSearch } from './game/map-search.js';
import { initWorkUI } from './game/work-ui.js';
import { resultText } from './game/missions.js';
import { createFrameProfiler } from './game/frame-profiler.js';
import { initPerfPanel } from './game/perf-panel.js';
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
    <tr><td>F</td><td>nastoupit / vystoupit nebo obsloužit dveře ve směně MHD</td></tr>
    <tr><td>✉</td><td>vzít rychlý rozvoz jídla nebo zrušit aktivní zakázku</td></tr>
    <tr><td>☰</td><td>zakázky, garáž a směny MHD</td></tr>
    <tr><td>🗺</td><td>velká mapa (vyhledej místo nebo klepnutím nastav cíl)</td></tr>
    <tr><td>Tah prstem</td><td>otáčení kamery</td></tr>
  </table>` : `
  <h3>Ovládání</h3>
  <table>
    <tr><td>W A S D / šipky</td><td>chůze, řízení auta</td></tr>
    <tr><td>Shift</td><td>běh (ve vrtulníku klesání)</td></tr>
    <tr><td>Mezerník</td><td>ruční brzda, pěšky skok, ve vrtulníku stoupání</td></tr>
    <tr><td>F nebo E</td><td>nastoupit / vystoupit nebo obsloužit dveře ve směně MHD</td></tr>
    <tr><td>W · S · Mezerník</td><td>ve směně MHD plyn · brzda · nouzová brzda</td></tr>
    <tr><td>J</td><td>vzít rychlý rozvoz jídla nebo zrušit aktivní zakázku</td></tr>
    <tr><td>M</td><td>velká mapa (vyhledej místo nebo kliknutím nastav cíl)</td></tr>
    <tr><td>Myš</td><td>tažením otáčíš kameru, kolečkem přibližuješ</td></tr>
    <tr><td>C · H · R</td><td>kamera · klakson · vrátit na silnici</td></tr>
    <tr><td>N · Esc</td><td>posunout čas o 3 hodiny · menu se zakázkami, garáží a směnami MHD</td></tr>
  </table>`;

const ABOUT_HTML = (meta, rendering) => `
  <h3>O hře</h3>
  <p>Otevřený svět postavený ze skutečných dat od Plzně přes Rokycany až do Dobříva. Najdeš v něm kopce a údolí řek,
  půdorysy a výšky budov, silnice a mosty, linky MHD, parky, restaurace i adresy.</p>
  <p>Co se dá dělat: chodit, půjčovat si auta, vozit se tramvají, trolejbusem i autobusem, létat vrtulníkem,
  rozvážet jídlo ze skutečných podniků, vozit zákazníky, koupit si vlastní auto, jet směnu řidiče MHD,
  objevovat památky a ujíždět policii.</p>
  <h3>Zdroje dat</h3>
  <p>Grafiku vykresluje <a href="https://threejs.org" target="_blank" rel="noopener">three.js 0.187.0</a>
  (autoři three.js, licence <a href="https://github.com/mrdoob/three.js/blob/r187/LICENSE" target="_blank" rel="noopener">MIT</a>).
  Aktuální vykreslování: <strong>${rendering}</strong>.</p>
  <p>Sestavení hry používá picomatch od Jona Schlinkerta (licence
  <a href="https://github.com/micromatch/picomatch/blob/master/LICENSE" target="_blank" rel="noopener">MIT</a>)
  s místní opravou 4.0.8-plzen.1.</p>
  <p>Mapová data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>
  (licence ODbL). Terén vychází z digitálního modelu reliéfu DMR 5G, výšky budov z rozdílu modelu povrchu
  DMP 1G a DMR 5G © <a href="https://www.cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a>.</p>
  <p>Letecké snímky krajiny © ČÚZK. Podkladem je <a href="https://atom.cuzk.gov.cz/ORTOFOTO/ORTOFOTO.xml"
  target="_blank" rel="noopener">Ortofoto ČR</a> s licencí
  <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</p>
  <p>Polohy značek, stop čar a přechodů v Plzni vycházejí také z otevřeného
  <a href="https://opendata.plzen.eu/public/opendata/detail/6" target="_blank" rel="noopener">pasportu svislého</a> a
  <a href="https://opendata.plzen.eu/public/opendata/detail/92" target="_blank" rel="noopener">vodorovného značení města Plzně</a>.</p>
  <p>Denní rytmus aut na měřených tazích vychází z historických
  <a href="https://opendata.plzen.eu/public/opendata/detail/160" target="_blank" rel="noopener">měření dopravních smyček města Plzně</a>
  a z <a href="https://polivisuapi.plzen.eu/api/" target="_blank" rel="noopener">hodinových profilů PoliVisu</a>.
  Pro ostatní ulice a pro chodce hra používá odhad.</p>
  <p>Čtyři mapové listy centra používají otevřená data
  <a href="https://opendata.plzen.eu/public/opendata/detail/37" target="_blank" rel="noopener">3D budov centra Plzně, 2024</a>
  (GEOREAL – Vybíral, město Plzeň). Geometrie je převedená do herních souřadnic. Materiály v dalších
  čtvrtích využívají hranice <a href="https://opendata.plzen.eu/public/opendata/detail/108" target="_blank" rel="noopener">městských částí</a>.
  Model hamru
  vychází z mapy a fotografie obnovy zveřejněné
  <a href="https://www.npu.cz/cs/generalni-reditelstvi-npu/inspirujte-se/70002-obnova-hamru-horejsi-lub-v-dobrivu"
  target="_blank" rel="noopener">Národním památkovým ústavem</a>.</p>
  <p>Odjezdy tramvají, trolejbusů a autobusů vycházejí z GTFS
  <a href="https://opendata.plzen.eu/public/opendata/detail/187" target="_blank" rel="noopener">Plzeňských městských dopravních podniků, a.s.</a>
  (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>).
  Hra spojuje zastávky s trasami z OpenStreetMap, zkracuje trasy na hranici mapy a převádí kalendář k místnímu použití.</p>
  <p>Česká hlášení jsou syntetizovaná pro hru pomocí Piperu.
  <a href="${import.meta.env.BASE_URL}audio/zdroje.txt" target="_blank" rel="noopener">Autoři a licence zvukových podkladů</a>.</p>
  <p>Datum mapových dat OpenStreetMap: ${meta.osmTimestamp
    ? `${new Date(meta.osmTimestamp).toLocaleString('cs-CZ', { timeZone: 'UTC' })} UTC`
    : 'u této starší datové sady není doloženo'}.</p>
  <p>Povrchy a okna budov jsou stylizované, názvy ulic, podniků a zastávek jsou skutečné.
  Hra je nezávislý fanouškovský projekt a není oficiálním produktem města ani dopravního podniku.</p>
  <p>Inspirováno projektem HrejBrno.cz.</p>`;

function fail(e) {
  console.error(e);
  loadText.textContent = `Hru se nepodařilo spustit: ${e.message}`;
}

async function boot() {
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance',
    forceWebGL: PARAMS.get('renderer') === 'webgl',
    trackTimestamp: DEBUG,
  });
  try {
    await renderer.init();
  } catch (e) {
    throw new Error('Vykreslování hry vyžaduje prohlížeč s podporou WebGPU nebo WebGL 2.', { cause: e });
  }
  const rendering = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = QUALITY.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const data = await loadAll((p) => { bar.style.width = `${Math.round(p * 80)}%`; });
  loadText.textContent = 'Stavím město…';
  await new Promise((r) => setTimeout(r, 30));
  const game = new Game(renderer, data);
  const perf = DEBUG ? createFrameProfiler(game) : null;
  initInput(canvas);
  if (PARAMS.has('hour') || PARAMS.has('date')) {
    game.setClock(PARAMS.get('date'), PARAMS.has('hour') ? +PARAMS.get('hour') : game.hour);
  }

  // představí okolí startu, ať hra nezačíná v prázdnu
  const f = game.focus;
  // nejdřív terén v celém dohledu a úplně dostavěné okolí startu; zbytek se dostaví za hry
  game.chunks.update(f.x, f.z, QUALITY.view, 0);
  const total = Math.max(1, game.chunks.pendingStart);
  while (game.chunks.pendingStart > 0) {
    game.chunks.update(f.x, f.z, QUALITY.view, 6);
    bar.style.width = `${80 + Math.round((1 - game.chunks.pendingStart / total) * 20)}%`;
    await new Promise((r) => setTimeout(r, 0));
  }
  bar.style.width = '100%';
  game._updateCamera(0.016);
  game.env.update(game.camera, game.focus);
  loadText.textContent = 'Připravuji vykreslování…';
  await renderer.compileAsync(game.scene, game.camera);
  game.render();

  $('loading').classList.add('hidden');
  $('menu-buttons').classList.remove('hidden');
  $('btn-play').textContent = game.hasSave ? 'Pokračovat' : 'Hrát';
  $('panel-help').innerHTML = HELP_HTML;
  $('panel-about').innerHTML = ABOUT_HTML(data.meta, rendering);
  if (IS_TOUCH) $('touch').classList.remove('hidden');

  let running = false, last = 0, firstPlay = true;
  const perfPanel = perf && initPerfPanel(perf, rendering, () => running && !game.mapOpen);
  const menu = $('menu');
  const openMenu = () => {
    running = false; input.enabled = false; game.paused = true;
    perfPanel?.close();
    menu.classList.remove('hidden'); game.hud.show(false);
    game.audio.suspend(); game.save();
    $('btn-play').textContent = 'Pokračovat';
    updateWork();
  };
  const play = () => {
    menu.classList.add('hidden'); game.hud.show(true);
    running = true; input.enabled = true; game.paused = false; last = performance.now();
    perf?.reset();
    game.audio.start(); game.audio.resume();
    if (firstPlay) {
      firstPlay = false;
      if (!game.hasSave && !game.shifts.active) {
        game.hud.toast('Vítej v Plzni! Stojíš na náměstí Republiky.', 'big', 5000);
        setTimeout(() => game.hud.toast(IS_TOUCH ? 'Tlačítkem F nastoupíš do auta, ✉ ti dá zakázku.' : 'Klávesou F nastoupíš do auta, J ti dá zakázku, M otevře mapu.', '', 7000), 1500);
      } else if (game.shifts.last?.state === 'interrupted' && game.shifts.last.note === 'Načtení uložené hry') {
        game.hud.toast('Rozpracovaná směna byla při načtení přerušena.', 'bad', 5800);
      } else if (game.jobs.last?.state === 'interrupted' && game.jobs.last.note === 'Načtení uložené hry') {
        game.hud.toast(resultText(game.jobs.last), 'bad', 5800);
      }
    }
  };
  $('btn-play').addEventListener('click', play);
  const updateWork = initWorkUI(game, play);
  updateWork();
  const sections = ['jobs', 'garage', 'shifts', 'help', 'about', 'settings'];
  for (const name of sections) {
    $('btn-' + name).addEventListener('click', () => {
      const open = $('panel-' + name).classList.contains('hidden');
      for (const other of sections) {
        const visible = open && name === other;
        $('panel-' + other).classList.toggle('hidden', !visible);
        if ($('btn-' + other).hasAttribute('aria-expanded')) $('btn-' + other).setAttribute('aria-expanded', visible);
      }
      if (open && ['jobs', 'garage', 'shifts'].includes(name)) {
        updateWork();
        $('panel-' + name).scrollIntoView({ block: 'nearest' });
      }
    });
  }
  $('show-clock').checked = game.clockVisible;
  $('show-clock').addEventListener('change', (event) => game.setClockVisible(event.target.checked));
  $('sound-enabled').checked = !game.audio.muted;
  $('sound-enabled').addEventListener('change', (event) => game.setSoundEnabled(event.target.checked));
  $('orthophoto-enabled').disabled = !game.chunks.orthophoto;
  $('orthophoto-enabled').checked = Boolean(game.chunks.orthophoto) && game.orthophotoEnabled;
  $('orthophoto-enabled').addEventListener('change', (event) => game.setOrthophotoEnabled(event.target.checked));
  $('btn-reset').addEventListener('click', () => {
    if (confirm('Opravdu začít od začátku? Smaže se celý uložený postup včetně peněz, auta, zakázek a objevených památek.')) { Game.clearSave(); location.reload(); }
  });
  $('btn-menu').addEventListener('click', openMenu);
  $('bigmap-close').addEventListener('click', () => game.toggleMap(false));
  $('minimap').addEventListener('click', () => { if (running) game.toggleMap(true); });
  const setDestination = ({ x, z, name, stop }) => {
    game.jobs.setWaypoint(x, z, name, stop);
    game.toggleMap(false);
  };
  initMapSearch(game.world, setDestination, game.transit.timetable.stops);
  $('bigmap-canvas').addEventListener('click', (e) => {
    if (!game.mapToWorld) return;
    setDestination(game.mapToWorld(e.clientX, e.clientY));
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
    if (perf) {
      perf.frame(dt);
    } else {
      game.update(dt);
      game.render();
    }
    game.adapt(dt);
  };
  requestAnimationFrame(loop);

  if (DEBUG) {
    window.__perf = { summary: perf.summary, reset: perf.reset, renderStats: perf.renderStats };
    window.__play = play;
    window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) game.update(dt); game.render(); };
    window.__freeze = (b) => { running = !b; };
    window.__setClock = (date, hour) => game.setClock(date, hour);
    window.__setInput = (steer, thr) => { input.debugSteer = steer; input.debugThr = thr; };
    window.__view = (x, y, z, tx, ty, tz) => {
      game.camera.position.set(x, y, z); game.camera.lookAt(tx, ty, tz);
      game.env.update(game.camera, game.focus); game.render();
    };
  }
  window.__ready = true;
  if (PARAMS.has('autoplay')) play();
}

boot().catch(fail);
