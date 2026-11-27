import { devices, expect, test } from '@playwright/test';
import stands from '../../src/game/taxi-stops.json' with { type: 'json' };
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function openRegionalTaxi(page, area, quality) {
  await page.goto(gameUrl(`/?debug&quality=${quality}&view=350&adapt=0&hour=10`));
  await waitForGame(page);
  await page.evaluate(stand => {
    __freeze(true);
    const g = __game, w = g.world, car = g.player.lastCar;
    const side = Math.max(1.2, w.r.w[w.eRoad[stand.edge]] / 2 - 1);
    const start = w.edgePoint(stand.edge, stand.along - 8, side, {});
    car.place(start.x, start.z, Math.atan2(start.tx,start.tz));
    g._enterCar(car);
    g.jobs.checkTimer = Infinity;
  }, stands.find(s => s.area === area));
  await page.getByRole('button', { name: 'Zakázky', exact: true }).click();
  await page.locator('#regional-taxi summary').click();
  await expect(page.locator('#regional-taxi-summary')).toContainText(area);
}

test('E70 – souvislá jízda z Prokopovy na Masarykovo náměstí ve Starém Plzenci', async ({ page }, info) => {
  test.setTimeout(180000);
  await openRegionalTaxi(page, 'Plzeň', 'low');
  await expect(page.locator('#regional-taxi-summary')).toContainText('Prokopova 21 → Starý Plzenec · Masarykovo náměstí 74');
  await page.locator('#regional-taxi-start').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('nabidka.jpg') });
  await page.locator('#regional-taxi-start').click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, w = g.world, car = g.car, jobs = g.jobs, job = jobs.job;
    const initialMoney = g.money;
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    for (let i = 0; i < 50; i++) g.colliders.update(car.x,car.z);
    g.update(1/60);
    const vehicle = g.driver;
    const clamp = value => Math.max(-1, Math.min(1,value));
    const angleTo = yaw => Math.atan2(Math.sin(yaw-car.yaw),Math.cos(yaw-car.yaw));
    const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
    const points = [];
    let driven = 0;
    function addEdge(edge, from, to, fromCurb, toCurb) {
      const width = w.r.w[w.eRoad[edge]], curb = Math.max(1.2,width/2-1), lane = Math.min(1,width*.17);
      for (let s = from; s <= to; s++) {
        const gap = Math.min(fromCurb ? s-from : Infinity, toCurb ? to-s : Infinity);
        const side = lane + (curb-lane) * Math.max(0,1-gap/20);
        const pt = w.edgePoint(edge,s,side,{});
        if (!points.length || distance(points.at(-1),pt) > .55) points.push(pt);
      }
    }
    // Mezi nástupem a výstupem měníme jen plyn a řízení. Okolní provoz je při zkoušce vypnutý.
    async function drive(until) {
      let index = 0;
      for (let tick = 0; tick < 100000; tick++) {
        let nearest = index;
        for (let k = index+1; k < Math.min(index+13,points.length); k++) {
          if (distance(points[k],car) < distance(points[nearest],car)) nearest = k;
        }
        index = nearest;
        const look = 3.5 + Math.abs(car.speed)*.30;
        let aim = index, ahead = 0;
        while (aim+1 < points.length && ahead < look) {
          ahead += distance(points[aim],points[aim+1]);
          aim++;
        }
        const pt = points[aim], turn = angleTo(Math.atan2(pt.x-car.x,pt.z-car.z));
        const limit = Math.min(1,.13+32/(32+car.speed**2));
        const steer = clamp(-Math.atan2(2*vehicle.spec.wheelbase*Math.sin(turn),
          Math.max(1,Math.min(distance(pt,car),look))) / (.62*limit));
        const far = points[Math.min(index+11,points.length-1)];
        const bend = Math.abs(angleTo(Math.atan2(far.tx,far.tz)));
        const speed = Math.min(12/(1+3*bend), distance(points[index],car)>2.8 ? 3 : 15,
          Math.max(.65,(points.length-index-1)*.45));
        const x = car.x, z = car.z;
        g.colliders.update(x,z);
        vehicle.drive(1/60,clamp((speed-car.speed)*.7),steer,false,true,g.tireSurface);
        g.physics.engine.Step(1/60,1);
        vehicle.read();
        jobs.update(1/60);
        driven += Math.hypot(car.x-x,car.z-z);
        if (until()) return;
        if (tick % 3000 === 0) await new Promise(resolve => setTimeout(resolve,0));
      }
      throw new Error(`Taxi zůstalo na ${car.x}, ${car.z}, bod ${index}/${points.length}.`);
    }
    addEdge(job.pick.edge,job.pick.along-8,job.pick.along,true,true);
    points.push(job.pick);
    await drive(() => job.phase === 'drop');
    const routeEnd = jobs.route.slice(-2);
    points.length = 0;
    const path = w.findPath(w.eTo[job.pick.edge],w.eFrom[job.drop.edge],w.edgeCount, job.pick.edge,0,job.drop.edge);
    addEdge(job.pick.edge,job.pick.along,w.eLen[job.pick.edge],true,false);
    for (const edge of path) addEdge(edge,0,w.eLen[edge],false,false);
    addEdge(job.drop.edge,0,job.drop.along,false,true);
    points.push(job.drop);
    await drive(() => !jobs.job);
    await g.chunks.prepareStart(car,350);
    g.placeTimer = 0;
    for (let frame = 0; frame < 25; frame++) g.update(1/60);
    const person = jobs.arrivedPassenger.position;
    __view(car.x-8,car.y+4,car.z-5,person.x,person.y+.7,person.z);
    return { driven, len: job.len, reward: job.reward, change: g.money-initialMoney, routeEnd,
      end: [job.drop.x,job.drop.z], state: jobs.last.state, atCurb: distance(person,job.drop.waiting) < .1,
      clear: !w.onCarriageway(person.x,person.z,person.y,.25) && !w.blocked(person.x,person.z,.4) };
  });
  expect(result.driven).toBeGreaterThan(10000);
  expect(Math.abs(result.driven-result.len)).toBeLessThan(100);
  expect(result.routeEnd).toEqual(result.end);
  expect(result).toMatchObject({ state: 'paid', clear: true, atCurb: true, change: result.reward });
  await page.screenshot({ path: info.outputPath('vystup.jpg') });
});

