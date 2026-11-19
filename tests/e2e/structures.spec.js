import {expect, test} from '@playwright/test';
import {gameUrl} from './game-url.js';

test('E22 – měřený pilíř má stálou oporu a při přiblížení načte městský model @webgpu', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', {name: 'Hrát', exact: true}).click();
  const location = await page.evaluate(() => {
    __freeze(true);
    const {world, chunks, colliders} = __game;
    const [ci, tile] = [...world.structures.tiles].find(([, tile]) =>
      tile.objects.some(o => o.id === '00000002021000213-265e2383af644593'));
    const part = tile.objects.find(o => o.id === '00000002021000213-265e2383af644593');
    const vertices = world.structures.positions.subarray(3 * part.start, 3 * (part.start + part.count));
    let top = -Infinity, x = 0, z = 0;
    // Těžiště vodorovné horní stěny je uvnitř plochy i u úzkého pilíře.
    for (let i = 0; i < vertices.length; i += 9) {
      const [ax,ay,az,bx,by,bz,cx,cy,cz] = vertices.subarray(i, i + 9);
      const y = (ay + by + cy) / 3;
      if (y <= top || Math.max(ay,by,cy) - Math.min(ay,by,cy) > 0.25 ||
          (bz-az)*(cx-ax) - (bx-ax)*(cz-az) < 0.03) continue;
      x = (ax+bx+cx)/3;
      z = (az+bz+cz)/3;
      top = y;
    }
    if (!Number.isFinite(top)) throw Error('Chybí horní plocha pilíře.');
    for (let i = 0; i < 12; i++) chunks.update(x,z,440,100);
    for (let i = 0; i < 25; i++) colliders.update(x,z);
    // Paprsek začne 15 cm nad pilířem, pod samostatnou jízdní mostovkou.
    const height = colliders.exitHeight(x,z,top - 0.55);
    return {ci, delta: Math.abs(height - top)};
  });
  expect(location.delta).toBeLessThan(0.08);
  await page.waitForFunction(ci => {
    const item = __game.chunks.chunks.get(ci)?.structure;
    return item && item.mesh.geometry !== item.core && item.mesh.geometry.attributes.position.count > 0;
  }, location.ci);
});

for (const mode of ['vypnuto', 'chybějící základ', 'starý otisk']) {
  test('E22 – hra nastartuje bez měřených objektů: ' + mode, async ({page}) => {
    let count = 0;
    await page.route('**/detail/structures/**', async route => {
      count++;
      if (mode === 'chybějící základ' && route.request().url().endsWith('/core.bin'))
        return route.fulfill({status:404, body:''});
      if (mode === 'starý otisk' && route.request().url().endsWith('/index.json')) {
        const result = await route.fetch(), index = await result.json();
        index.sources.roads = '00000000';
        return route.fulfill({response:result, json:index});
      }
      return route.continue();
    });
    await page.goto(gameUrl('/?debug&quality=low' + (mode === 'vypnuto' ? '&structures=0' : '')));
    await page.waitForFunction(() => window.__ready);
    expect(await page.evaluate(() => __game.world.structures)).toBeNull();
    expect(count).toBe(mode === 'vypnuto' ? 0 : 2);
  });
}

test('E22 – kamera zaparkovaného vozu se u nízkého pohledu zastaví před kamenným okrajem', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, car = g.player.lastCar;
    const model = w.deckCalibrations.get(19), k = w.rOff[19];
    const dx = w.rpx[k+1]-w.rpx[k], dz = w.rpz[k+1]-w.rpz[k], length = Math.hypot(dx,dz);
    const nx = -dz/length, nz = dx/length, t = 0.35, u = t*length;
    const strip = model.strips.find(([a,lo,,b]) => a <= u && u < b && lo > 0);
    const inner = strip[1] + (strip[4]-strip[1])*(u-strip[0])/(strip[3]-strip[0]);
    const side = inner-1, x = w.rpx[k]+t*dx+side*nx, z = w.rpz[k]+t*dz+side*nz;
    const y = w.rpy[k]+t*(w.rpy[k+1]-w.rpy[k]);
    car.place(x,z,Math.atan2(dx,dz),y);
    g._enterCar(car);
    g.camYaw = Math.atan2(-nx,-nz);
    g.camPitch = 0.04;
    g.camDist = 7;
    g._updateCamera(1/60);
    const near = (g.camera.position.x-x)*nx+(g.camera.position.z-z)*nz;
    g.camPitch = 0.8;
    g.camDist = 7;
    g._updateCamera(1/60);
    const high = (g.camera.position.x-x)*nx+(g.camera.position.z-z)*nz;
    return {near,high};
  });
  expect(result.near).toBeGreaterThan(0.3);
  expect(result.near).toBeLessThan(1);
  expect(result.high).toBeGreaterThan(2);
});
