import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { BALL_RADIUS, BALL_STARTS, HALF_LENGTH, HALF_WIDTH, POCKET_RADIUS, PoolTable } from '../physics/pool-table.js';
import { planTableShot } from './pool-opponent.js';

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
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.aimPlane = new Plane(new Vector3(0, 1, 0));
    const surface = field('aim-surface');
    surface.onpointerdown = event => {
      if (event.isPrimary && event.button === 0 && this.aimAt(event)) {
        surface.setPointerCapture(event.pointerId);
        field('hit').focus({ preventScroll: true });
      }
    };
    surface.onpointermove = event => {
      if (surface.hasPointerCapture(event.pointerId)) this.aimAt(event);
    };
    this.angle.oninput = () => { this.degrees = this.angle.valueAsNumber; this.showAim(); };
    this.power.oninput = () => { this.strength = this.power.valueAsNumber; this.showAim(); };
    field('hit').onclick = () => this.action();
    field('back').onclick = () => { if (bowling.canUse) this.leave(); };
    field('reset').onclick = () => {
      if (!this.table || !bowling.canUse || this.table.rolling) return;
      const match = this.table.match;
      this.table.reset(match ? 3 - match.starter : 1);
      if (match) { this.degrees = 90; this.strength = 100; this.showAim(); }
      this.refresh();
      field('hit').focus();
    };
  }

  get computer() { return !!this.table?.match?.computer; }

  get computerTurn() {
    return this.computer && this.table?.match.player === 2 && !this.table.complete;
  }

  enter(match = false) {
    const bowl = this.bowling;
    if (!bowl.canUse || this.table || !['done', 'aim'].includes(bowl.phase)) return;
    this.computerDelay = 0;
    this.table = new PoolTable(bowl.game.physics.Jolt, match);
    this.startPosition.copy(bowl.room.camera.position);
    this.startRotation.copy(bowl.room.camera.quaternion);
    this.approach = 0;
    this.width = 0;
    this.panel.hidden = false;
    this.degrees = match ? 90 : 0;
    this.strength = match ? 100 : 65;
    this.panel.querySelector('h2').textContent = this.computer ? 'Osmička proti počítači' : match ? 'Osmička pro dva' : 'Kulečník U Papírny';
    this.showAim();
    this.refresh();
    field('hit').focus({ preventScroll: true });
  }

  leave() {
    if (!this.table) return;
    this.table.dispose();
    this.table = null;
    this.computerDelay = 0;
    this.panel.hidden = true;
    const { pool } = this.bowling.room;
    pool.cue.visible = false;
    pool.balls.forEach((mesh, i) => {
      mesh.visible = i < BALL_STARTS.length;
      if (mesh.visible) mesh.position.set(BALL_STARTS[i][0], BALL_RADIUS, BALL_STARTS[i][1]);
    });
    document.getElementById('bowl-pool').focus({ preventScroll: true });
  }

  aimAt(event) {
    if (!this.table || !this.bowling.canUse || this.computerTurn || this.table.rolling || this.table.complete) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2);
    const origin = this.bowling.room.pool.group.position;
    this.aimPlane.constant = -(origin.y + BALL_RADIUS);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, this.target)) return false;
    const x = this.target.x - origin.x, z = this.target.z - origin.z;
    if (Math.abs(x) > HALF_WIDTH + POCKET_RADIUS || Math.abs(z) > HALF_LENGTH + POCKET_RADIUS) return false;
    if (this.table.match?.inHand) return this.table.placeWhite(x, z);
    const white = this.table.balls[0].GetPosition();
    const dx = x - white.GetX(), dz = z - white.GetZ();
    if (Math.hypot(dx, dz) < BALL_RADIUS) return false;
    this.degrees = Math.atan2(dz, dx) * 180 / Math.PI;
    this.showAim();
    return true;
  }

  showAim() {
    const angle = Math.round(this.degrees), power = Math.round(this.strength);
    this.angle.value = String(angle);
    this.power.value = String(power);
    field('angle-value').value = angle + '°';
    field('power-value').value = power + ' %';
  }

  action() {
    if (!this.table || !this.bowling.canUse || this.computerTurn) return;
    if (this.table.match?.inHand) {
      this.table.match.inHand = false;
      this.table.match.message = 'Zamiř a zahraj.';
    } else if (!this.table.launch(this.degrees, this.strength / 100)) return;
    this.refresh();
  }

  refresh() {
    const { rolling, complete, potted, scratch } = this.table;
    const ready = !rolling && !complete && !this.computerTurn;
    const match = this.table.match;
    field('hit').disabled = !ready;
    this.angle.disabled = this.power.disabled = !ready || !!match?.inHand;
    field('hit').querySelector('span').textContent = match?.inHand ? 'Položit bílou' : 'Strčit';
    field('reset').hidden = !!match && !complete;
    field('reset').textContent = match ? 'Odveta' : 'Rozestavit koule';
    field('hint').textContent = this.computerTurn ? (rolling ? 'Počkej, až se koule zastaví.' : 'Soupeř míří.') : match?.inHand ? 'Klepni na volné místo a potvrď polohu bílé.' :
      match?.breakShot ? 'Rozstřel míří na vrchol trojúhelníku. Klepni na Strčit.' :
      match && !match.groups[match.player] ? 'První čistě potopená koule po rozstřelu určí skupinu.' :
      match ? 'Po svých sedmi koulích pošli černou do libovolné kapsy.' :
      'Klepni na stůl tam, kam má jet bílá koule.';
    this.width = 0;
    field('reset').disabled = rolling;
    const moving = this.computer ? (this.computerTurn ? 'Strk počítače.' : 'Tvůj strk.') : `Hraje hráč ${match?.player}.`;
    const status = field('status');
    const target = !rolling && match?.targetBall;
    if (target) status.dataset.ball = target;
    else delete status.dataset.ball;
    status.textContent = match ? (rolling ? moving + ' Koule jsou v pohybu.' : match.status) : rolling ? 'Koule jsou v pohybu.' : complete ? 'Všechny tři koule jsou v kapsách.' :
      (scratch ? 'Bílá je zpět na stole. ' : '') + 'V kapsách ' + potted + ' ze 3';
  }

  update(dt, input) {
    this.approach = Math.min(1, this.approach + dt / .65);
    if (this.table.rolling) return;
    if (field('reset').disabled) {
      this.refresh();
      if (!this.computerTurn) (this.table.complete ? field('reset') : field('hit')).focus({ preventScroll: true });
    }
    if (this.computerTurn) {
      if (this.bowling.canUse) this.playComputer(dt);
      return;
    }
    if (this.table.match?.inHand && (input.moveX || input.moveY)) {
      const white = this.table.balls[0].GetPosition();
      const dx = input.moveX * .45 * dt, dy = input.moveY * .45 * dt;
      const landscape = this.camera.aspect >= 1;
      this.table.placeWhite(white.GetX() + (landscape ? dy : dx), white.GetZ() + (landscape ? dx : -dy));
    } else if (!this.table.complete && (input.moveX || input.moveY)) {
      this.degrees = ((this.degrees + input.moveX * 70 * dt + 540) % 360) - 180;
      this.strength = clamp(this.strength + input.moveY * 45 * dt, 10, 100);
      this.showAim();
    }
  }

  playComputer(dt) {
    if (!this.computerDelay) {
      const shot = planTableShot(this.table);
      if (shot.placement) this.table.placeWhite(shot.placement.x, shot.placement.z);
      this.table.match.inHand = false;
      this.degrees = shot.degrees;
      this.strength = shot.power * 100;
      this.showAim();
      this.refresh();
      this.computerDelay = .95;
      return;
    }
    this.computerDelay = Math.max(0, this.computerDelay - dt);
    if (!this.computerDelay) {
      this.table.launch(this.degrees, this.strength / 100);
      this.refresh();
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
    cue.visible = !table.rolling && !table.complete && !table.match?.inHand;
    cue.position.copy(balls[0].position);
    cue.rotation.y = -this.degrees * Math.PI / 180;
    if (cue.visible) {
      const angle = -cue.rotation.y, dx = Math.cos(angle), dz = Math.sin(angle);
      const { x, z } = cue.position;
      // Konec čáry je místo, kam se dostane střed bílé před prvním dotykem.
      let distance = Math.min(
        Math.abs(dx) < 1e-8 ? Infinity : ((HALF_WIDTH - BALL_RADIUS) * Math.sign(dx) - x) / dx,
        Math.abs(dz) < 1e-8 ? Infinity : ((HALF_LENGTH - BALL_RADIUS) * Math.sign(dz) - z) / dz);
      for (let i = 1; i < balls.length; i++) {
        if (!balls[i].visible) continue;
        const bx = balls[i].position.x - x, bz = balls[i].position.z - z;
        const along = bx * dx + bz * dz, across = bx * dz - bz * dx;
        if (along > 0 && Math.abs(across) < 2 * BALL_RADIUS) {
          distance = Math.min(distance, along - Math.sqrt((2 * BALL_RADIUS) ** 2 - across ** 2));
        }
      }
      const length = Math.max(0, distance - BALL_RADIUS);
      room.pool.guide.scale.x = length;
      room.pool.guide.position.x = BALL_RADIUS + length / 2;
    }
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
