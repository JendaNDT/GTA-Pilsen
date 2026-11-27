import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Matrix4, Vector3 } from 'three/webgpu';

// Podrobná auta se staví od střední předvolby. Plátno pro světelný kužel stačí jednoduché.
globalThis.window = {};
globalThis.location = { search: '?quality=medium' };
globalThis.matchMedia = () => ({ matches: false });
const context = new Proxy({}, { get: (_, key) => (key.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };

const { carProfile, smoothNormals, tumblehome } = await import('../src/entities/car-body.js');
const { buildCarGeometry, CAR_TYPES } = await import('../src/entities/models.js');
const { dentCar, restorePanels } = await import('../src/entities/damage.js');
const { Car } = await import('../src/entities/vehicles.js');

const types = Object.keys(CAR_TYPES);

test('bokorys: kola mají volný podběh a karoserie nepřesahuje rozměry typu', () => {
  for (const id of types) {
    const type = CAR_TYPES[id], p = carProfile(type);
    for (const [z, y] of p.lower) {
      assert.ok(Math.abs(z) <= type.len / 2 + 1e-9, `${id}: délka`);
      assert.ok(y >= p.ride - 1e-9 && y <= type.h, `${id}: výška`);
      // nad kolem musí být místo: body podběhu leží vně kružnice kola
      for (const wz of [-p.wheelZ, p.wheelZ]) {
        assert.ok(Math.hypot(z - wz, y - p.wheelR) >= p.wheelR + 0.06 - 1e-9, `${id}: kolo se dotýká karoserie`);
      }
    }
    const [front, roofFront, , roofRear, rear] = p.cabin;
    assert.ok(front[0] > roofFront[0] && roofFront[0] > roofRear[0] && roofRear[0] >= rear[0], `${id}: pořadí kabiny`);
    assert.ok(front[0] < type.len / 2 - 0.3, `${id}: čelní sklo je za kapotou`);
  }
});

test('kabina se ke střeše zužuje a pod pasem má plnou šířku', () => {
  assert.equal(tumblehome(0.5, 0.9, 1.4), 1);
  assert.ok(Math.abs(tumblehome(1.4, 0.9, 1.4, 0.82) - 0.82) < 1e-9);
  assert.ok(tumblehome(1.1, 0.9, 1.4) > tumblehome(1.3, 0.9, 1.4));
});

test('podrobná auta: díly pro poškození, pořadí světel a rozumný počet trojúhelníků', () => {
  for (const id of types) {
    const g = buildCarGeometry(id, true);
    const bodyCount = g.body.attributes.position.count, detailCount = g.detail.attributes.position.count;
    for (const name of ['hood', 'leftDoor', 'rightDoor']) {
      const part = g.panels[name];
      assert.equal(part.batch, 'body', `${id}: ${name}`);
      assert.ok(part.count >= 6 && part.start + part.count <= bodyCount, `${id}: ${name} v rozsahu`);
    }
    for (const name of ['frontBumper', 'rearBumper']) {
      assert.equal(g.panels[name].batch, 'detail', `${id}: ${name}`);
    }
    // světla: 72 vrcholů pro každou skupinu (přední, zadní, couvací) těsně před nárazníky
    const lens = g.detail.attributes.aLens.array, color = g.detail.attributes.color;
    for (let group = 1; group <= 3; group++) {
      const ids = [...lens.keys()].filter((i) => lens[i] === group);
      assert.equal(ids.length, 72, `${id}: skupina světel ${group}`);
      for (const i of ids) assert.ok(color.getX(i) > 0.9, `${id}: světlo ${group} má svítivou barvu`);
    }
    assert.ok(Math.max(...[...lens.keys()].filter((i) => lens[i])) < g.panels.frontBumper.start);
    // směrovky: dvě poloviny po 72 vrcholech
    assert.deepEqual(g.indicators.map((x) => x.drawRange.count), [72, 72]);
    const triangles = (bodyCount + detailCount + 4 * g.wheel.attributes.position.count) / 3;
    assert.ok(triangles < 2200, `${id}: ${triangles} trojúhelníků`);
    for (const geometry of [g.body, g.detail]) {
      const n = geometry.attributes.normal;
      for (let i = 0; i < n.count; i++) {
        const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
        assert.ok(Math.abs(length - 1) < 1e-3, `${id}: jednotková normála`);
      }
    }
  }
});

test('podrobné auto se promáčkne a dveře odpadnou stejně jako u jednoduchého', () => {
  const car = new Car('sedan', 0x508080);
  const body = car.mesh.userData.batches.body;
  assert.ok(body.geometry.attributes.position.count > 600, 'na střední předvolbě je podrobná karoserie');
  const original = body.geometry;
  dentCar(car, 15, new Vector3(-0.9, 0.6, 0), new Vector3(1, 0, 0));
  assert.ok(car.damage.leftDoor > 0);
  assert.notEqual(body.geometry, original);
  dentCar(car, 31, new Vector3(-0.9, 0.6, 0), new Vector3(1, 0, 0), () => {});
  assert.equal(car.damage.leftDoor, 1);
  const { leftDoor } = car.mesh.userData.panels;
  const pos = body.geometry.attributes.position.array;
  assert.ok(pos.slice(leftDoor.start * 3, (leftDoor.start + leftDoor.count) * 3).every((v) => v === 0));
  restorePanels(car, {});
  assert.equal(body.geometry, original);
});

test('vyhlazení normál zachová ostrou hranu a vyhladí mírný ohyb', async () => {
  const { BufferGeometry, Float32BufferAttribute } = await import('three/webgpu');
  // dva trojúhelníky se společnou hranou od (0,0,0) do (1,0,0), druhý sklopený o `angle`
  const make = (angle) => {
    const s = Math.sin(angle), c = Math.cos(angle);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0.5, s, -c], 3));
    g.setAttribute('normal', new Float32BufferAttribute(new Array(18).fill(0), 3));
    return smoothNormals(g, 30);
  };
  const normal = (g, i) => [g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const smooth = make(20 * Math.PI / 180), sharp = make(Math.PI / 2);
  assert.ok(dot(normal(smooth, 0), normal(smooth, 3)) > 0.9999, 'mírný ohyb sdílí normálu na společné hraně');
  assert.ok(dot(normal(sharp, 0), normal(sharp, 3)) < 0.5, 'ostrá hrana má dvě různé normály');
  assert.ok(Math.abs(normal(sharp, 0)[1] - 1) < 1e-6, 'plocha u ostré hrany drží svou normálu');
});

