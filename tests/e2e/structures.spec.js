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
