import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSave } from '../src/game/save-data.js';

test('v1 i v2 uchovají platný postup a izolují poškozená pole', () => {
  for (const v of [1, 2]) {
    const record = { v, money: 950, found: {}, garage: { model: 'hatch' },
      stats: { deliveries: 4, shifts: 'chyba' }, car: { model: {} },
      job: { active: {}, last: { type: 'taxi', state: 'paid', note: {} } } };
    const saved = parseSave(JSON.stringify(record));
    assert.deepEqual(saved.found, []);
    assert.equal(saved.money, 950);
    assert.deepEqual(saved.garage, record.garage);
    assert.deepEqual(saved.stats, { deliveries: 4 });
    assert.equal(saved.car, null);
    assert.deepEqual(saved.job, { active: null, last: { type: 'taxi', state: 'paid' } });
  }
});

test('platné památky a poloha zůstanou čitelné, neznámý formát se nepoužije', () => {
  const s = parseSave('{"v":2,"found":["Radnice",7],"x":21,"z":-13,"money":"?"}');
  assert.deepEqual([s.found, s.x, s.z, s.money], [['Radnice'], 21, -13, 500]);
  for (const raw of [null, '[', 'null', '{"v":3}', '[]']) assert.equal(parseSave(raw), null);
});
