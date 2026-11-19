import { Euler, Vector3 } from 'three/webgpu';

const moveKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE']);

export class PhotoMode {
  constructor(game, canvas, exit) {
    this.game = game;
    this.canvas = canvas;
    this.active = false;
    this.keys = new Set();
    this.anchor = new Vector3();
    this.step = new Vector3();
    this.angles = new Euler(0,0,0,'YXZ');
    this.toolbar = document.getElementById('photo-controls');
    this.focus = document.getElementById('photo-focus');
    this.focus.addEventListener('input', () => {
      if (game.postfx) game.postfx.photoFocus.value = Number(this.focus.value);
    });
    document.getElementById('photo-exit').addEventListener('click', exit);
    document.getElementById('photo-save').addEventListener('click', () => this.save());
    for (const [id, key] of [['photo-forward','KeyW'], ['photo-back','KeyS']]) {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); this.keys.add(key); });
      el.addEventListener('lostpointercapture', () => this.keys.delete(key));
    }
    document.addEventListener('keydown', e => {
      if (!this.active) return;
      if (['Escape','KeyO'].includes(e.code) && !e.repeat) { e.preventDefault(); e.stopPropagation(); exit(); return; }
      if (moveKeys.has(e.code) && document.activeElement !== this.focus) {
        e.preventDefault(); this.keys.add(e.code);
      }
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', e => {
      if (!this.active) return;
      canvas.setPointerCapture(e.pointerId);
      this.pointer = [e.pointerId,e.clientX,e.clientY];
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.active || e.pointerId !== this.pointer?.[0]) return;
      this.angles.y -= (e.clientX - this.pointer[1]) * .004;
      this.angles.x = Math.min(1.45, Math.max(-1.45, this.angles.x - (e.clientY - this.pointer[2]) * .004));
      this.pointer[1] = e.clientX; this.pointer[2] = e.clientY;
    });
    canvas.addEventListener('lostpointercapture', () => { this.pointer = null; });
  }

  open() {
    const { camera, postfx } = this.game;
    this.anchor.copy(camera.position);
    this.rotation = camera.quaternion.clone();
    this.angles.setFromQuaternion(this.rotation, 'YXZ');
    postfx?.setPhoto(true);
    this.focus.disabled = !postfx;
    this.active = true;
    this.toolbar.hidden = false;
  }

  close() {
    this.active = false;
    this.keys.clear();
    this.pointer = null;
    this.toolbar.hidden = true;
    this.game.camera.position.copy(this.anchor);
    this.game.camera.quaternion.copy(this.rotation);
    this.game.env.update(this.game.camera);
    this.game.postfx?.setPhoto(false);
  }

  update(dt) {
    const { camera } = this.game;
    const held = (a,b) => Number(this.keys.has(a) || this.keys.has(b));
    camera.quaternion.setFromEuler(this.angles);
    this.step.set(held('KeyD','ArrowRight')-held('KeyA','ArrowLeft'), 0,
      held('KeyS','ArrowDown')-held('KeyW','ArrowUp')).applyQuaternion(camera.quaternion);
    this.step.y += Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ'));
    camera.position.addScaledVector(this.step.clampLength(0,1), dt * 16);
    camera.position.sub(this.anchor).clampLength(0,100).add(this.anchor);
    this.game.env.update(camera);
    this.game.render();
  }

  save() {
    this.game.render();
    this.canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url;
      a.download = 'plzen-' + new Date(this.game.clock.now * 1000).toISOString().slice(0,16).replace('T','-').replace(':','-') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, 'image/png');
  }
}
