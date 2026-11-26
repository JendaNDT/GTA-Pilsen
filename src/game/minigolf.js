import * as THREE from 'three/webgpu';
import { GolfBall } from '../physics/golf-ball.js';
import { ACTIVITY_SITES } from './activity-sites.js';
import { GOLF_HOLES, GolfRound, CUP_RADIUS, MINIGOLF_RADIUS, RAIL_HEIGHT, RAIL_WIDTH, STROKE_LIMIT, golfWorldPoint } from './minigolf-rules.js';

function buildLane(course, world, hole) {
  let low = Infinity, high = -Infinity;
  for (const x of [-hole.halfWidth, 0, hole.halfWidth]) {
    for (const z of [hole.start, 0, hole.cupZ / 2, hole.cupZ, hole.end]) {
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
  for (const obstacle of hole.obstacles) {
    const { width, length, height, x, z } = obstacle;
    const block = box(width, height, length, 0xb28b5e, x, height / 2, z);
    block.castShadow = true;
    block.receiveShadow = true;
    box(width * 0.9, 0.005, length * 0.86, 0xd1b98c, x, height + 0.002, z);
  }
  disk(new THREE.CircleGeometry(CUP_RADIUS, 28), 0x10241a, hole.cupX, 0.003, hole.cupZ, true);
  disk(new THREE.RingGeometry(CUP_RADIUS, CUP_RADIUS + 0.025, 28), 0xe9e6cc, hole.cupX, 0.004, hole.cupZ);
  add(new THREE.CylinderGeometry(0.016, 0.016, 1.03, 8), 0xfaf3db, hole.cupX, 0.515, hole.cupZ);
  const cloth = new THREE.Shape().moveTo(0, 0.74).lineTo(0.44, 0.88).lineTo(0, 1.03).closePath();
  const flag = add(new THREE.ShapeGeometry(cloth), 0xf8a648, hole.cupX, 0, hole.cupZ);
  flag.material.side = THREE.DoubleSide;

  const ball = add(new THREE.SphereGeometry(MINIGOLF_RADIUS, 16, 10), 0xfff6e1, 0, MINIGOLF_RADIUS, 0);
  ball.castShadow = true;
  const arrow = new THREE.Group();
  group.add(arrow);
  add(new THREE.BoxGeometry(0.035, 0.008, 0.9), 0xffe18c, 0, 0, 0.55, arrow, true);
  const tip = add(new THREE.ConeGeometry(0.077, 0.16, 4), 0xffe18c, 0, 0, 1.06, arrow, true);
  tip.rotation.x = Math.PI / 2;
  ball.visible = arrow.visible = false;
  course.add(group);
  return { group, ball, arrow, surface };
}

function buildRental(world, course) {
  const { golf } = ACTIVITY_SITES[0];
  const sign = new THREE.Group();
  const x = golf.x + 1.05, z = golf.z + 0.15;
  sign.position.set(x, world.groundY(x, z), z);
  sign.rotation.y = Math.PI * 0.73;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x886d51 }));
  base.position.y = 0.05;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.18, 0.075),
    new THREE.MeshStandardMaterial({ color: 0x886d51 }));
  pole.position.y = 0.64;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#22392c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f0d58a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 25px system-ui';
  ctx.fillText('MINIGOLF', 128, 42);
  ctx.font = '18px system-ui';
  ctx.fillText('PŮJČOVNA HOLÍ', 128, 70);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.356),
    new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
  plate.position.set(0, 1.17, 0.045);
  sign.add(base, pole, plate);
  course.add(sign);
}

