import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const [label, bridgeOnly] of [
  ['E18 – kola unesou auto přes Wilsonův most v obou směrech', true],
  ['E18 – kola unesou auto oběma tubusy Valíku', false]
]) {
  test(label, async ({ page }, info) => {
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
    await page.waitForFunction(() => window.__ready);
    const voyages = await page.evaluate(bridgeOnly => {
      const g = window.__game, w = g.world, car = g.player.lastCar;
      const id = [...w.archedBridges.keys()].find((r) => w.roadNames[w.r.name[r]] === 'Wilsonův most');
      const bridge = Array.from({ length: w.rOff[id + 1] - w.rOff[id] }, (_, i) => {
        const k = w.rOff[id] + i;
        return { x: w.rpx[k], z: w.rpz[k], y: w.rpy[k] };
      });
      g._enterCar(car);
      g.paused = false;
      g.vehicles.spawnTimer = g.peds.timer = 100000;
      const results = [];
      const routes = bridgeOnly ? [bridge, [...bridge].reverse()] : w.tunnels.map(t => t.points);
      for (const path of routes) {
        const [start, next] = path;
        car.place(start.x, start.z, Math.atan2(next.x - start.x, next.z - start.z), start.y);
        let index = 1, worstDrop = 0, maxCover = 0, wheelError = 0, wheelSamples = 0;
        let worstWheel = null;
        for (let i = 0; i < 7200 && index < path.length; i++) {
          const a = path[index - 1], b = path[index];
          const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
          const along = ((car.x - a.x) * dx + (car.z - a.z) * dz) / length;
          const ahead = Math.min(1, (along + 5) / length);
          const angle = Math.atan2(a.x + dx * ahead - car.x, a.z + dz * ahead - car.z) - car.yaw;
          const steer = Math.max(-1, Math.min(1, -Math.atan2(Math.sin(angle), Math.cos(angle)) * 2.5));
          window.__setInput(steer, Math.max(-1, Math.min(1, (9 - car.speed) * 0.6)));
          g.update(1 / 60);
          if (bridgeOnly && g.driver) {
            for (const wheel of g.driver.wheels) {
              if (!wheel.HasContact()) continue;
              const contact = wheel.GetContactPosition();
              // Wilsonův most je přímý úsek. Za čelem desky už kolo stojí na nábřežní silnici.
              const fraction = ((contact.GetX() - a.x) * dx + (contact.GetZ() - a.z) * dz) / (length * length);
              // Souřadnice kontaktu i vrcholů přicházejí z fyziky jako float32.
              const inside = fraction * length >= -0.001 && (fraction - 1) * length <= 0.001;
              const deck = inside ? a.y + (b.y - a.y) * Math.min(1, Math.max(0, fraction))
                : w.heightAt(contact.GetX(), contact.GetZ());
              const error = Math.abs(deck - contact.GetY());
              if (error > wheelError) {
                wheelError = error;
                worstWheel = { x: contact.GetX(), z: contact.GetZ(), y: contact.GetY(), deck };
              }
              wheelSamples++;
            }
          }
          const expected = a.y + (b.y - a.y) * Math.max(0, Math.min(1, along / length));
          worstDrop = Math.max(worstDrop, expected - car.y);
          maxCover = Math.max(maxCover, w.heightAt(car.x, car.z) - car.y);
          if (Math.hypot(car.x - b.x, car.z - b.z) < 3 || along >= length) index++;
        }
        results.push({ arrived: Math.hypot(car.x - path.at(-1).x, car.z - path.at(-1).z) < 4,
          health: car.health, worstDrop, maxCover, wheelSamples, wheelError, worstWheel });
      }
      return results;
    }, bridgeOnly);
    await info.attach('Průjezdy', { body: JSON.stringify(voyages), contentType: 'application/json' });
    expect(voyages).toHaveLength(2);
    for (const voyage of voyages) {
      expect(voyage.arrived, JSON.stringify(voyages)).toBe(true);
      expect(voyage.health).toBe(100);
      expect(voyage.worstDrop).toBeLessThan(0.5);
      if (bridgeOnly && process.env.PLZEN_TEST_PHYSICS !== 'old') {
        expect(voyage.wheelSamples).toBeGreaterThan(100);
        expect(voyage.wheelError, JSON.stringify(voyages)).toBeLessThan(0.05);
      }
      if (!bridgeOnly) expect(voyage.maxCover).toBeGreaterThan(20);
    }
  });
}

test('E18 – na zkušební rampě se všechna kola odlepí a po dopadu se pérování ustálí', async ({ page }) => {
  // Samostatná zkouška nového zavěšení. Původní řízení bere výšku přímo z terénu.
  const address = new URL(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  address.searchParams.delete('physics');
  await page.goto(address.href);
  await page.waitForFunction(() => window.__ready);
  const jump = await page.evaluate(() => {
    const g = window.__game, car = g.player.lastCar, { Jolt, bodies } = g.physics;
    const floor = 80;
    const box = (z, y, halfLength, slope = 0) => {
      const half = new Jolt.Vec3(6, 0.25, halfLength);
      const rotation = new Jolt.Quat(Math.sin(-slope / 2), 0, 0, Math.cos(slope / 2));
      const origin = new Jolt.RVec3(0, y, z);
      const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), origin, rotation, Jolt.EMotionType_Static, 0);
      bodies.CreateAndAddBody(settings, Jolt.EActivation_DontActivate);
      for (const temporary of [settings, origin, rotation, half]) Jolt.destroy(temporary);
    };
    box(0, floor - 0.25, 150);
    const slope = Math.atan(0.2);
    box(10, floor + 2 - 0.25 / Math.cos(slope), 10 / Math.cos(slope), slope);
    car.place(0, -30, 0);
    car.y = floor;
    g._enterCar(car);
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    g.paused = false;
    let airborne = 0, maxHeight = 0, settled = false;
    window.__setInput(0, 1);
    for (let i = 0; i < 900; i++) {
      g.update(1 / 60);
      if (car.z > 22 && car.air) { airborne++; maxHeight = Math.max(maxHeight, car.y - floor); }
      if (airborne && car.y < floor + 0.2 && g.driver.wheels.every((wheel) => wheel.HasContact()) && Math.abs(car.vy) < 0.2) {
        settled = true; break;
      }
    }
    return { airborne, maxHeight, settled, y: car.y - floor };
  });
  expect(jump.airborne).toBeGreaterThan(12);
  expect(jump.maxHeight).toBeGreaterThan(3);
  expect(jump.settled, JSON.stringify(jump)).toBe(true);
  expect(Math.abs(jump.y)).toBeLessThan(0.2);
});
