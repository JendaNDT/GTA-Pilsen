// Pohyby postavy (hráč i chodci) jako čisté výpočty: z rychlosti, fáze kroku a stavu (stání,
// chůze, běh, skok, dopad, plavání) vrátí natočení kloubů. Kloubů je stejně jako dílů fyzikální
// postavy (physics/ragdoll.js) a natočení nikdy nepřekročí jejich meze, takže živá postava
// a postava při pádu mají stejný rozsah pohybu. Hlídá tests/character-pose.test.js.
//
// Osy kloubu jako u kostí three.js: x = předklon a záklon (kladné x posune konec končetiny
// dozadu, u kolena a lokte je to ohnutí), y = natočení kolem svislé osy, z = do strany
// (kladné z posune konec končetiny ke straně +x). Strana 1 leží na +x, strana −1 na −x.
import { parts } from '../physics/ragdoll.js';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const WALK_SPEED = 2.4, RUN_SPEED = 6.4;   // rychlosti hráče z Player.update (m/s)

/** Meze kloubů z fyzikální postavy v radiánech: { x: [min, max], y, z }. Pánev je volná. */
export const JOINT_LIMITS = Object.fromEntries(parts.map((part) => {
  if (part.hinge) return [part.name, { x: [part.hinge[0] * RAD, part.hinge[1] * RAD], y: [0, 0], z: [0, 0] }];
  if (part.cone) {
    const [normal, plane, twist] = part.cone.map((deg) => deg * RAD);
    return [part.name, { x: [-normal, normal], y: [-twist, twist], z: [-plane, plane] }];
  }
  return [part.name, null];
}));

/**
 * Délka jednoho celého cyklu kroku (levá i pravá noha) v metrech podle rychlosti. Svižná chůze
 * 2,4 m/s má cyklus asi 0,8 s (150 kroků za minutu), běh 6,4 m/s asi 0,66 s (180 kroků).
 */