test('E70 – dotykový výběr cíle z Rokycan, výstup na chodník a uložené jízdné', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  try {
    const page = await context.newPage();
    await openRegionalTaxi(page, 'Rokycany','medium');
    const select = page.getByLabel('Cíl jízdy');
    const name = area => select.locator('option').filter({ hasText: area }).first().getAttribute('value');
    await select.selectOption(await name('Dobřív'));
    await expect(page.locator('#regional-taxi-summary')).toContainText('→ Dobřív');
    await select.selectOption(await name('Starý Plzenec'));
    await page.locator('#regional-taxi-start').tap();
    const outcome = await page.evaluate(() => {
      __freeze(true);
      const { jobs, car, world } = __game, j = jobs.job;
      const at = stop => { car.place(stop.x,stop.z,Math.atan2(stop.tx,stop.tz)); jobs.update(.02); };
      at(j.pick);
      const routePoints = jobs.route?.length;
      at(j.drop);
      const p = jobs.arrivedPassenger.position;
      return { routePoints, onWalk: Number.isFinite(world.sidewalkY(p.x,p.z)), money: __game.money, reward: j.reward };
    });
    expect(outcome.routePoints).toBeGreaterThan(10);
    expect(outcome.onWalk).toBe(true);
    await page.reload(); await waitForGame(page);
    expect(await page.evaluate(() => [__game.money,__game.jobs.last.amount,__game.stats.taxiRides])).toEqual([outcome.money,outcome.reward,1]);
  } finally { await context.close(); }
});