function text(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

export class Minigolf {
  constructor(game) {
    this.game = game;
    this.panel = document.getElementById('minigolf-panel');
    this.title = this.panel.querySelector('#golf-title');
    this.aim = this.panel.querySelector('#golf-aim');
    this.power = this.panel.querySelector('#golf-power');
    this.aimValue = this.panel.querySelector('#golf-aim-value');
    this.powerValue = this.panel.querySelector('#golf-power-value');
    this.count = this.panel.querySelector('#golf-count');
    this.controlsBox = this.panel.querySelector('.golf-controls');
    this.summary = this.panel.querySelector('#golf-round');
    this.record = this.panel.querySelector('#golf-record');
    this.status = this.panel.querySelector('#golf-status');
    this.hit = this.panel.querySelector('#golf-hit');
    this.next = this.panel.querySelector('#golf-next');
    this.restart = this.panel.querySelector('#golf-restart');
    this.retry = this.panel.querySelector('#golf-retry');
    this.leave = this.panel.querySelector('#golf-leave');
    this.hit.addEventListener('click', () => this.strike());
    this.next.addEventListener('click', () => this.walkToNext());
    this.restart.addEventListener('click', () => this.restartRound());
    this.retry.addEventListener('click', () => {
      if (!this.canUse || this.retry.hidden) return;
      this.saveResult();
      this.refresh();
      if (this.saved) this.restart.focus({ preventScroll: true });
    });
    this.leave.addEventListener('click', () => {
      if (this.canUse) game.activities.end('cancelled');
    });
    for (const field of [this.aim, this.power]) {
      field.addEventListener('input', () => {
        this.controls[field.name] = field.valueAsNumber;
        this.refresh();
      });
    }
    this.ball = null;
    this.round = null;
    this.shown = {};
  }

  get canUse() { return this.round && !this.game.paused && !this.game.mapOpen; }

  get hole() { return GOLF_HOLES[this.index]; }

  get lane() { return this.lanes[this.index]; }

  get nextEntry() {
    return this.round && !this.ball && !this.round.complete ? this.entries[this.round.scores.length] : null;
  }

  nearby(focus) {
    const first = GOLF_HOLES[0];
    const near = Math.hypot(focus.x - first.x, focus.z - first.z) < 95;
    if (near && !this.course) {
      const { scene, world } = this.game;
      this.course = new THREE.Group();
      this.entries = GOLF_HOLES.map(({ entry = ACTIVITY_SITES[0].golf }) =>
        ({ ...entry, y: world.groundY(entry.x, entry.z) }));
      this.lanes = GOLF_HOLES.map(hole => buildLane(this.course, world, hole));
      buildRental(world, this.course);
      scene.add(this.course);
    }
    if (this.course) this.course.visible = near;
  }

  start() {
    this.round = new GolfRound();
    this.saved = this.newRecord = false;
    this.nearby(this.game.player);
    this.panel.hidden = false;
    this.enterHole();
  }

  enterHole() {
    if (this.ball || this.round.complete) return;
    const { player } = this.game;
    player.place(player.x, player.z, player.y);
    this.game.hud.prompt('');
    this.index = this.round.scores.length;
    this.ball = new GolfBall(this.game.physics, this.hole, this.lane.surface);
    this.controls = { aim: 0, power: 70 };
    this.followReady = false;
    this.refresh();
    if (document.activeElement === this.status) this.hit.focus({ preventScroll: true });
  }

  releaseBall() {
    if (!this.ball) return;
    this.ball.dispose();
    this.ball = null;
    this.lane.ball.visible = this.lane.arrow.visible = false;
  }

  end() {
    this.releaseBall();
    this.round = null;
    this.panel.hidden = true;
  }

  walkToNext() {
    if (!this.canUse || this.next.hidden) return;
    this.showWalk();
  }

  showWalk() {
    this.releaseBall();
    const { game, nextEntry } = this;
    const { player } = game;
    game.camYaw = Math.atan2(nextEntry.x - player.x, nextEntry.z - player.z);
    game.lookIdle = 0;
    game.promptTimer = 0;
    this.refresh();
    this.status.focus({ preventScroll: true });
  }

  restartRound() {
    if (!this.canUse || !this.saved) return;
    const previous = this.round;
    this.round = new GolfRound();
    this.saved = false;
    if (!this.game.save()) {
      this.round = previous;
      this.saved = true;
      this.game.hud.toast(this.game.saveError, 'bad');
      return;
    }
    this.newRecord = false;
    this.showWalk();
  }

  saveResult() {
    if (!this.round.complete || this.saved) return;
    const { stats } = this.game;
    const candidate = this.round.recordCandidate(stats.minigolfBest);
    const updatedStats = candidate === null ? stats : { ...stats, minigolfBest: candidate };
    this.saved = this.game.commitAccount({ stats: updatedStats, activity: null });
    this.newRecord = this.saved && candidate !== null;
  }

  action() {
    if (this.next.hidden) this.strike();
    else this.walkToNext();
  }

  strike() {
    if (!this.canUse || !this.ball) return;
    const angle = THREE.MathUtils.degToRad(Math.round(this.controls.aim));
    if (this.ball.strike(angle, Math.round(this.controls.power) / 100)) this.refresh();
  }

  input(dt, x, y) {
    if (this.ball.score.phase !== 'aim' || (!x && !y)) return;
    this.controls.aim = THREE.MathUtils.clamp(this.controls.aim + x * 55 * dt, -175, 175);
    this.controls.power = THREE.MathUtils.clamp(this.controls.power + y * 55 * dt, 0, 100);
  }

  refresh() {
    const { ball, round } = this;
    const score = ball?.score;
    if (score && round.finishHole(this.index, score) && round.complete) this.saveResult();
    const walking = !ball, aiming = score?.phase === 'aim', rolling = score?.phase === 'rolling';
    const done = !walking && !aiming && !rolling;
    const active = document.activeElement;
    const holeNo = (walking ? round.scores.length : this.index) + 1;
    const shown = this.shown;
    const screen = walking ? 'walking' : round.complete ? (this.saved ? 'saved' : 'unsaved') : score.phase;
    if (shown.screen !== screen) {
      this.panel.toggleAttribute('data-walking', walking);
      this.controlsBox.hidden = this.hit.hidden = walking || done;
      this.hit.setAttribute('aria-disabled', String(!aiming));
      this.next.hidden = !done || round.complete;
      this.restart.hidden = !round.complete || !this.saved;
      this.retry.hidden = !round.complete || this.saved;
      this.aim.disabled = this.power.disabled = !aiming;
      if (done && active === this.hit) {
        const button = round.complete ? (this.saved ? this.restart : this.retry) : this.next;
        button.focus({ preventScroll: true });
      }
      shown.screen = screen;
    }
    text(this.title, `Minigolf · jamka ${holeNo}/${GOLF_HOLES.length}`);
    text(this.count, walking ? '' : `${score.strokes} / ${STROKE_LIMIT} úderů`);
    const total = round.total + (aiming || rolling ? score.strokes : 0);
    const holes = round.scores.length ? ` · jamky ${round.scores.join(' + ')}` : '';
    text(this.summary, `Celkem ${total}${holes}`);
    const best = this.game.stats.minigolfBest;
    text(this.record, best === undefined ? '' : `Osobní rekord ${best}`);
    let message;
    if (walking) message = holeNo === 1 ? 'Vrať se k půjčovně a stiskni F.' : `Dojdi ke značce u jamky ${holeNo} a stiskni F.`;
    else if (round.complete) {
      message = this.saved ? this.newRecord ? 'Partie dokončena. Nový osobní rekord.' : 'Partie dokončena.' :
        'Partie dokončena. Výsledek se nepodařilo uložit.';
    } else if (rolling) message = 'Míček se kutálí…';
    else if (score.phase === 'holed') message = 'Míček je v jamce.';
    else if (score.phase === 'limit') message = score.lastResult === 'out' ?
      'Mimo dráhu. Dosažen limit sedmi úderů.' : 'Dosažen limit sedmi úderů.';
    else message = score.lastResult === 'out' ? 'Mimo dráhu · trestný úder. Míček se vrátil.' : this.hole.hint;
    text(this.status, message);

    if (!ball) return;
    const aim = Math.round(this.controls.aim), power = Math.round(this.controls.power);
    if (shown.aim !== aim) {
      this.aim.value = aim;
      text(this.aimValue, aim === 0 ? 'Rovně' : `${Math.abs(aim)}° ${aim > 0 ? 'vpravo' : 'vlevo'}`);
      this.aim.setAttribute('aria-valuetext', this.aimValue.textContent);
      shown.aim = aim;
    }
    if (shown.power !== power) {
      this.power.value = power;
      text(this.powerValue, `${power} %`);
      shown.power = power;
    }
    const { lane } = this;
    lane.ball.position.set(ball.x, ball.y, ball.z);
    lane.ball.visible = score.phase !== 'holed';
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
