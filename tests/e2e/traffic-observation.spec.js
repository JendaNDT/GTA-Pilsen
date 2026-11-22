import { waitForGame } from './ready.js';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const site of ['Klatovská', 'hlavní nádraží']) {
  test('E20 – deset minut ranní špičky, ' + site, async ({ page }, info) => {
    test.setTimeout(Math.max(info.timeout, 240_000));
    await page.addInitScript(() => {
      let seed = 20261118;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    });
    await page.goto(gameUrl('/?debug&quality=high&adapt=0&date=2026-11-09&hour=7.5'));
    await waitForGame(page);
    const result = await page.evaluate(async (site) => {
      __play();
      __freeze(true);
      const g = __game, w = g.world;
      g.setClock('2026-11-09', 7.5);
      const [edge] = [...g.trafficRhythm.measured].find(([, entry]) =>
        entry.curve.id === 'klatovska-jih' && entry.distance === 0);
      const point = w.edgePoint(edge, 58, 0, {});
      if (site === 'Klatovská') g.player.place(point.x - point.tz * 10, point.z + point.tx * 10);
      else {
        const station = w.meta.landmarks.find(([, , name]) => name === 'Hlavní nádraží');
        const road = w.nearestRoad(station[0], station[1], 150, 8, 0, {});
        const offset = w.r.w[road.road] / 2 + 2;
        g.player.place(road.x - road.dz * offset, road.z + road.dx * offset);
      }
      for (let i = 0; i < 25; i++) g.colliders.update(g.player.x, g.player.z);

      const seen = new Map(), flow = [], departures = [];
      let longestStop = 0, stoppedAt = null, peak = 0, samples = 0;
      const queues = [];
      const movement = move => move && ({
        signal: move.control.id, lane: move.lane, exit: move.edge, exitLane: move.exitLane, left: move.left,
      });
      const describe = car => ({
        type: car.typeId, mode: car.mode, edge: car.edge, next: car.next, lane: car.lane,
        x: car.x, y: car.y, z: car.z, yaw: car.yaw, s: car.s, speed: car.speed,
        halfLen: car.halfLen, radius: car.radius, crashed: car.crashed,
        pathBlocked: car.pathBlocked, target: car.physical?.input?.targetSpeed,
        turn: car.upcomingLeft?.to, following: car.exitPlan?.map(move => move.to),
        junction: movement(car.junctionMovement), waitingFor: movement(car.trafficStop?.yieldingTo),
        signal: car.trafficStop?.rule.id, entering: car.trafficStop?.entering,
        planned: movement(car.trafficStop?.movement),
      });
      for (let minute = 0; minute < 10; minute++) {
        let distance = 0;
        for (let frame = 0; frame < 1800; frame++) {
          // Pozorovatel se rozhlíží na obě strany ulice. Každá otočka trvá minutu.
          g.camYaw += Math.PI * 2 / 1800;
          g.update(1 / 30);
          if (frame % 15) continue;
          peak = Math.max(peak, g.trafficBodies.dynamic.size);
          for (const [car, body] of g.trafficBodies.dynamic) {
            if (car.mode !== 'ai') continue;
            const time = minute * 60 + frame / 30;
            const previous = seen.get(car);
            const continuous = previous && time - previous.time === 0.5;
            const moved = continuous ? Math.hypot(car.x - previous.x, car.z - previous.z) : 0;
            const stopped = continuous && moved < 0.15 ? previous.stopped + 0.5 : 0;
            seen.set(car, { x: car.x, z: car.z, time, stopped });
            if (stopped > longestStop) {
              longestStop = stopped;
              stoppedAt = { time, edge: car.edge, next: car.next, x: car.x, z: car.z,
                street: w.roadNames[w.r.name[w.eRoad[car.edge]]],
                targetSpeed: body.input?.targetSpeed, rule: car.trafficStop?.rule.kind };
            }
            // Po dvou periodách už samotný bod na mapě neukáže příčinu fronty.
            if (stopped === 120 && queues.length < 12) {
              const rule = car.trafficStop?.rule;
              const near = o => o !== car && Math.hypot(o.x - car.x, o.z - car.z) < 45;
              queues.push({ time, car: describe(car), input: { ...body.input }, rule: rule?.id,
                light: rule?.group && w.traffic.light(rule),
                neighbours: g.vehicles.cars.filter(near).map(describe),
                obstacles: g.vehicles.obstacles.filter(near).map(describe),
                lamps: [...g.lampBodies.nearby.values()].filter(near).map(l => [l.id, l.x, l.z]),
                fixtures: [...g.trafficFurniture.nearby.values()].filter(near).map(f => [f.id, f.x, f.z]),
              });
            }
            distance += moved;
            samples++;
            if (departures.length < 10 && car.speed > 0.5 && body.input?.throttle > 0 &&
                !w.onCarriageway(car.x, car.z, car.y)) {
              departures.push({ time, x: car.x, z: car.z, speed: car.speed, edge: car.edge,
                street: w.roadNames[w.r.name[w.eRoad[car.edge]]] });
            }
          }
        }
        flow.push(Math.round(distance));
        await new Promise(requestAnimationFrame);
      }
      return { site, cars: seen.size, peak, samples, flow, longestStop, stoppedAt, departures, queues };
    }, site);
    await writeFile(info.outputPath('pozorovani.json'), JSON.stringify(result, null, 2));
    expect(result.cars).toBeGreaterThan(0);
    expect(Math.min(...result.flow), JSON.stringify(result)).toBeGreaterThan(0);
    expect(result.peak).toBeLessThanOrEqual(40);
    // Dvě celé periody místních semaforů poskytují prostor i k odbavení kolony.
    expect.soft(result.longestStop, JSON.stringify(result.stoppedAt)).toBeLessThan(120);
    expect.soft(result.departures).toEqual([]);
  });
}