export function strideLength(speed) {
  const s = Math.max(0, speed);
  if (s <= WALK_SPEED) return mix(0.95, 1.9, s / WALK_SPEED);
  return mix(1.9, 4.2, clamp((s - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1.3));
}

/**
 * Přírůstek fáze kroku (radiány za sekundu). Za celý cyklus 2π urazí postava právě délku kroku,
 * takže boty po zemi neklouzají.
 */
export function phaseRate(speed) {
  return speed > 0.02 ? TAU * speed / strideLength(speed) : 0;
}

/** Podíl běhu (0 = chůze, 1 = plný běh) podle rychlosti. */
export function runBlend(speed) { return smooth(3.2, 5.6, speed); }

/** Podíl pohybu (0 = stání, 1 = chůze) podle rychlosti. */
export function moveBlend(speed) { return smooth(0.05, 0.9, speed); }

function emptyPose() {
  const joints = {};
  for (const part of parts) joints[part.name] = [0, 0, 0];
  return { joints, root: { y: 0, x: 0, z: 0, yaw: 0 } };
}

/** Pozvolné „náhodné“ kolísání pro rozhlížení a přenášení váhy (stejné pro stejný čas a semínko). */
function drift(t, seed) {
  return Math.sin(t * 0.37 + seed) * 0.6 + Math.sin(t * 0.91 + seed * 2.3) * 0.3 + Math.sin(t * 1.73 + seed * 0.7) * 0.1;
}

/**
 * Natočení kloubů pro stav postavy.
 * s.speed: rychlost po zemi (m/s), s.phase: fáze kroku (rad), s.time: čas (s) pro dýchání,
 * s.idle: jak dlouho postava stojí (s), s.grounded, s.vy: svislá rychlost (m/s),
 * s.landing: síla dopadu 0–1 (doznívá), s.swimming, s.turn: rychlost otáčení (rad/s),
 * s.seed: odlišení postav, s.calm: 1 = chodec (menší rozmach, bez rozhlížení při chůzi).
 * Vrací { joints: { jméno: [x, y, z] }, root: { y, x, z } } – root je posun pánve nahoru (m),
 * předklon (x) a náklon do strany (z) celé postavy.
 */
export function characterPose(s) {
  const pose = emptyPose(), J = pose.joints, root = pose.root;
  const speed = Math.max(0, s.speed ?? 0), phase = s.phase ?? 0, time = s.time ?? 0, seed = s.seed ?? 0;
  const move = moveBlend(speed), run = runBlend(speed) * (s.calm ? 0.5 : 1);
  const add = (name, x = 0, y = 0, z = 0) => { const j = J[name]; j[0] += x; j[1] += y; j[2] += z; };

  if (s.swimming) {
    swimPose(pose, s, speed, time);
    return limit(pose);
  }

  // ---- stání: dýchání, přenášení váhy, rozhlížení
  const still = 1 - move;
  const breath = Math.sin(time * TAU / 4.2);
  add('hrudnik', 0.02 * breath * still);
  add('hlava', -0.015 * breath * still);
  const shift = drift(time * 0.5, seed) * still;
  root.z += 0.025 * shift;
  add('hrudnik', 0, 0, -0.02 * shift);
  const look = (s.idle ?? 0) > 2.5 ? smooth(2.5, 4, s.idle) : 0;
  add('hlava', 0.05 * drift(time * 0.4, seed + 5) * look * still, 0.5 * drift(time * 0.3, seed + 1) * look * still);
  for (const side of [1, -1]) {
    // ruce volně podél těla, mírně od boků, lokty lehce pokrčené
    add('paze' + side, 0.02 * breath * still, 0, side * 0.07);
    add('predlokti' + side, -0.12);
  }

  // ---- chůze a běh
  if (move > 0) {
    for (const side of [1, -1]) {
      const legPhase = phase + (side > 0 ? 0 : Math.PI);
      const forward = Math.sin(legPhase);               // 1 = noha nejvíc vpředu
      const swinging = Math.max(0, Math.cos(legPhase));  // noha jde dopředu (fáze švihu)
      const thigh = -mix(0.4, 0.72, run) * forward * (s.calm ? 0.85 : 1);
      const knee = mix(0.12, 0.25, run) * Math.max(0, forward) +
        mix(0.65, 1.55, run) * swinging ** 1.4 + mix(0.05, 0.15, run);
      add('stehno' + side, thigh * move);
      add('lytko' + side, knee * move);
      // paže proti noze téže strany; při běhu pokrčené lokty a silnější švih
      const armSwing = mix(0.32, 0.7, run) * forward * (s.calm ? 0.75 : 1);
      add('paze' + side, armSwing * move, 0, side * mix(0.02, 0.08, run) * move);
      add('predlokti' + side, -(mix(0.12, 1.35, run) + mix(0.18, 0.25, run) * Math.max(0, -forward)) * move);
    }
    // pánev nahoru a dolů dvakrát za cyklus, natočení pánve a protisměrné natočení hrudníku
    root.y += -mix(0.018, 0.045, run) * Math.cos(2 * phase) * move - mix(0.01, 0.06, run) * move;
    const twist = Math.sin(phase);
    root.yaw = mix(0.07, 0.1, run) * twist * move;
    add('hrudnik', 0, -mix(0.12, 0.16, run) * twist * move);
    add('hlava', 0, mix(0.05, 0.06, run) * twist * move);
    // předklon: při běhu výrazný, stehna ho vyrovnají, aby nohy mířily k zemi
    const lean = mix(0.035, 0.2, run) * move;
    root.x += lean;
    for (const side of [1, -1]) add('stehno' + side, -lean);
    add('hlava', -lean * 0.6);
    // náklon do zatáčky jen při rychlejším pohybu
    root.z += clamp(-(s.turn ?? 0) * speed * 0.035, -0.2, 0.2) * smooth(2, 5, speed);
  }

  // ---- ve vzduchu: při stoupání pokrčené nohy, při pádu natažené a ruce do stran
  if (s.grounded === false) {
    const vy = s.vy ?? 0, falling = smooth(-1, -6, vy), air = 1;
    for (const side of [1, -1]) {
      J['stehno' + side][0] = mix(J['stehno' + side][0], mix(-0.75, -0.25, falling), air * 0.85);
      J['lytko' + side][0] = mix(J['lytko' + side][0], mix(1.1, 0.35, falling), air * 0.85);
      J['paze' + side][0] = mix(J['paze' + side][0], mix(-0.45, -0.2, falling), air * 0.8);
      J['paze' + side][2] = mix(J['paze' + side][2], side * mix(0.3, 0.95, falling), air * 0.8);
      J['predlokti' + side][0] = mix(J['predlokti' + side][0], -0.5, air * 0.6);
    }
    root.x = mix(root.x, mix(0.12, -0.05, falling), 0.7);
    root.y = 0;
  }

  // ---- dopad: krátký podřep podle síly dopadu
  const landing = clamp(s.landing ?? 0, 0, 1);
  if (landing > 0 && s.grounded !== false) {
    root.y -= 0.14 * landing;
    root.x += 0.22 * landing;
    for (const side of [1, -1]) {
      add('stehno' + side, -0.55 * landing);
      add('lytko' + side, 0.95 * landing);
      add('paze' + side, -0.25 * landing, 0, side * 0.2 * landing);
    }
  }
  return limit(pose);
}

/** Plavání: v pohybu prsa, na místě šlapání vody. Postava je skloněná dopředu. */
function swimPose(pose, s, speed, time) {
  const J = pose.joints, root = pose.root;
  const moving = smooth(0.2, 1.2, speed);
  // prsa: cyklus asi 1,3 s, šlapání vody pomalejší
  const cycle = mix(time * TAU / 1.9, s.phase ?? time * TAU / 1.3, moving);
  const pull = Math.sin(cycle), kick = Math.sin(cycle + Math.PI * 0.6);
  root.x = mix(0.25, 1.05, moving);           // skoro vodorovně při plavání
  root.y = 0;
  for (const side of [1, -1]) {
    // ruce: vpřed nad hlavu, roztažení do stran a přitažení k hrudi
    J['paze' + side][0] = mix(-0.35 + 0.25 * pull, -1.25 + 0.45 * pull, moving);
    J['paze' + side][2] = side * mix(0.55 + 0.25 * pull, 0.45 + 0.6 * Math.max(0, pull), moving);
    J['predlokti' + side][0] = -mix(0.7 + 0.3 * pull, 0.35 + 0.9 * Math.max(0, -pull), moving);
    // nohy: na místě střídavé šlapání, v pohybu žabí kop
    const tread = Math.sin(cycle * 1.5 + (side > 0 ? 0 : Math.PI));
    J['stehno' + side][0] = mix(-0.35 - 0.25 * tread, -0.05 - 0.45 * Math.max(0, kick), moving) - root.x * moving * 0.6;
    J['stehno' + side][2] = side * mix(0.08, 0.25 * Math.max(0, kick), moving);
    J['lytko' + side][0] = mix(0.55 + 0.35 * tread, 0.25 + 1.0 * Math.max(0, kick), moving);
  }
  J.hlava[0] = -root.x * 0.75;                 // hlava se dívá dopředu nad hladinu
  J.hrudnik[0] = 0.04 * Math.sin(cycle);
}

/** Omezí natočení každého kloubu na meze fyzikální postavy. */
function limit(pose) {
  for (const [name, angles] of Object.entries(pose.joints)) {
    const range = JOINT_LIMITS[name];
    if (!range) continue;
    angles[0] = clamp(angles[0], range.x[0], range.x[1]);
    angles[1] = clamp(angles[1], range.y[0], range.y[1]);
    angles[2] = clamp(angles[2], range.z[0], range.z[1]);
  }
  return pose;
}

/**
 * Doznívání dopadu: síla 0–1 podle svislé rychlosti těsně před dopadem (m/s, záporná dolů),
 * slabé došlapy (pod 2 m/s) se nepočítají.
 */
export function landingStrength(vy) { return smooth(2, 9, -vy); }
export const LANDING_TIME = 0.32;   // jak dlouho podřep po dopadu trvá (s)
