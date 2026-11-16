// Vstup: klávesnice, myš a dotykové ovládání sjednocené do jednoho stavu.
import { IS_TOUCH } from '../config.js';

export const input = {
  moveX: 0,          // -1 vlevo … 1 vpravo
  moveY: 0,          // -1 vzad … 1 vpřed
  run: false,
  handbrake: false,  // mezerník (ruční brzda / skok / stoupání)
  down: false,       // Shift ve vrtulníku = klesání
  lookDX: 0, lookDY: 0, zoom: 0,
  pressed: new Set(),
  enabled: false,
  usedTouch: false,
};

const keys = new Set();
const KEYMAP = {
  KeyF: 'action', KeyE: 'action', Enter: 'action',
  KeyJ: 'job', KeyM: 'map', KeyC: 'camera', KeyH: 'horn', KeyR: 'reset',
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

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!input.enabled) { if (e.code === 'Escape') input.pressed.add('menu'); return; }
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat && KEYMAP[e.code]) input.pressed.add(KEYMAP[e.code]);
    keys.add(e.code);
    refreshKeys();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); refreshKeys(); });
  addEventListener('blur', () => { keys.clear(); refreshKeys(); });

  // myš: tažením se otáčí kamera, kolečkem se přibližuje
  let dragging = false;
  canvas.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', (e) => {
    if (dragging && input.enabled) { input.lookDX += e.movementX; input.lookDY += e.movementY; }
  });
  canvas.addEventListener('wheel', (e) => { input.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  if (IS_TOUCH) initTouch(canvas);
}

function initTouch(canvas) {
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
export function pollInput() {
  let x = kb.x, y = kb.y;
  if (touch.active) { x = touch.x; y = touch.y; }
  if (touch.gas) y = 1;
  if (touch.brake) y = -1;
  input.moveX = Math.abs(x) < 0.12 ? 0 : x;
  input.moveY = Math.abs(y) < 0.12 ? 0 : y;
  input.run = kb.run || (touch.active && Math.hypot(touch.x, touch.y) > 0.85);
  input.handbrake = kb.space || touch.hand;
  input.down = kb.run;
  input.touchDrive = touch.gas || touch.brake;
}

export function endFrame() {
  input.pressed.clear();
  input.lookDX = 0; input.lookDY = 0; input.zoom = 0;
}

export function simulateKey(code, down) {
  if (down) { keys.add(code); if (KEYMAP[code]) input.pressed.add(KEYMAP[code]); } else keys.delete(code);
  refreshKeys();
}
