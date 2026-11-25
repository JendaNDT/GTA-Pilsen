import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
test('E23 – centrum ve 22 hodin osvítí 128 lamp a po zhasnutí jedna zmizí @webgpu', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 320 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (/shader.*error|error.*shader|validation error|invalid shader module/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto(gameUrl('/?debug&quality=high&adapt=0&view=460&hour=12'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    __setClock('2026-11-09', 22);
    for (let i = 0; i < 15; i++) g.chunks.update(0, 0, 460, 20);
    const h = g.world.heightAt(0, 0);
    __view(5, h + 6, 15, 0, h + 2, -35);
    const rig = g.nightLights,
      lamp = rig.selected[0];
    const index = rig.selected.indexOf(lamp);
    const before = rig.lamps.filter((l) => l.visible).length;
    const aligned = rig.selected.every((item, i) =>
      rig.lamps[i].position.x === item.lightX && rig.lamps[i].position.z === item.lightZ);
    const visual = [...g.chunks.chunks.values()]
      .flatMap((ch) => ch.lamps?.visuals ?? [])
      .find((v) => v.id === lamp.id);
    visual.show(false);
    rig.last = performance.now();
    g.render();
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    const off = !rig.lamps[index].visible || rig.selected[index] !== lamp;
    visual.show(true);
    const clustered = g.renderer.lighting === rig.clustered;
    __setClock('2026-11-09', 12);
    g.render();
    return { before, aligned, off, clustered, day: !rig.group.visible, headlights: rig.cars.length };
  });
  expect(result).toEqual({ before: 128, aligned: true, off: true, clustered: true, day: true, headlights: 8 });
  expect(errors).toEqual([]);
});
