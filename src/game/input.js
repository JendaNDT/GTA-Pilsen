// Vstup: klávesnice, myš a dotykové ovládání sjednocené do jednoho stavu.
import { IS_TOUCH } from '../config.js';

export const input = {
  moveX: 0,          // -1 vlevo … 1 vpravo
  moveY: 0,          // -1 vzad … 1 vpřed
  runAmount: 0,
  handbrake: false,  // mezerník (ruční brzda / skok / stoupání)
  lift: 0,
  down: false,       // Shift ve vrtulníku = klesání
  freeLooking: false,
  lookDX: 0, lookDY: 0, zoom: 0,
  pressed: new Set(),
  enabled: false,
  usedTouch: false,
};

const keys = new Set();
const KEYMAP = {
  KeyF: 'action', KeyE: 'action', Enter: 'action',
  KeyJ: 'job', KeyM: 'map', KeyC: 'camera', KeyH: 'horn', KeyL: 'beams', KeyO: 'photo', KeyR: 'reset',
  Escape: 'menu', KeyP: 'menu', KeyN: 'time',
};

function refreshKeys() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  kb.x = x; kb.y = y;
  kb.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  kb.space = keys.has('Space');
}
const kb = { x: 0, y: 0, run: false, space: false };
const touch = { x: 0, y: 0, gas: false, brake: false, hand: false, active: false };

export function initInput(canvas, allowFreeLook) {
  let dragging = false;
  const locked = () => document.pointerLockElement === canvas;
  const release = () => {
    dragging = false;
    input.lookDX = input.lookDY = 0;
    if (locked()) document.exitPointerLock();
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && locked()) {
      e.preventDefault();
      release();
      return;
    }
    if (!input.enabled) { if (e.code === 'Escape') input.pressed.add('menu'); return; }
    if (e.target instanceof HTMLElement && e.target.closest(':is(#minigolf-panel, #bowling-panel) :is(input, button)') &&
      (e.code === 'Space' || e.code === 'Enter' || (e.target instanceof HTMLInputElement && e.code.startsWith('Arrow')))) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat && KEYMAP[e.code]) input.pressed.add(KEYMAP[e.code]);
    keys.add(e.code);
    refreshKeys();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); refreshKeys(); });
  addEventListener('blur', () => { keys.clear(); refreshKeys(); release(); });

  // myš: tažením se otáčí kamera, kolečkem se přibližuje
  canvas.addEventListener('pointerdown', async (e) => {
    if (e.pointerType !== 'mouse' || !input.enabled) return;
    dragging = true;
    if (e.button === 0 && allowFreeLook() && !locked() && canvas.requestPointerLock) {
      try {
        await canvas.requestPointerLock();
      } catch {
        // Prohlížeč může zámek odmítnout. Kamera se pak stále ovládá tažením.
      }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.freeLooking = locked() && allowFreeLook();
    dragging = false;
    input.lookDX = input.lookDY = 0;
    if (locked() && !allowFreeLook()) release();
  });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', (e) => {
    if (input.enabled && (locked() ? allowFreeLook() : dragging)) { input.lookDX += e.movementX; input.lookDY += e.movementY; }
  });
  canvas.addEventListener('wheel', (e) => { input.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  if (IS_TOUCH) initTouch(canvas);
  return () => { if (locked() && !allowFreeLook()) release(); };
}

let updateTouchLabels;
function initTouch(canvas) {
  const gas = document.getElementById('tb-gas'), brake = document.getElementById('tb-brake');
  const hand = document.getElementById('tb-hand'), action = document.getElementById('tb-act');
  let shownMode;
  updateTouchLabels = mode => {
    if (mode === shownMode) return;
    shownMode = mode;
    gas.setAttribute('aria-label', mode === 'heli' ? 'Stoupat' : mode === 'foot' ? 'Jít vpřed' : mode === 'bike' ? 'Šlapat' : 'Plyn');
    brake.setAttribute('aria-label', mode === 'heli' ? 'Klesat' : mode === 'foot' ? 'Jít vzad' : 'Brzdit');
    hand.setAttribute('aria-label', mode === 'heli' ? 'Stoupat' : mode === 'foot' ? 'Skočit' : mode === 'bike' ? 'Brzda elektrokola' : 'Ruční brzda');
    action.setAttribute('aria-label', mode === 'foot' ? 'Nastoupit' : mode === 'shift' ? 'Obsloužit dveře' : 'Vystoupit');
  };
  updateTouchLabels('foot');
  document.body.classList.add('touch');
  const stick = document.getElementById('stick');
  const knob = stick.querySelector('i');
  let stickId = null, lookId = null, lx = 0, ly = 0;
  const setStick = (t) => {
    const r = stick.getBoundingClientRect();
    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    touch.x = dx; touch.y = -dy; touch.active = true;
    knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
  };
  stick.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; stickId = t.identifier; setStick(t); input.usedTouch = true; e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === stickId) setStick(t);
    e.preventDefault();
  }, { passive: false });
  const endStick = (e) => {
    for (const t of e.changedTouches) if (t.identifier === stickId) {
      stickId = null; touch.x = touch.y = 0; touch.active = false; knob.style.transform = '';
    }
  };
  stick.addEventListener('touchend', endStick);
  stick.addEventListener('touchcancel', endStick);

  const hold = (id, prop) => {
    const el = document.getElementById(id);
    const on = (e) => { touch[prop] = true; el.classList.add('on'); input.usedTouch = true; e.preventDefault(); };
    const off = (e) => { touch[prop] = false; el.classList.remove('on'); e.preventDefault(); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
  };
  window.addEventListener('blur', () => {
    stickId = lookId = null;
    Object.assign(touch, { x: 0, y: 0, active: false, gas: false, brake: false, hand: false });
    knob.style.transform = '';
    for (const button of [gas, brake, hand]) button.classList.remove('on');
  });
  hold('tb-gas', 'gas'); hold('tb-brake', 'brake'); hold('tb-hand', 'hand');
  const tap = (id, action) => {
    document.getElementById(id).addEventListener('touchstart', (e) => { input.pressed.add(action); e.preventDefault(); }, { passive: false });
  };
  tap('tb-act', 'action'); tap('tb-job', 'job'); tap('tb-map', 'map');

  // tažení po obrazovce mimo ovladače otáčí kameru
  canvas.addEventListener('touchstart', (e) => {
    if (lookId === null) { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === lookId) {
      input.lookDX += (t.clientX - lx) * 1.6; input.lookDY += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY;
    }
    e.preventDefault();
  }, { passive: false });
  const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  canvas.addEventListener('touchend', endLook);
  canvas.addEventListener('touchcancel', endLook);
}

