import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { BALL_RADIUS, BALL_STARTS, PoolTable } from '../physics/pool-table.js';

const field = name => document.getElementById('pool-' + name);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export class PoolPractice {
  constructor(bowling) {
    this.bowling = bowling;
    this.panel = field('panel');
    this.angle = field('angle');
    this.power = field('power');
    this.camera = new PerspectiveCamera(55, 1, .045, 45);
    this.target = new Vector3();
    this.startPosition = new Vector3();
    this.startRotation = this.camera.quaternion.clone();
    this.angle.oninput = () => { this.degrees = this.angle.valueAsNumber; this.showAim(); };
    this.power.oninput = () => { this.strength = this.power.valueAsNumber; this.showAim(); };
    field('hit').onclick = () => this.action();
    field('back').onclick = () => { if (bowling.canUse) this.leave(); };
    field('reset').onclick = () => {
      if (!this.table || !bowling.canUse || this.table.rolling) return;
      this.table.reset();
      this.refresh();
      field('hit').focus();
    };
  }

  enter() {
    const bowl = this.bowling;
    if (!bowl.canUse || this.table || !['done', 'aim'].includes(bowl.phase)) return;
    this.table = new PoolTable(bowl.game.physics.Jolt);
    this.startPosition.copy(bowl.room.camera.position);
    this.startRotation.copy(bowl.room.camera.quaternion);
    this.approach = 0;
    this.width = 0;
    this.panel.hidden = false;
    this.degrees = 0;
    this.strength = 65;
    this.showAim();
    this.refresh();
    field('hit').focus({ preventScroll: true });
  }

  leave() {
    if (!this.table) return;
    this.table.dispose();
    this.table = null;
    this.panel.hidden = true;
    const { pool } = this.bowling.room;
    pool.cue.visible = false;
    pool.balls.forEach((mesh, i) => {
      mesh.visible = true;
      mesh.position.set(BALL_STARTS[i][0], BALL_RADIUS, BALL_STARTS[i][1]);
    });
    document.getElementById('bowl-pool').focus({ preventScroll: true });
  }

  showAim() {
    const angle = Math.round(this.degrees), power = Math.round(this.strength);
    this.angle.value = String(angle);
    this.power.value = String(power);
    field('angle-value').value = angle + '°';
    field('power-value').value = power + ' %';
  }

  action() {
    if (this.table && this.bowling.canUse && this.table.launch(this.degrees, this.strength / 100)) this.refresh();
  }

  refresh() {
    const { rolling, complete, potted, scratch } = this.table;
    const ready = !rolling && !complete;
    this.angle.disabled = this.power.disabled = field('hit').disabled = !ready;
    field('reset').disabled = rolling;
    field('status').textContent = rolling ? 'Koule jsou v pohybu.' : complete ? 'Všechny tři koule jsou v kapsách.' :
      (scratch ? 'Bílá je zpět na stole. ' : '') + 'V kapsách ' + potted + ' ze 3';
  }

  update(dt, input) {
    this.approach = Math.min(1, this.approach + dt / .65);
    if (this.table.rolling) return;
    if (!this.table.complete && (input.moveX || input.moveY)) {
      this.degrees = ((this.degrees + input.moveX * 70 * dt + 540) % 360) - 180;
      this.strength = clamp(this.strength + input.moveY * 45 * dt, 10, 100);
      this.showAim();
    }
    if (field('reset').disabled) {
      this.refresh();
      (this.table.complete ? field('reset') : field('hit')).focus({ preventScroll: true });
    }
  }

  render(renderer, aspect) {
    const { room } = this.bowling, { group, balls, cue } = room.pool;
    const { table, camera } = this;
    for (const [i, body] of table.balls.entries()) {
      const mesh = balls[i];
      mesh.visible = table.world.bodies.IsAdded(body.GetID());
      if (mesh.visible) {
        const p = body.GetPosition();
        mesh.position.set(p.GetX(), BALL_RADIUS, p.GetZ());
      }
    }
    cue.visible = !table.rolling && !table.complete;
    cue.position.copy(balls[0].position);
    cue.rotation.y = -this.degrees * Math.PI / 180;
    const { clientWidth: width, clientHeight: height } = renderer.domElement;
    // Zaber celý stůl v prostoru mezi názvem herny a ovládáním.
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      const header = this.panel.querySelector('header').getBoundingClientRect();
      const controls = field('console').getBoundingClientRect();
      const top = header.bottom + 6, bottom = controls.top - 6;
      const vertical = aspect >= 1 ? 1.72 : 2.95, horizontal = aspect >= 1 ? 2.98 : 1.55;
      const viewHeight = Math.max(vertical * height / Math.max(70, bottom - top), horizontal / aspect);
      camera.fov = 2 * Math.atan(viewHeight / 4.35) * 180 / Math.PI;
      camera.aspect = aspect;
      camera.setViewOffset(width, height, 0, height / 2 - (top + bottom) / 2, width, height);
    }
    camera.position.copy(group.position);
    camera.position.y += 2.18;
    camera.position.x -= .12;
    camera.up.set(aspect >= 1 ? 1 : 0, 0, aspect >= 1 ? 0 : -1);
    camera.lookAt(this.target.copy(group.position));
    const t = this.approach * this.approach * (3 - 2 * this.approach);
    camera.position.lerp(this.startPosition, 1 - t);
    camera.quaternion.slerp(this.startRotation, 1 - t);
    renderer.render(room.scene, camera);
  }
}