test('Fabia má na obou předvolbách boční dveře a stejnou výšku střechy', () => {
  const roof = [];
  for (const detail of [false, true]) {
    const g = buildCarGeometry('hatch', detail);
    g.body.computeBoundingBox();
    roof.push(g.body.boundingBox.max.y);
    assert.ok(roof.at(-1) > 1.48);
    assert.ok(g.panels.leftDoor && g.panels.rightDoor);
  }
  assert.ok(Math.abs(roof[0] - roof[1]) < 0.02);
});

test('kola v provozu odvalují vpřed i vzad a rejd má jen přední náprava', async () => {
  const { updateCarWheels } = await import('../src/entities/car-wheels.js');
  const car = new Car('sedan', 0x335566);
  const wheels = car.mesh.userData.wheels;
  const axes = () => Array.from({ length: 4 }, (_, i) => {
    const m = new Matrix4();
    wheels.getMatrixAt(i, m);
    return new Vector3(1, 0, 0).transformDirection(m).multiplyScalar(i % 2 ? -1 : 1);
  });
  car.mode = 'ai'; car.speed = 4; car.steer = 0.3;
  updateCarWheels(car, 0.05);
  const axle = axes();
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(axle[i].z - (i < 2 ? Math.sin(0.3) : 0)) < 1e-6);
  assert.ok(wheels.userData.roll > 0);
  car.speed = -4; updateCarWheels(car, 0.05);
  assert.ok(Math.abs(wheels.userData.roll) < 1e-7);
});