/** Spojí klávesnici a dotyk do výsledného stavu; volat jednou za snímek. */
export function pollInput(mode) {
  updateTouchLabels?.(mode);
  let x = kb.x, y = kb.y;
  if (touch.active) { x = touch.x; y = touch.y; }
  if (mode !== 'heli') {
    if (touch.gas) y = 1;
    if (touch.brake) y = -1;
  }
  input.moveX = Math.abs(x) < 0.12 ? 0 : x;
  input.moveY = Math.abs(y) < 0.12 ? 0 : y;
  const sprint = touch.active ? Math.max(0, Math.min(1, (Math.hypot(touch.x, touch.y) - 0.7) / 0.3)) : 0;
  input.runAmount = kb.run ? 1 : sprint * sprint * (3 - 2 * sprint);
  input.handbrake = kb.space || touch.hand;
  input.down = kb.run;
  input.lift = Number(input.handbrake || touch.gas) - Number(input.down || touch.brake);
  if (input.debugSteer !== undefined) { input.moveX = input.debugSteer; input.moveY = input.debugThr; }
}

export function endFrame() {
  input.pressed.clear();
  input.lookDX = 0; input.lookDY = 0; input.zoom = 0;
}

export function simulateKey(code, down) {
  if (down) { keys.add(code); if (KEYMAP[code]) input.pressed.add(KEYMAP[code]); } else keys.delete(code);
  refreshKeys();
}
