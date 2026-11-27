import { CABIN_SERVICES } from './game/tram-cabin.js';
import { BIKE_LICENSE } from './game/bike-stations.js';
import packageInfo from '../package.json' with {type:'json'};
import { PhotoMode } from './game/photo-mode.js';
import { loadJolt } from './physics/jolt.js';
import { PhysicsWorld } from './physics/world.js';
// Start hry: načtení dat, menu a hlavní smyčka.
import * as THREE from 'three/webgpu';
import { loadAll } from './data.js';
import { acquireSaveLock } from './game/save-session.js';
import { Game } from './game/game.js';
import { formatTime, HOUR_SECONDS } from './game/clock.js';
import { initInput, input } from './game/input.js';
import { initMenu } from './game/menu.js';
import { AreaMap } from './game/area-map.js';
import { initWorkUI } from './game/work-ui.js';
import { resultText } from './game/missions.js';
import { createFrameProfiler } from './game/frame-profiler.js';
import { createTrafficWaits } from './game/traffic-waits.js';
import { initPerfPanel } from './game/perf-panel.js';
import { QUALITY, IS_TOUCH, IS_MOBILE, DEBUG, PARAMS, refreshSavedGraphics } from './config.js';
import { profilePixelRatio } from './world/image-quality.js';
import { enterFullscreen, fullscreenOnPlay, fullscreenSupported, isFullscreen, toggleFullscreen } from './game/fullscreen.js';

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
    <tr><td>F</td><td>nastoupit / vystoupit, u sedadla si sednout nebo vstát, ve směně obsloužit dveře</td></tr>
    <tr><td>✉</td><td>vzít rychlý rozvoz jídla nebo zrušit aktivní zakázku</td></tr>
    <tr><td>☰</td><td>zakázky, garáž a směny MHD</td></tr>
    <tr><td>🗺</td><td>mapa okolí (přibliž dvěma prsty, vyber místo a klepni na Navigovat sem)</td></tr>
    <tr><td>⛶</td><td>celá obrazovka (kde ji prohlížeč dovolí)</td></tr>
    <tr><td>Tah prstem</td><td>otáčení kamery</td></tr>
  </table>` : `
  <h3>Ovládání</h3>
  <table>
    <tr><td>W A S D / šipky</td><td>chůze, řízení auta</td></tr>
    <tr><td>Shift</td><td>běh (ve vrtulníku klesání)</td></tr>
    <tr><td>Mezerník</td><td>ruční brzda, pěšky skok, ve vrtulníku stoupání</td></tr>
    <tr><td>F nebo E</td><td>nastoupit / vystoupit, u sedadla si sednout nebo vstát, ve směně obsloužit dveře</td></tr>
    <tr><td>W · S · Mezerník</td><td>ve směně MHD plyn · brzda · nouzová brzda</td></tr>
    <tr><td>J</td><td>vzít rychlý rozvoz jídla nebo zrušit aktivní zakázku</td></tr>
    <tr><td>M</td><td>mapa okolí (přibliž kolečkem, vyber místo a potvrď Navigovat sem)</td></tr>
    <tr><td>Myš</td><td>tažením otáčíš kameru, kolečkem přibližuješ. Při volném rozhlížení pěšky klikni do hry a otáčej myší. Esc uvolní kurzor.</td></tr>
    ${DEBUG ? '<tr><td>F8 · F9</td><td>kolizní povrchy · panel měření výkonu</td></tr>' : ''}
    <tr><td>O</td><td>fotorežim · pohyb WASD, nahoru E, dolů Q, otáčení tažením</td></tr>
    <tr><td>C · H · L · R</td><td>kamera · klakson · dálková světla · vrátit na silnici</td></tr>
    <tr><td>N · Esc</td><td>posunout čas o 3 hodiny · menu se zakázkami, garáží a směnami MHD</td></tr>
    <tr><td>⛶ · F11</td><td>celá obrazovka (po kliknutí na Hrát se zapne sama, Esc ji ukončí)</td></tr>
  </table>`;

const ABOUT_HTML = (meta, rendering) => `
  <h3>O hře</h3>
  <p>Plzeň naplno · verze ${packageInfo.version}</p>
  <p>Otevřený svět postavený ze skutečných dat od Plzně přes Rokycany až do Dobříva. Najdeš v něm kopce a údolí řek,
  půdorysy a výšky budov, silnice a mosty, linky MHD, parky, restaurace i adresy.</p>
  <p>Co se dá dělat: chodit, půjčovat si auta, vozit se tramvají, trolejbusem i autobusem, létat vrtulníkem,
  rozvážet jídlo ze skutečných podniků, vozit zákazníky, koupit si vlastní auto, jet směnu řidiče MHD,
  objevovat památky, zahrát si minigolf nebo bowling, půjčit si sdílené elektrokolo a ujíždět policii.</p>
  <p>Na mostě tě u kraje zastaví zábradlí. Na historických kamenných mostech tě zachytí zídka.
  Po prudkém nárazu nebo pádu z výšky postava spadne a zase vstane. Fyzikální pády můžeš vypnout v nastavení.</p>
  <h3>Zdroje dat</h3>
  <p>Místa návratu u služeben vznikla podle adresních bodů RÚIAN © ČÚZK
  (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)
  a herní mapy OpenStreetMap. Názvy jsme ověřili v adresářích policie a měst.</p>
  <p>Grafiku vykresluje <a href="https://threejs.org" target="_blank" rel="noopener">three.js 0.187.0</a>
  (autoři three.js, licence <a href="https://github.com/mrdoob/three.js/blob/r187/LICENSE" target="_blank" rel="noopener">MIT</a>).
  Aktuální vykreslování: <strong>${rendering}</strong>.</p>
  <p>Fyziku počítá <a href="https://github.com/jrouwe/JoltPhysics.js" target="_blank" rel="noopener">Jolt Physics 1.1.1</a> (Jorrit Rouwe, licence MIT).</p>
  <p>Herní model pětidveřové Škody Fabia II, ostatní karoserie, výbava taxislužby a policie, pohyblivá kola aut a zelenobílý trolejbus jsou vlastní tvorbou projektu Plzeň naplno.</p>
  <p>Tvar říčního dna je vlastní herní odhad podle vzdálenosti od břehu.
  Výška dna u Wilsonova mostu byla porovnána s <a href="https://gis.plzen.eu/foto/pov_model/profily/PM_Psany_PP.pdf"
  target="_blank" rel="noopener">profilem R19 v povodňovém modelu města Plzně</a>.</p>
  <p>Sestavení hry používá picomatch od Jona Schlinkerta (licence
  <a href="https://github.com/micromatch/picomatch/blob/master/LICENSE" target="_blank" rel="noopener">MIT</a>)
  s místní opravou 4.0.8-plzen.1.</p>
  <p>Mapová data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>
  (licence ODbL). Terén vychází z digitálního modelu reliéfu DMR 5G, výšky budov z rozdílu modelu povrchu
  DMP 1G a DMR 5G © <a href="https://www.cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a>.</p>
  <p>Cyklistická navigace používá cesty, povolené směry a omezení z herního výřezu OpenStreetMap (ODbL).</p>
  <p>Trasa chodců od muzea ke Strouze a zastávkové zálivy vycházejí z OpenStreetMap (ODbL). Názvy, čísla stanovišť a linky na označnících vycházejí z jízdního řádu PMDP. Polohy mapovaných sloupů veřejného osvětlení pocházejí z OpenStreetMap (ODbL). Polohy a údaje o lavičkách a přístřešcích čerpáme z OpenStreetMap (ODbL). Modely vybavení a kresbu tabulí vytvořil projekt.</p>
  <p>Vstup ve Škodalandu vychází z herní mapy OpenStreetMap (ODbL) a terénu ČÚZK (CC BY 4.0).
  Název a adresu ověřuje <a href="https://sport.plzen.eu/Sportoviste/d/skodaland-ceske-udoli" target="_blank" rel="noopener">Sportovní Plzeň</a>.
  Zkušební trasa, její značení a dráhy minigolfu, překážky, půjčovna, míček a vlajky jsou vlastní tvorba projektu.</p>
  <p>Polohu bowlingu U Papírny uvádí <a href="https://sport.plzen.cz/Sportoviste/d/bowling-u-papirny" target="_blank" rel="noopener">Sportovní Plzeň</a>.
  Herní interiér, bowlingovou dráhu, kuželky, kulečníkový stůl, tágo i číslované plné a půlené koule vytvořil projekt Plzeň naplno.</p>
  <p>Polohy stanovišť Pilsen Bike vycházejí z veřejného zdroje PMDP / Freebike ve formátu GBFS 3.0 (licence ${BIKE_LICENSE}). Model elektrokola a označníku jsou vlastní tvorba projektu.</p>
  <p>Barevné tabulky pro den, soumrak a noc vznikly přímo pro tuto hru.</p>
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
  <p>Interiéry Tatry, tříčlánkové tramvaje, autobusu SOR a trolejbusu včetně sedadel, osvětlení, oken a průchozích měchů jsou vlastní tvorba projektu Plzeň naplno.</p>
  <p>Rozety, portály, zvonice a střechy kostela sv. Jana Nepomuckého vytvořil projekt Plzeň naplno podle městského zaměření a dvou fotografií dodaných autorem hry.</p>
  <p>Modely dvanácti plzeňských dominant od Jubilejní brány po rozhlednu Chlum, včetně kreseb průčelí a střech, vytvořil projekt Plzeň naplno podle fotografických předloh. Jejich tvary vycházejí z otevřeného městského zaměření Plzně a půdorysů OpenStreetMap (ODbL).</p>
  <p>Morový sloup na náměstí Republiky má půdorys z OpenStreetMap (ODbL). Sochy, kámen, zlacení i ohrazení vytvořil projekt Plzeň naplno podle fotografie od autora hry a popisu Národního památkového ústavu.</p>
  <p>Sedm fotografických povrchů fasád poskytla knihovna <a href="https://polyhaven.com/license" target="_blank" rel="noopener">Poly Haven (CC0)</a>. Vzory střech vytvořil projekt Plzeň naplno.</p>
  <p>Spodní silnice a nájezdy vycházejí z výškopisu a z novějšího
  <a href="https://ags.cuzk.gov.cz/arcgis2/rest/services/dmp/ImageServer" target="_blank" rel="noopener">modelu povrchu ČÚZK z leteckých snímků (CC BY 4.0)</a>.
  U fakulty byly porovnány výškové body DTM Plzeňského kraje, U Planetária model města Plzně
  a v Koterově zveřejněné rozměry lávky od projektantů SUDOP Praha.</p>
  <p>Polohy uličního vybavení vycházejí z dat přispěvatelů OpenStreetMap (ODbL). Z téže mapy vycházejí obrysy tramvajových ostrůvků a okraje přednádraží. Dlažba před hlavním vchodem sleduje výšky DMR 5G ČÚZK. Kresba průčelí nádraží, římsy, tabule, špice, materiál kupolí, opěrné zdi a sloupky jsou vlastní tvorba projektu Plzeň naplno. Katedrála sv. Bartoloměje používá městské měření Plzně. Kresba kamene, krytin, gotických oken a portálů, věžní hodiny a střešní detaily jsou vlastní tvorba projektu. Severní průčelí náměstí Republiky, římsy a vikýře jsou vlastní kresba a model podle městského zaměření a fotografií z Wikimedia Commons (Sovicka169, Txllxt TxllxT a Alex Hauner, CC BY-SA 4.0, Honza Groh, CC BY-SA 3.0). Kašny na náměstí Republiky navrhl Ondřej Císler. Jejich herní modely a voda jsou vlastní tvorba projektu podle dodaných fotografií, údajů Aoc architekti, poloh OpenStreetMap (ODbL) a ortofota ČÚZK (CC BY 4.0). Lochotínský pavilonek má půdorys podle OpenStreetMap (ODbL). Fasáda, střechy a terasa se zábradlím jsou vlastní tvorba projektu podle autorových fotografických předloh. Západočeské muzeum vychází z městského měření. Kresba fasády, vstupní portál a střešní věžičky jsou vlastní tvorba projektu podle fotografií dodaných autorem hry. Radnice na náměstí Republiky vychází z městského 3D modelu Plzně. Sgrafita, radniční hodiny, štíty a věžička jsou vlastní tvorba projektu. U Nového divadla jsou perforovaná betonová stěna, kresba panelů a oken, prosklené spojovací chodby a koule na nádvoří vlastní tvorba projektu. Obrysy vycházejí z městského měření a OpenStreetMap (ODbL). Kresba fasád Velkého divadla, měděná střecha, balustráda a sochařské siluety jsou vlastní tvorba projektu. Na parkové terase navazuje půdorys OpenStreetMap (ODbL) na městské měření. Projekt nakreslil také fasády Velké synagogy a obou sousedních domů v sadech Pětatřicátníků a vytvořil kupole věží, římsy a hvězdy. Modely laviček, košů, stojanů, přístřešků, rozcestníku a číslovaných označníků vytvořil projekt Plzeň naplno.</p>
  <p>Východní sadový okruh až k Mlýnské strouze využívá geometrii OpenStreetMap (ODbL) a porovnání s ortofotem ČÚZK (CC BY 4.0). Loutky, lavičku, bustu, malované hlavy, terasu, lávku a pobřežní rostliny vymodeloval projekt podle městské dokumentace a katalogu Křížky a vetřelci.</p>
  <p>Modely pěti vodních prvků ve Smetanových a Kopeckého sadech, pomníků, loubí a výsadby vytvořil projekt. Polohy vycházejí z OpenStreetMap (ODbL), zeleň z ortofota ČÚZK (CC BY 4.0). Podobu děl zachycují katalog Sochy a města, městská encyklopedie, galerie v Chebu a dokumentace města Plzně.</p>
  <p>Historický exteriér věznice Bory je vlastní model a kresba projektu podle herních půdorysů OpenStreetMap (ODbL), dodaných leteckých pohledů a fotografie průčelí od autora Aisano (Wikimedia Commons, CC BY-SA 3.0).</p>
  <p>Štíty a kresba dalších 33 domů na náměstí Republiky jsou vlastní tvorba projektu podle městského 3D zaměření a adres z Encyklopedie dějin města Plzně. Fotografické předlohy na Wikimedia Commons pořídili Honza Groh (Jagro, CC BY-SA 3.0) a Txllxt TxllxT (CC BY-SA 4.0).</p>
  <p>Modely stromů a jejich sezónní vzhled vytvořil projekt Plzeň naplno. Druh olistění vychází z dat přispěvatelů OpenStreetMap (ODbL).</p>
  <p>Detail povrchu terénu používá šest materiálů knihovny <a href="https://polyhaven.com/license" target="_blank" rel="noopener">Poly Haven (CC0)</a>.</p>
  <p>Čtyři mapové listy centra používají otevřená data
  <a href="https://opendata.plzen.eu/public/opendata/detail/37" target="_blank" rel="noopener">3D budov centra Plzně, 2024</a>
  (GEOREAL – Vybíral, město Plzeň). Ze stejné sady pocházejí modely zdí, pilířů a jezů, půdorysy mostů a výška lávky U Prazdroje. U této sady město uvádí volné užití bez autorskoprávní či databázové ochrany. Geometrie je převedená do herních souřadnic. Materiály v dalších
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

