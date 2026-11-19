import { waitForGame } from './ready.js';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E24 – noční souprava a chůze s jedenácti klouby @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({ width: 400, height: 280 });
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&hour=13'));
  await waitForGame(page);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    __setClock('2026-11-17', 22);
    const actor = g.player.mesh;
    const vehicle = g.transit.vehicles.find(v => v.isTram);
    g.player.place(vehicle.x, vehicle.z);
    g.transit.update(0, g.player, [], true, g.clock);
    const mesh = vehicle.meshes[0];
    const shell = mesh.isMesh ? mesh : mesh.children.find(m => m.isMesh && m.geometry.attributes.aSurface);
    const { x, y, z } = shell.getWorldPosition(actor.position.clone());
    __view(x + 8, y + 2, z + 5, x, y + 1.6, z);
    g.render();
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    return [actor.isSkinnedMesh, actor.skeleton.bones.length, Boolean(shell.material.emissiveNode), g.env.night];
  });
  expect(result.slice(0, 3)).toEqual([true, 11, true]);
  expect(result[3]).toBeGreaterThan(0.8);
  expect(errors).toEqual([]);
});
