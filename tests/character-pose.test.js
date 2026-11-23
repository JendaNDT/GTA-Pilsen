import assert from 'node:assert/strict';
import test from 'node:test';
import {
  characterPose, JOINT_LIMITS, landingStrength, phaseRate, RUN_SPEED, strideLength, WALK_SPEED,
} from '../src/entities/character-pose.js';
import { parts } from '../src/physics/ragdoll.js';

const TAU = Math.PI * 2;
const sample = (state) => characterPose({ grounded: true, time: 3, phase: 0, ...state });

test('frekvence kroků odpovídá člověku a boty po zemi neklouzají', () => {
  const cadence = (speed) => 2 * 60 * phaseRate(speed) / TAU;   // kroků za minutu (dva na cyklus)
  assert.ok(cadence(1.3) > 95 && cadence(1.3) < 125, `chodec ${cadence(1.3)}`);
  assert.ok(cadence(WALK_SPEED) > 135 && cadence(WALK_SPEED) < 165, `chůze ${cadence(WALK_SPEED)}`);
  assert.ok(cadence(RUN_SPEED) > 165 && cadence(RUN_SPEED) < 195, `běh ${cadence(RUN_SPEED)}`);
  // za jeden cyklus (2π) urazí postava právě délku kroku
  for (const speed of [0.8, 1.4, WALK_SPEED, 4, RUN_SPEED]) {
    const seconds = TAU / phaseRate(speed);
    assert.ok(Math.abs(seconds * speed - strideLength(speed)) < 1e-9);
  }
  assert.equal(phaseRate(0), 0);
  assert.ok(strideLength(RUN_SPEED) > strideLength(WALK_SPEED));
});

