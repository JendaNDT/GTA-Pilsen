import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

test('E17 – expozice reaguje na jas uvnitř a venku u Valíku', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Referenční pohledy mají pevné datum a počasí podle něj, stejně jako snímky z tools/reference_views.mjs.
  await openReferenceGame(page, gameUrl(baseURL, { weather: null, seed: null }));
  await renderReferenceView(page, reference.views.find(({ id }) => id === 'valik-zapad'));
  const observed = await page.evaluate(async () => {
    const game = window.__game, eye = game.postfx.exposure;
    const backend = game.renderer.backend;
    const queue = backend.isWebGPUBackend ? backend.device.queue : null;
    const afterFrame = () => new Promise(requestAnimationFrame);
    const read = async () => {
      // Odečet měří nový snímek až po dokončení předchozího pohledu a jeho stínů.
      await queue?.onSubmittedWorkDone();
      while (eye.pending) await afterFrame();
      eye.update(0.20);
      game.render();
      if (!eye.pending) throw new Error('Odečet nového pohledu se nespustil.');
      while (eye.pending) await afterFrame();
      if (eye.disposed || eye.brightness === null) throw new Error('Chybí odečet průměrného jasu.');
      return eye.brightness;
    };
    const outside = await read();
    const wide = game.camera.position.clone(), forward = game.camera.getWorldDirection(wide.clone());
    const tube = game.world.tunnels[0];
    const middle = Math.floor(tube.points.length / 2);
    const a = tube.points[middle], b = tube.points[middle + 1];
    game.tunnelLight.visible = true;
    game.tunnelLight.position.set(a.x, a.y + 4.2, a.z);
    window.__view(a.x, a.y + 1.65, a.z, b.x, b.y + 1.55, b.z);
    const inside = await read();
    const before = eye.value;
    eye.update(0.35);
    const inProgress = eye.value;
    const target = eye.desired;
    eye.update(2.5);
    const adjusted = eye.value;
    game.tunnelLight.visible = false;
    const aim = wide.clone().add(forward);
    window.__view(...wide.toArray(), ...aim.toArray());
    await read();
    eye.update(0.35);
    return { outside, inside, before, inProgress, target, adjusted, exit: eye.value };
  });
  expect(observed.outside).toBeGreaterThan(observed.inside);
  expect(observed.inProgress).toBeGreaterThan(observed.before);
  expect(observed.inProgress).toBeLessThan(observed.adjusted);
  expect(observed.adjusted).toBeLessThan(observed.target);
  expect(observed.exit).toBeLessThan(observed.adjusted);
  expect(errors).toEqual([]);
});
