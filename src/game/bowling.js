import { createBowlingRoom } from '../entities/bowling-room.js';
import { AIM_LIMIT, BowlingLane, PIN_LINE } from '../physics/bowling-lane.js';
import { BowlingRound } from './bowling-rules.js';

const limit = (number, min, max) => Math.max(min, Math.min(number, max));
const formatAngle = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 });
const get = id => document.getElementById('bowl-' + id);
function text(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

export class Bowling {
  constructor(game) {
    this.game = game;
    this.panel = document.getElementById('bowling-panel');
    this.aimField = get('aim');
    this.powerField = get('power');
    this.hit = get('hit');
    this.restart = get('restart');
    this.retry = get('retry');
    this.frames = Array.from(get('frames').children, cell => ({
      cell, marks: cell.querySelector('b'), score: cell.querySelector('span'),
    }));
    this.hit.onclick = () => this.action();
    this.restart.onclick = () => this.newGame();
    this.retry.onclick = () => {
      if (!this.canUse || this.phase !== 'done') return;
      this.saveResult();
      this.refresh();
      (this.saved ? this.restart : this.retry).focus({ preventScroll: true });
    };
    get('leave').onclick = () => { if (this.canUse) game.activities.end('cancelled'); };
    this.aimField.oninput = () => {
      this.aim = this.aimField.valueAsNumber;
      this.showControls();
    };
    this.powerField.oninput = () => {
      this.power = this.powerField.valueAsNumber;
      this.showControls();
    };
  }

  get canUse() { return this.round && !this.game.paused && !this.game.mapOpen; }

  start() {
    this.room ??= createBowlingRoom();
    this.lane = new BowlingLane(this.game.physics.Jolt);
    this.begin(new BowlingRound());
    this.panel.hidden = false;
    this.game.hud.prompt('');
    this.hit.focus({ preventScroll: true });
  }

  begin(round) {
    this.round = round;
    this.phase = 'aim';
    this.saved = this.newRecord = false;
    this.message = 'Nastav směr a sílu hodu.';
    this.aim = 0;
    this.power = 75;
    this.followZ = 0;
    this.lane.prepare(true);
    this.refresh();
  }

  end() {
    this.lane?.dispose();
    this.lane = this.round = null;
    this.panel.hidden = true;
    this.game.promptTimer = 0;
  }

  newGame() {
    if (!this.canUse || !this.saved) return;
    this.saved = false;
    if (!this.game.save()) {
      this.saved = true;
      this.game.hud.toast(this.game.saveError, 'bad');
      return;
    }
    this.begin(new BowlingRound());
    this.hit.focus({ preventScroll: true });
  }

  action() {
    if (!this.canUse || this.phase !== 'aim') return;
    if (this.lane.launch(Math.round(this.aim), Math.round(this.power) / 100)) {
      this.phase = 'rolling';
      this.refresh();
    }
  }

  update(dt, input) {
    if (this.phase === 'aim') {
      if (input.moveX || input.moveY) {
        this.aim = limit(this.aim + input.moveX * 26 * dt, -AIM_LIMIT, AIM_LIMIT);
        this.power = limit(this.power + input.moveY * 48 * dt, 25, 100);
        this.showControls();
      }
      return;
    }
    const { lane } = this;
    const z = limit(lane.ball.GetPosition().GetZ(), 0, PIN_LINE - 1.4);
    this.followZ += (z - this.followZ) * Math.min(1, dt * 6);
    if (this.phase === 'rolling' && lane.result) {
      this.settle(lane.result);
    } else if (this.phase === 'settling') {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.phase = 'aim';
      this.followZ = 0;
      lane.prepare(this.round.freshRack);
      this.refresh();
    }
  }

  settle({ knocked, gutter }) {
    const { round } = this, fresh = round.freshRack, available = round.available;
    round.roll(knocked);
    this.message = fresh && knocked === 10 ? 'Strike! Všech deset kuželek.' :
      !fresh && knocked > 0 && knocked === available ? 'Spare! Sestava dohrána.' :
      gutter && !knocked ? 'Koule skončila ve žlábku.' : `Sražené kuželky · ${knocked}`;
    this.phase = round.complete ? 'done' : 'settling';
    if (round.complete) this.saveResult();
    else this.wait = .55;
    this.refresh();
    if (round.complete && document.activeElement === this.hit) {
      (this.saved ? this.restart : this.retry).focus({ preventScroll: true });
    }
  }

  saveResult() {
    if (!this.round.complete || this.saved) return;
    const { stats } = this.game, score = this.round.total;
    const better = stats.bowlingBest === undefined || score > stats.bowlingBest;
    this.saved = this.game.commitAccount({ stats: better ? { ...stats, bowlingBest: score } : stats, activity: null });
    this.newRecord = this.saved && better;
  }

  showControls() {
    const aim = Math.round(this.aim), power = Math.round(this.power);
    if (aim !== this.shownAim) {
      this.shownAim = aim;
      this.aimField.value = String(aim);
      const label = aim ? `${formatAngle.format(Math.abs(aim) / 10)}° ${aim > 0 ? 'vpravo' : 'vlevo'}` : 'Rovně';
      this.aimField.setAttribute('aria-valuetext', label);
      text(get('aim-value'), label);
    }
    if (power !== this.shownPower) {
      this.shownPower = power;
      this.powerField.value = String(power);
      text(get('power-value'), `${power} %`);
    }
  }

  refresh() {
    const { phase, round } = this, done = phase === 'done', ready = phase === 'aim';
    const sheet = round.sheet;
    for (const [i, { cell, marks, score }] of this.frames.entries()) {
      const row = sheet[i], markText = row?.marks.join(' ') || '·', points = row?.score ?? '';
      cell.toggleAttribute('data-current', i === round.index && !done);
      text(marks, markText);
      text(score, String(points));
      cell.setAttribute('aria-label', `${i + 1}. kolo${row?.marks.length ? `, hody ${markText}, body celkem ${points === '' ? 'čekají' : points}` : ''}`);
    }
    const total = round.total;
    text(get('total'), `${total} ${total === 1 ? 'bod' : total >= 2 && total <= 4 ? 'body' : 'bodů'}`);
    const best = this.game.stats.bowlingBest;
    text(get('record'), best === undefined ? '' : `Rekord ${best}`);
    this.hit.hidden = get('controls').hidden = done;
    this.hit.setAttribute('aria-disabled', String(!ready));
    this.aimField.disabled = this.powerField.disabled = !ready;
    this.restart.hidden = !done || !this.saved;
    this.retry.hidden = !done || this.saved;
    text(get('status'), done ?
      `${this.message} ${this.saved ? this.newRecord ? 'Nový osobní rekord.' : 'Partie dokončena.' : 'Výsledek se nepodařilo uložit.'}` :
      phase === 'rolling' ? 'Koule se kutálí…' : this.message);
    this.showControls();
  }

  render(renderer, aspect) {
    const { lane, room } = this, { camera } = room;
    const copyPose = (mesh, body) => {
      const p = body.GetPosition(), q = body.GetRotation();
      mesh.position.set(p.GetX(), p.GetY(), p.GetZ());
      mesh.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
    };
    copyPose(room.ball, lane.ball);
    room.ball.visible = room.ball.position.y > -.03 && room.ball.position.z < 20.75;
    for (const [i, pin] of lane.pins.entries()) {
      const mesh = room.pins[i];
      mesh.visible = lane.world.bodies.IsAdded(pin.body.GetID());
      if (mesh.visible) copyPose(mesh, pin.body);
    }
    const ready = this.phase === 'aim', narrow = aspect < 1;
    room.guide.visible = ready;
    room.guide.rotation.y = -this.aim * Math.PI / 1800;
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.fov = narrow ? 56 : 47;
      camera.updateProjectionMatrix();
    }
    const z = this.followZ;
    camera.position.set(ready ? .48 : .54, narrow ? 2.55 : 1.82, z - (narrow ? 4.65 : 4.05));
    camera.lookAt(0, narrow ? .35 : .54, Math.min(z + (narrow ? 2.5 : 5.7), PIN_LINE + .8));
    renderer.render(room.scene, camera);
  }
}