test('natočení kloubů nikdy nepřekročí meze fyzikální postavy', () => {
  const names = parts.map((part) => part.name);
  let checked = 0;
  for (const swimming of [false, true]) for (const grounded of [true, false]) {
    for (const speed of [0, 0.7, 1.5, WALK_SPEED, 4, RUN_SPEED, 8]) {
      for (let k = 0; k < 24; k++) {
        const pose = characterPose({
          speed, phase: k * TAU / 24, time: k * 0.7, idle: k, grounded, vy: (k % 7) - 5, swimming,
          landing: (k % 5) / 4, turn: (k % 3) - 1, seed: k,
        });
        assert.deepEqual(Object.keys(pose.joints).sort(), [...names].sort());
        for (const [name, [x, y, z]] of Object.entries(pose.joints)) {
          for (const value of [x, y, z]) assert.ok(Number.isFinite(value), name);
          const range = JOINT_LIMITS[name];
          if (!range) continue;
          assert.ok(x >= range.x[0] - 1e-9 && x <= range.x[1] + 1e-9, `${name} x ${x}`);
          assert.ok(y >= range.y[0] - 1e-9 && y <= range.y[1] + 1e-9, `${name} y ${y}`);
          assert.ok(z >= range.z[0] - 1e-9 && z <= range.z[1] + 1e-9, `${name} z ${z}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1000);
  // koleno a loket se ohýbají jen jedním směrem
  assert.ok(JOINT_LIMITS.lytko1.x[1] > 2 && JOINT_LIMITS.predlokti1.x[0] < -2);
});

test('nohy a ruce se při chůzi střídají a paže jde proti noze téže strany', () => {
  const quarter = sample({ speed: WALK_SPEED, phase: Math.PI / 2 });   // noha 1 vpředu
  // záporné x = končetina vpředu
  assert.ok(quarter.joints.stehno1[0] < -0.2 && quarter.joints['stehno-1'][0] > 0.2);
  assert.ok(quarter.joints.paze1[0] > 0.15 && quarter.joints['paze-1'][0] < -0.15);
  // o půl cyklu později je to naopak
  const half = sample({ speed: WALK_SPEED, phase: Math.PI * 1.5 });
  assert.ok(half.joints.stehno1[0] > 0.2 && half.joints['stehno-1'][0] < -0.2);
  // koleno je nejvíc ohnuté, když noha jde dopředu (fáze švihu), a natažené při došlapu
  const swing = sample({ speed: WALK_SPEED, phase: 0 }).joints.lytko1[0];
  assert.ok(swing > quarter.joints.lytko1[0] + 0.3, `${swing} > ${quarter.joints.lytko1[0]}`);
});

test('běh má delší krok, předklon, pokrčené lokty a víc pohupování než chůze', () => {
  const walk = sample({ speed: WALK_SPEED, phase: Math.PI / 2 });
  const run = sample({ speed: RUN_SPEED, phase: Math.PI / 2 });
  assert.ok(Math.abs(run.joints.stehno1[0]) > Math.abs(walk.joints.stehno1[0]) + 0.15);
  assert.ok(run.root.x > walk.root.x + 0.1, 'předklon při běhu');
  assert.ok(run.joints.predlokti1[0] < -1.2 && walk.joints.predlokti1[0] > -0.5, 'lokty');
  const bob = (speed) => {
    let low = Infinity, high = -Infinity;
    for (let k = 0; k < 32; k++) {
      const y = sample({ speed, phase: k * TAU / 32 }).root.y;
      low = Math.min(low, y); high = Math.max(high, y);
    }
    return high - low;
  };
  assert.ok(bob(RUN_SPEED) > bob(WALK_SPEED) * 1.8);
  assert.ok(bob(WALK_SPEED) > 0.02 && bob(RUN_SPEED) < 0.12);
});

test('vestoje postava dýchá, přenáší váhu a po chvíli se rozhlédne', () => {
  const breathe = [0, 1, 2].map((t) => sample({ speed: 0, time: t }).joints.hrudnik[0]);
  assert.ok(Math.max(...breathe) - Math.min(...breathe) > 0.01, 'dýchání');
  assert.ok(Math.max(...breathe.map(Math.abs)) < 0.05, 'jen nepatrně');
  const heads = (idle) => [0, 3, 6, 9, 12].map((t) => sample({ speed: 0, time: t, idle }).joints.hlava[1]);
  const span = (values) => Math.max(...values) - Math.min(...values);
  assert.ok(span(heads(0)) < 1e-9, 'hned po zastavení se nerozhlíží');
  assert.ok(span(heads(10)) > 0.2, 'po chvíli stání se rozhlíží');
  // nohy rovně, ruce volně podél těla mírně od boků
  const idle = sample({ speed: 0 });
  assert.ok(Math.abs(idle.joints.stehno1[0]) < 0.05 && idle.joints.lytko1[0] < 0.1);
  assert.ok(idle.joints.paze1[2] > 0 && idle.joints['paze-1'][2] < 0);
});

test('ve skoku pokrčí nohy, při pádu je natáhne a roztáhne ruce, dopad je podřep', () => {
  const rising = sample({ speed: 2, grounded: false, vy: 4 });
  const falling = sample({ speed: 2, grounded: false, vy: -8 });
  assert.ok(rising.joints.lytko1[0] > falling.joints.lytko1[0] + 0.4, 'kolena');
  assert.ok(falling.joints.paze1[2] > rising.joints.paze1[2] + 0.3, 'ruce do stran');
  const soft = sample({ speed: 0, landing: 0.2 }), hard = sample({ speed: 0, landing: 1 });
  assert.ok(hard.root.y < soft.root.y - 0.08, 'hlubší podřep po tvrdém dopadu');
  assert.ok(hard.joints.lytko1[0] > 0.7);
  assert.equal(landingStrength(-1), 0, 'obyčejný krok není dopad');
  assert.ok(landingStrength(-9) === 1 && landingStrength(-5) > 0.2);
});

test('ve vodě postava plave: v pohybu se skloní a dělá tempa, na místě šlape vodu', () => {
  const tread = sample({ swimming: true, speed: 0, time: 1 });
  const swim = sample({ swimming: true, speed: 1.7, phase: 1, time: 1 });
  assert.ok(swim.root.x > tread.root.x + 0.5, 'při plavání skoro vodorovně');
  const arms = (speed) => [0, 1, 2, 3].map((k) => sample({ swimming: true, speed, phase: k * 1.6, time: k * 0.4 }).joints.paze1[0]);
  const span = (values) => Math.max(...values) - Math.min(...values);
  assert.ok(span(arms(1.7)) > 0.4, 'tempa pažemi');
  assert.ok(swim.joints.hlava[0] < -0.3, 'hlava zvednutá nad hladinu');
});

test('při rychlém běhu do zatáčky se postava nakloní dovnitř, při chůzi téměř ne', () => {
  const left = sample({ speed: RUN_SPEED, phase: 1, turn: 2 }).root.z;
  const right = sample({ speed: RUN_SPEED, phase: 1, turn: -2 }).root.z;
  assert.ok(left < -0.1 && right > 0.1, `${left} ${right}`);
  assert.ok(Math.abs(sample({ speed: 1.2, phase: 1, turn: 2 }).root.z) < 0.03);
});