let releaseSaveLock, leaveGame;
let departed = false;
addEventListener('pagehide', () => {
  departed = true;
  leaveGame?.();
  releaseSaveLock?.();
});
addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

async function boot() {
  const transfer = $('btn-transfer');
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('plzen-predani-hry') : null;
  transfer.onclick = () => channel?.postMessage('prevzit');
  let canSave = true, onLockLost;
  try {
    releaseSaveLock = await acquireSaveLock(() => {
      loadText.textContent = 'Hra je otevřená v jiné kartě. Po jejím zavření zde načtu aktuální postup.';
      transfer.hidden = !channel;
    }, () => {
      canSave = false;
      onLockLost?.();
    });
  } catch {
    canSave = false;
  }
  if (departed) { releaseSaveLock?.(); return; }
  transfer.hidden = true;
  loadText.textContent = 'Načítám město…';
  refreshSavedGraphics();
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance',
    forceWebGL: PARAMS.get('renderer') === 'webgl',
    trackTimestamp: DEBUG || PARAMS.get('adapt') !== '0',
  });
  try {
    await renderer.init();
  } catch (e) {
    throw new Error('Vykreslování hry vyžaduje prohlížeč s podporou WebGPU nebo WebGL 2.', { cause: e });
  }
  const rendering = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profilePixelRatio(QUALITY.pixelRatio, IS_MOBILE)));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = QUALITY.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const [data, jolt] = await Promise.all([
    loadAll(p => { bar.style.width = `${Math.round(p * 75)}%`; }),
    loadJolt(),
  ]);
  const physics = new PhysicsWorld(jolt);
  bar.style.width = '80%';
  loadText.textContent = 'Stavím město…';
  await new Promise((r) => setTimeout(r, 30));
  const game = new Game(renderer, data, physics);
  game.saveEnabled = canSave;
  onLockLost = () => {
    game.saveEnabled = false;
    $('save-status').textContent = 'Spojení s uloženým postupem se přerušilo. Obnov stránku pro nové načtení.';
  };
  if (!canSave) $('save-status').textContent = 'Prohlížeč nyní neumožňuje ukládání postupu.';
  const perf = DEBUG || PARAMS.get('adapt') !== '0' ? createFrameProfiler(game, { sampleEvery: DEBUG ? 1 : 16 }) : null;
  const syncMouseLock = initInput(canvas, () =>
    input.enabled && game.freeLook && (game.mode === 'foot' || game.cabin) && !game.activities.golf.ball && !game.activities.playingBowling && !game.mapOpen && !game.paused);
  if (PARAMS.has('hour') || PARAMS.has('date')) {
    game.setClock(PARAMS.get('date'), PARAMS.has('hour') ? +PARAMS.get('hour') : game.hour);
  }

  loadText.textContent = 'Připravuji okolí do 1 km…';
  await game.chunks.prepareStart(game.focus, QUALITY.view, fraction => {
    bar.style.width = `${80 + Math.round(fraction * 15)}%`;
  });
  game._updateCamera(0.016);
  const initialCamera = !game.hasSave && {
    position: game.camera.position.clone(), rotation: game.camera.quaternion.clone()
  };
  game.env.update(game.camera);
  loadText.textContent = 'Připravuji vykreslování…';
  await game.env.prepareSkyLight();
  if (game.postfx) await game.postfx.prepare();
  else await renderer.compileAsync(game.scene, game.camera);
  canvas.style.visibility = 'hidden';
  const facing = game.camera.quaternion.clone();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 8; i++) {
    game.camera.quaternion.copy(facing);
    game.camera.rotateOnWorldAxis(up, i * Math.PI / 4);
    game.env.update(game.camera);
    game.render();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  await renderer.backend.device?.queue.onSubmittedWorkDone();
  game.camera.quaternion.copy(facing);
  if (initialCamera) {
    game.camera.position.set(-32, 7, 108);
    game.camera.lookAt(1, 25, 4);
  }
  game.postfx?.resetHistory();
  game.env.update(game.camera);
  bar.style.width = '100%';
  game.render();

  canvas.style.visibility = '';
  $('loading').classList.add('hidden');
  $('menu-buttons').classList.remove('hidden');
  $('panel-help').innerHTML = HELP_HTML;
  $('panel-about').innerHTML = ABOUT_HTML(data.meta, rendering);
  if (IS_TOUCH) $('touch').classList.remove('hidden');

  let running = false, last = 0, firstPlay = true;
  const perfPanel = DEBUG ? initPerfPanel(perf, rendering, game, () => running && !game.mapOpen) : null;
  const menu = $('menu');
  const timeInput = $('game-time'), clockStatus = $('clock-status');
  const showClock = () => {
    timeInput.value = formatTime(game.clock.seconds);
    clockStatus.textContent = game.clock.followsPrague ? 'Aktuální čas v Plzni' : 'Ručně nastavený čas';
  };
  const applyTime = (change) => {
    if (game.shifts.active && !confirm('Změna času přeruší rozjetou směnu. Chceš pokračovat?')) return;
    change();
    showClock();
    if (!game.save()) clockStatus.textContent = game.saveError;
    updateWork();
    navigation.refresh();
    if (!game.graphicsBusy) game.render();
  };
  let mapFromPause = false;
  const openMenu = () => {
    if (game.mapOpen) game.toggleMap(false);
    running = false; input.enabled = false; game.paused = true;
    syncMouseLock();
    perfPanel?.close();
    menu.classList.remove('hidden'); game.hud.show(false);
    $('btn-photo').disabled = game.activities.playingBowling;
    game.audio.suspend(); game.save();
    input.pressed.clear();
    navigation.show(true);
  };
  const play = () => {
    // Prohlížeč dovolí celou obrazovku jen hned po kliknutí, proto dřív než cokoli dalšího.
    if (fullscreenOnPlay(game.fullscreenEnabled)) void enterFullscreen();
    menu.classList.add('hidden'); game.hud.show(true);
    running = true; input.enabled = true; game.paused = false; last = performance.now();
    perf?.reset();
    game.audio.start(); game.audio.resume();
    if (firstPlay) {
      if (initialCamera && !game.cabin) {
        game.camera.position.copy(initialCamera.position);
        game.camera.quaternion.copy(initialCamera.rotation);
        game.postfx?.resetHistory();
      }
      firstPlay = false;
      if (!game.hasSave && !game.shifts.active && !game.cabin) {
        game.hud.toast('Vítej v Plzni! Stojíš na náměstí Republiky.', 'big', 5000);
        setTimeout(() => game.hud.toast(IS_TOUCH ? 'Tlačítkem F nastoupíš do auta, ✉ ti dá zakázku.' : 'Klávesou F nastoupíš do auta, J ti dá zakázku, M otevře mapu.', '', 7000), 1500);
      } else if (game.activities.interrupted) {
        game.hud.toast(game.activities.interruptedGolf ? 'Minigolf byl při načtení přerušen.'
          : game.activities.interrupted.bowling ? 'Bowling byl při načtení přerušen.'
          : 'Zkušební trasa byla při načtení přerušena.', '', 5800);
      } else if (game.bikes.interrupted) {
        game.hud.toast('Půjčené elektrokolo se vrátilo na výchozí stanoviště.', '', 5800);
      } else if (game.shifts.last?.state === 'interrupted' && game.shifts.last.note === 'Načtení uložené hry') {
        game.hud.toast('Rozpracovaná směna byla při načtení přerušena.', 'bad', 5800);
      } else if (game.jobs.last?.state === 'interrupted' && game.jobs.last.note === 'Načtení uložené hry') {
        game.hud.toast(resultText(game.jobs.last), 'bad', 5800);
      }
    }
  };
  let photoFromPlay = false;
  const photo = new PhotoMode(game, canvas, () => {
    photo.close();
    if (photoFromPlay) play();
    else {
      menu.classList.remove('hidden');
      game.render();
      navigation.show(!firstPlay);
      $('btn-photo').focus();
    }
  });
  const openPhoto = () => {
    if (game.graphicsBusy || game.mapOpen || game.activities.playingBowling) return;
    photoFromPlay = running;
    running = false; input.enabled = false; game.paused = true;
    syncMouseLock();
    input.pressed.clear();
    game.audio.suspend();
    game.hud.show(false); menu.classList.add('hidden');
    photo.open(); last = performance.now();
  };
  $('btn-photo').addEventListener('click', openPhoto);
  for (const [id, setting] of [['sun-flare','flareEnabled'], ['motion-blur','motionEnabled']]) {
    const control = $(id);
    control.checked = game[setting];
    control.addEventListener('change', () => {
      game[setting] = control.checked;
      game.applyOptics(); game.save();
      if (!running && !game.graphicsBusy) game.render();
    });
  }
  $('btn-play').addEventListener('click', play);
  function boardFromMenu(trip) {
    const error = game.startCabinRide(trip);
    if (error) { $('ride-feedback').textContent = error; return; }
    play();
    game._updateCamera(0);
    game.hud.toast(IS_TOUCH ? 'Páčkou projdi uličkou. U sedadla klepni na akci.'
      : 'Klávesou W projdi uličkou, u sedadla stiskni F.');
  }
  for (const service of CABIN_SERVICES) {
    const button = document.createElement('button');
    button.type = 'button';
    const line = document.createElement('strong');
    line.className = 'ride-line';
    line.textContent = service.ref;
    const model = document.createElement('b');
    model.textContent = service.model;
    const direction = document.createElement('span');
    direction.textContent = 'Směr ' + service.destination;
    button.append(line, model, direction);
    button.addEventListener('click', () => boardFromMenu(service.trip));
    $('ride-options').append(button);
  }
  // Celá obrazovka: po kliknutí na Hrát (volba v nastavení) a tlačítkem ⛶ ve hře.
  const fullscreenButton = $('btn-fullscreen'), fullscreenChoice = $('fullscreen-play');
  const supported = fullscreenSupported();
  fullscreenButton.classList.toggle('hidden', !supported);
  $('fullscreen-setting').classList.toggle('hidden', !supported);
  fullscreenChoice.checked = game.fullscreenEnabled;
  fullscreenChoice.addEventListener('change', () => { game.fullscreenEnabled = fullscreenChoice.checked; game.save(); });
  const showFullscreen = () => {
    const on = isFullscreen();
    fullscreenButton.setAttribute('aria-pressed', on);
    fullscreenButton.title = on ? 'Zpět do okna' : 'Celá obrazovka';
  };
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, showFullscreen);
  fullscreenButton.addEventListener('click', () => { void toggleFullscreen(); });
  const updateWork = initWorkUI(game, play, () => navigation.refresh());
  updateWork();
  const navigation = initMenu(game, updateWork, showClock);
  navigation.show(false);
  $('btn-map').onclick = () => {
    mapFromPause = true;
    menu.classList.add('hidden');
    game.toggleMap(true);
    $('bigmap-canvas').focus({ preventScroll: true });
  };
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (event.code !== 'Escape' && !(mapFromPause && event.code === 'KeyM')) return;
    if (menu.classList.contains('hidden') && !mapFromPause) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    input.pressed.clear();
    if (mapFromPause) game.toggleMap(false);
    else if (!navigation.back() && !firstPlay) play();
  });
  $('weather-mode').value = game.weather.mode;
  $('weather-mode').addEventListener('change', event => game.setWeatherMode(event.target.value));
  $('show-clock').checked = game.clockVisible;
  $('show-clock').addEventListener('change', (event) => game.setClockVisible(event.target.checked));
  showClock();
  $('clock-settings').addEventListener('submit', (event) => {
    event.preventDefault();
    const hour = timeInput.valueAsNumber / (1000 * HOUR_SECONDS);
    if (Number.isFinite(hour)) applyTime(() => game.setClock(null, hour));
  });
  $('use-prague-time').addEventListener('click', () => applyTime(() => game.usePragueTime()));
  $('sound-enabled').checked = !game.audio.muted;
  $('sound-enabled').addEventListener('change', (event) => game.setSoundEnabled(event.target.checked));
  const heliAssist = $('heli-assist');
  heliAssist.checked = game.heliAssist;
  heliAssist.addEventListener('change', () => { game.heliAssist = heliAssist.checked; game.save(); });
  const freeLook = $('free-look');
  freeLook.checked = game.freeLook;
  freeLook.disabled = !canvas.requestPointerLock;
  freeLook.addEventListener('change', () => { game.freeLook = freeLook.checked; game.save(); });
  const steering = $('steering');
  steering.value = game.steering;
  steering.addEventListener('change', () => { game.steering = steering.value; game.save(); });
  const qualitySelect = $('graphics-quality'), qualityStatus = $('graphics-status');
  const showQuality = () => {
    qualitySelect.value = game.graphicsOverride ?? game.graphics.choice;
    qualityStatus.textContent = qualitySelect.value === 'auto'
      ? `Automatická předvolba · ${qualitySelect.querySelector(`option[value="${QUALITY.name}"]`).textContent}` : '';
  };
  game.onGraphicsChanged = () => { perf?.reset(); showQuality(); };
  showQuality();
  qualitySelect.addEventListener('change', async () => {
    qualitySelect.disabled = true;
    qualityStatus.textContent = 'Připravuji grafiku…';
    const applied = await game.setGraphicsChoice(qualitySelect.value);
    showQuality();
    if (!applied) qualityStatus.textContent = 'Předvolbu grafiky se nepodařilo použít.';
    qualitySelect.disabled = false;
  });
  $('particles-enabled').checked = game.particles.enabled;
  $('particles-enabled').addEventListener('change', event => {
    game.particles.enabled = event.target.checked;
    game.particles.mesh.visible = false;
    game.save();
  });
  $('falls-enabled').checked = game.falls.enabled;
  $('falls-enabled').addEventListener('change', event => {
    game.falls.enabled = event.target.checked;
    if (!game.falls.enabled) game.falls.limit(0);
    game.save();
  });
  $('orthophoto-enabled').disabled = !game.chunks.orthophoto;
  $('orthophoto-enabled').checked = Boolean(game.chunks.orthophoto) && game.orthophotoEnabled;
  $('orthophoto-enabled').addEventListener('change', (event) => game.setOrthophotoEnabled(event.target.checked));
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Opravdu začít od začátku? Smaže se celý uložený postup včetně peněz, auta, zakázek a objevených památek.')) return;
    if (game.clearSave()) location.reload();
    else alert('Postup se nepodařilo smazat. Zkus to znovu.');
  });
  $('btn-menu').addEventListener('click', openMenu);
  game.areaMap = new AreaMap(game, () => {
    if (!mapFromPause) return;
    mapFromPause = false;
    menu.classList.remove('hidden');
    navigation.show(true);
    $('btn-map').focus({ preventScroll: true });
  });
  $('minimap').addEventListener('click', () => { if (running) game.toggleMap(true); });
  addEventListener('resize', () => { game.resize(); if (!running && !game.graphicsBusy) game.render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) openMenu(); });
  leaveGame = () => {
    if (!firstPlay) game.save();
    game.saveEnabled = false;
    channel?.close();
  };
  if (channel) channel.onmessage = ({ data }) => {
    if (data !== 'prevzit' || !game.saveEnabled || running || photo.active || game.graphicsBusy) return;
    if (!firstPlay && !game.save()) return;
    // Čekající karta má požadavek ve frontě. Stará stránka už nesmí znovu zapsat.
    game.saveEnabled = false;
    location.reload();
  };

  const loop = (now) => {
    if (photo.active) {
      photo.update(Math.min(.05, Math.max(0,(now - last) / 1000)));
      last = now;
      return;
    }
    if (!running) {
      // Při ručním krokování v ladicím režimu přečte stisk až následující krok.
      if (!input.enabled) input.pressed.clear();
      return;
    }
    if (input.pressed.delete('photo')) {
      openPhoto();
      if (photo.active) return;
    }
    const elapsed = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, elapsed);
    last = now;
    if (game.graphicsBusy) return;
    if (input.pressed.has('menu')) {
      input.pressed.delete('menu');
      if (game.mapOpen) game.toggleMap(false); else { openMenu(); return; }
    }
    if (perf) {
      perf.frame(dt, elapsed);
    } else {
      game.update(dt, elapsed);
      game.render();
    }
    syncMouseLock();
    if (perf) game.adapt(elapsed, perf.summary);
  };
  await renderer.setAnimationLoop(loop);

  if (DEBUG) {
    window.__perf = { summary: perf.summary, reset: perf.reset, renderStats: perf.renderStats };
    if (PARAMS.get('kolony') === '1') {
      game.trafficWaits = createTrafficWaits(game);
      window.__kolony = minimum => game.trafficWaits.queues(minimum);
    }
    window.__play = play;
    window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) game.update(dt); game.render(); };
    window.__freeze = (b) => { running = !b; };
    window.__setClock = (date, hour) => game.setClock(date, hour);
    window.__setInput = (steer, thr) => { input.debugSteer = steer; input.debugThr = thr; };
    window.__view = (x, y, z, tx, ty, tz) => {
      game.camera.position.set(x, y, z); game.camera.lookAt(tx, ty, tz);
      game.postfx?.resetHistory();
      game.env.update(game.camera); game.render();
    };
  }
  window.__ready = true;
  if (PARAMS.has('autoplay')) play();
}

boot().catch(error => {
  releaseSaveLock?.();
  fail(error);
});