test('Fabia má svítící jádra ve tvarovaném čele a prolis předních dveří na obou stranách', () => {
  for (const detail of [true, false]) {
    const g = buildCarGeometry('hatch', detail);
    const { position, aLens } = g.detail.attributes;
    for (const side of [-1, 1]) {
      const depths = [], widths = [];
      for (let i = 0; i < position.count; i++) {
        if (aLens.getX(i) !== 1 || Math.sign(position.getX(i)) !== side) continue;
        depths.push(position.getZ(i));
        widths.push(Math.abs(position.getX(i)));
      }
      assert.equal(depths.length, 36);
      assert.ok(Math.max(...depths) - Math.min(...depths) > 0.055, 'paraboly sledují oblouk blatníku');
      assert.ok(Math.max(...widths) < 0.71, 'směrovka na vnějším konci zůstane oddělená od tlumeného světla');
      const door = g.panels[side > 0 ? 'rightDoor' : 'leftDoor'];
      const points = g.body.attributes.position;
      const doorWidths = [];
      for (let i = door.start; i < door.start + door.count; i++) {
        if (points.getY(i) < 0.80) doorWidths.push(Math.abs(points.getX(i)));
      }
      assert.ok(Math.max(...doorWidths) - Math.min(...doorWidths) > 0.02, 'plech mezi prahem a klikou má zaoblený profil');
    }
  }
});

test('vozový park má na nízké kvalitě stejné obrysy, oddělenou optiku a korbu s podlahou pod bočnicí', async () => {
  const { Mesh, Raycaster } = await import('three/webgpu');
  for (const id of types.filter(id => id !== 'hatch')) {
    const low = buildCarGeometry(id, false), high = buildCarGeometry(id, true);
    for (const mesh of [low.body, high.body]) mesh.computeBoundingBox();
    assert.ok(low.body.boundingBox.max.distanceTo(high.body.boundingBox.max) < 0.02, id);
    assert.ok(low.body.attributes.position.count < high.body.attributes.position.count, id);
    for (const { detail, indicators, hazards } of [low, high]) {
      assert.deepEqual(new Set(detail.attributes.aLens.array), new Set([0,1,2,3]), id);
      assert.equal(hazards.attributes.position.count, 144, id);
      for (const [i, group] of indicators.entries()) {
        const { start, count } = group.drawRange, pos = group.attributes.position;
        const side = i === 0 ? -1 : 1;
        const zs = [];
        for (let k=start; k<start+count; k++) {
          assert.ok(side*pos.getX(k)>0, id);
          zs.push(pos.getZ(k));
        }
        assert.ok(Math.min(...zs)<-1 && Math.max(...zs)>1, id);
      }
    }
    if (id === 'pickup') {
      const skins = [high.body,high.detail].map(geometry => new Mesh(geometry));
      const height = x => new Raycaster(new Vector3(x,3,-1.5), new Vector3(0,-1,0)).intersectObjects(skins)[0].point.y;
      assert.ok(height(0.94)-height(0)>0.2, 'nákladový prostor má prohlubeň přes dvacet centimetrů');
    }
  }
});

test('místo pro cestujícího vedle natočeného auta a na jiném patře', () => {
  const car = new Car('sedan', 0x508080);
  Object.assign(car, { x: 10, y: 4, z: 20, yaw: Math.PI / 2 });
  const point = { x: car.x + car.type.len / 2, y: car.y, z: car.z + car.type.wid / 2 };
  assert.equal(car.blocksPassenger(point, 0.35), true);
  assert.equal(car.blocksPassenger({ ...point, x: point.x + 0.26, z: point.z + 0.26 }, 0.35), false);
  assert.equal(car.blocksPassenger({ ...point, y: 0 }, 0.35), false);
  assert.equal(car.blocksPassenger({ ...point, y: 8 }, 0.35), false);
});
