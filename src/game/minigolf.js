import * as THREE from 'three/webgpu';
import { GolfBall } from '../physics/golf-ball.js';
import { FIRST_HOLE, CUP_RADIUS, MINIGOLF_RADIUS, RAIL_HEIGHT, RAIL_WIDTH, STROKE_LIMIT, golfWorldPoint } from './minigolf-rules.js';

function buildLane(scene, world, hole) {
  let low = Infinity, high = -Infinity;
  for (const x of [-hole.halfWidth, 0, hole.halfWidth]) {
    for (const z of [hole.start, 0, hole.cup / 2, hole.cup, hole.end]) {
      const point = golfWorldPoint(hole, x, z);
      const ground = world.groundY(point.x, point.z);
      low = Math.min(low, ground);
      high = Math.max(high, ground);
    }
  }
  const surface = high + 0.07;
  const group = new THREE.Group();
  group.position.set(hole.x, surface, hole.z);
  group.rotation.y = hole.yaw;
  const add = (geometry, color, x, y, z, parent = group, basic = false) => {
    const material = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const box = (sx, sy, sz, color, x, y, z) =>
    add(new THREE.BoxGeometry(sx, sy, sz), color, x, y, z);
  const disk = (geometry, color, x, y, z, basic = false) => {
    const mesh = add(geometry, color, x, y, z, group, basic);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  const center = (hole.end + hole.start) / 2, length = hole.end - hole.start;
  const depth = surface - low + 0.12;
  const width = 2 * (hole.halfWidth + RAIL_WIDTH);
  box(width, depth, length, 0x786850, 0, -depth / 2 - 0.018, center);
  const lawn = box(width, 0.018, length, 0x3a8653, 0, -0.009, center);
  lawn.receiveShadow = true;
  for (const side of [-1, 1]) {
    const rail = box(RAIL_WIDTH, RAIL_HEIGHT, length, 0x9a672f,
      side * (hole.halfWidth + RAIL_WIDTH / 2), RAIL_HEIGHT / 2, center);
    rail.castShadow = true;
    rail.receiveShadow = true;
    box(0.23, 0.004, 0.024, 0xe4e4c5, side * 0.26, 0.002, 0);
  }
  disk(new THREE.CircleGeometry(CUP_RADIUS, 28), 0x10241a, 0, 0.003, hole.cup, true);
  disk(new THREE.RingGeometry(CUP_RADIUS, CUP_RADIUS + 0.025, 28), 0xe9e6cc, 0, 0.004, hole.cup);
  add(new THREE.CylinderGeometry(0.016, 0.016, 1.03, 8), 0xfaf3db, 0, 0.515, hole.cup);
  const cloth = new THREE.Shape().moveTo(0, 0.74).lineTo(0.44, 0.88).lineTo(0, 1.03).closePath();
  const flag = add(new THREE.ShapeGeometry(cloth), 0xf8a648, 0, 0, hole.cup);
  flag.material.side = THREE.DoubleSide;

  const ball = add(new THREE.SphereGeometry(MINIGOLF_RADIUS, 16, 10), 0xfff6e1, 0, MINIGOLF_RADIUS, 0);
  ball.castShadow = true;
  const arrow = new THREE.Group();
  group.add(arrow);
  add(new THREE.BoxGeometry(0.035, 0.008, 0.9), 0xffe18c, 0, 0, 0.55, arrow, true);
  const tip = add(new THREE.ConeGeometry(0.077, 0.16, 4), 0xffe18c, 0, 0, 1.06, arrow, true);
  tip.rotation.x = Math.PI / 2;
  ball.visible = arrow.visible = false;
  scene.add(group);
  return { group, ball, arrow, surface };
}

export class Minigolf {
  constructor(game) {
    this.game = game;
    this.hole = FIRST_HOLE;
    this.panel = document.getElementById('minigolf-panel');
    this.aim = this.panel.querySelector('#golf-aim');
    this.power = this.panel.querySelector('#golf-power');
    this.aimValue = this.panel.querySelector('#golf-aim-value');
    this.powerValue = this.panel.querySelector('#golf-power-value');
    this.count = this.panel.querySelector('#golf-count');
    this.status = this.panel.querySelector('#golf-status');
    this.hit = this.panel.querySelector('#golf-hit');
    this.restart = this.panel.querySelector('#golf-restart');
    this.hit.addEventListener('click', () => this.strike());
    this.restart.addEventListener('click', () => {
      if (!this.canUse || this.restart.hidden) return;
      this.ball.restart();
      this.resetAim();
      this.refresh();
      this.hit.focus();
    });
    this.panel.querySelector('#golf-leave').addEventListener('click', () => {
      if (this.canUse) game.activities.end('cancelled');
    });
    for (const field of [this.aim, this.power]) {
      field.addEventListener('input', () => {
        this.controls[field.name] = field.valueAsNumber;
        this.refresh();
      });
    }
    this.shown = {};
    this.resetAim();
  }

  get canUse() { return this.ball && !this.game.paused && !this.game.mapOpen; }

  resetAim() {
    this.controls = { aim: 0, power: 70 };
    this.followReady = false;
  }

  nearby(focus) {
    const near = Math.hypot(focus.x - this.hole.x, focus.z - this.hole.z) < 95;
    if (near && !this.lane) this.lane = buildLane(this.game.scene, this.game.world, this.hole);
    if (this.lane) this.lane.group.visible = near;
  }

  start() {
    this.nearby(this.game.player);
    this.ball = new GolfBall(this.game.physics, this.hole, this.lane.surface);
    this.resetAim();
    this.panel.hidden = false;
    this.refresh();
  }

  end() {
    this.ball.dispose();
    this.ball = null;
    this.lane.ball.visible = this.lane.arrow.visible = false;
    this.panel.hidden = true;
  }

  strike() {
    if (!this.canUse) return;
    const angle = THREE.MathUtils.degToRad(Math.round(this.controls.aim));
    if (this.ball.strike(angle, Math.round(this.controls.power) / 100)) this.refresh();
  }

  input(dt, x, y) {
    if (this.ball.score.phase !== 'aim' || (!x && !y)) return;
    this.controls.aim = THREE.MathUtils.clamp(this.controls.aim + x * 55 * dt, -175, 175);
    this.controls.power = THREE.MathUtils.clamp(this.controls.power + y * 55 * dt, 0, 100);
  }

  refresh() {
    const { ball, lane } = this;
    if (!ball) return;
    const { phase, strokes, lastResult } = ball.score;
    const aiming = phase === 'aim', done = phase === 'holed' || phase === 'limit';
    const aim = Math.round(this.controls.aim), power = Math.round(this.controls.power);
    const shown = this.shown;
    if (shown.phase !== phase) {
      const refocus = done && this.hit === document.activeElement;
      this.aim.disabled = this.power.disabled = !aiming;
      this.hit.setAttribute('aria-disabled', String(!aiming));
      this.hit.hidden = done;
      this.restart.hidden = !done;
      if (refocus) this.restart.focus();
    }
    if (shown.aim !== aim) {
      this.aim.value = aim;
      this.aimValue.textContent = aim === 0 ? 'Rovně' : `${Math.abs(aim)}° ${aim > 0 ? 'vpravo' : 'vlevo'}`;
      this.aim.setAttribute('aria-valuetext', this.aimValue.textContent);
    }
    if (shown.power !== power) {
      this.power.value = power;
      this.powerValue.textContent = `${power} %`;
    }
    if (shown.strokes !== strokes) this.count.textContent = `${strokes} / ${STROKE_LIMIT} úderů`;
    if (shown.phase !== phase || shown.lastResult !== lastResult) {
      const messages = {
        holed: 'Míček je v jamce.',
        limit: lastResult === 'out' ? 'Mimo dráhu. Dosažen limit sedmi úderů.' : 'Dosažen limit sedmi úderů.',
        rolling: 'Míček se kutálí…',
        aim: lastResult === 'out' ? 'Mimo dráhu · trestný úder. Míček se vrátil.' :
          'Zamiř, nastav sílu a zahraj.',
      };
      this.status.textContent = messages[phase];
    }
    shown.phase = phase;
    shown.aim = aim;
    shown.power = power;
    shown.strokes = strokes;
    shown.lastResult = lastResult;
    lane.ball.position.set(ball.x, ball.y, ball.z);
    lane.ball.visible = phase !== 'holed';
    lane.arrow.visible = aiming;
    lane.arrow.position.set(ball.x, 0.019, ball.z);
    lane.arrow.rotation.y = -THREE.MathUtils.degToRad(aim);
    lane.arrow.scale.z = 0.55 + power * 0.011;
  }

  camera(dt, camera, info) {
    const { ball, hole, lane } = this;
    if (!this.followReady) {
      this.followX = ball.x;
      this.followZ = ball.z;
      this.followReady = true;
    }
    const amount = Math.min(1, dt * 9);
    this.followX = THREE.MathUtils.lerp(this.followX, ball.x, amount);
    this.followZ = THREE.MathUtils.lerp(this.followZ, ball.z, amount);
    const narrow = camera.aspect < 1;
    const behind = narrow ? 4.5 : 3.5;
    const eye = golfWorldPoint(hole, this.followX, this.followZ - behind);
    const target = golfWorldPoint(hole, this.followX, this.followZ + (narrow ? 1.4 : 1.85));
    camera.position.set(eye.x, lane.surface + (narrow ? 5.1 : 3.6), eye.z);
    camera.lookAt(target.x, lane.surface, target.z);
    info.x = eye.x;
    info.z = eye.z;
    info.fx = ball.sin;
    info.fz = ball.cos;
  }
}
