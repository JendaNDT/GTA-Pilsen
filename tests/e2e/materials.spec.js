import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

async function averageRegion(page, clip) {
  return page.evaluate(async ({ x, y, width, height }) => {
    const game = window.__game;
    const { renderer } = game;
    let data;
    if (renderer.backend.isWebGPUBackend) {
      // Čtení výstupní textury počká na dokončení obrazu i na WebGPU.
      const Target = game.postfx.scenePass.renderTarget.constructor;
      const target = new Target(renderer.domElement.width, renderer.domElement.height);
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        game.render();
        data = await renderer.readRenderTargetPixelsAsync(target, x, y, width, height);
      } finally {
        renderer.setRenderTarget(previous);
        target.dispose();
      }
    } else {
      const ctx = new OffscreenCanvas(width, height).getContext('2d');
      game.render();
      ctx.drawImage(renderer.domElement, x, y, width, height, 0, 0, width, height);
      data = ctx.getImageData(0, 0, width, height).data;
    }
    const rgb = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      rgb[0] += data[i];
      rgb[1] += data[i + 1];
      rgb[2] += data[i + 2];
    }
    return rgb.map((sum) => sum / (data.length / 4));
  }, clip);
}

test('E15 – obloha má ve dne mraky a v noci ztmavne', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  const [day, night] = reference.views;
  const sky = { x: 48, y: 24, width: 32, height: 32 };
  const cloud = { ...sky, x: 624 };
  await renderReferenceView(page, day);
  const [red, , blue] = await averageRegion(page, sky);
  const [cloudRed] = await averageRegion(page, cloud);
  expect(blue - red).toBeGreaterThan(40);
  expect(cloudRed - red).toBeGreaterThan(35);
  await renderReferenceView(page, night);
  const [, , nightBlue] = await averageRegion(page, sky);
  expect(nightBlue).toBeLessThan(45);
  expect(blue - nightBlue).toBeGreaterThan(145);
});

test('E15 – některá okna na náměstí v noci svítí a sousední zůstávají tmavá', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  await renderReferenceView(page, reference.views.find((view) => view.id === 'namesti-noc'));
  const [litRed, , litBlue] = await averageRegion(page, { x: 40, y: 331, width: 8, height: 8 });
  const [darkRed] = await averageRegion(page, { x: 52, y: 333, width: 8, height: 8 });
  expect(litRed - darkRed).toBeGreaterThan(100);
  expect(litRed - litBlue).toBeGreaterThan(12);
});

test('E15 – proudění náhonu mění odlesk a lampy osvětlují povrch', async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  const forge = reference.views.find((view) => view.id === 'dobriv-hamr');
  const canal = { x: 805, y: 430, width: 8, height: 8 };
  await renderReferenceView(page, forge);
  const [before, , blue] = await averageRegion(page, canal);
  expect(blue - before).toBeGreaterThan(20);
  await page.evaluate(({ camera, target }) => {
    const game = window.__game;
    game.paused = false;
    game.time = 7;
    window.__step(0);
    game.paused = true;
    window.__view(...camera, ...target);
  }, forge);
  const [after] = await averageRegion(page, canal);
  expect(Math.abs(after - before)).toBeGreaterThan(3);

  const square = reference.views.find((view) => view.id === 'namesti-noc');
  const underLamp = { x: 984, y: 504, width: 12, height: 12 };
  await renderReferenceView(page, square);
  const [lit] = await averageRegion(page, underLamp);
  await page.evaluate(() => {
    window.__game.env.poolMat.visible = false;
    window.__game.render();
  });
  const [unlit] = await averageRegion(page, underLamp);
  expect(lit - unlit).toBeGreaterThan(30);
});

test('E15 – světlomety auta zůstávají v noci jasné', async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  await page.evaluate((date) => {
    const { x, y, z, yaw } = window.__game.player.lastCar;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    window.__setClock(date, 22);
    window.__view(x + dx * 4, y + 1.15, z + dz * 4, x + dx * 1.5, y + 0.75, z + dz * 1.5);
  }, reference.date);
  const [headlight] = await averageRegion(page, { x: 470, y: 380, width: 16, height: 16 });
  const [bumper] = await averageRegion(page, { x: 632, y: 426, width: 16, height: 16 });
  expect(headlight).toBeGreaterThan(190);
  expect(headlight - bumper).toBeGreaterThan(160);
});

test('E15 – voda pod Wilsonovým mostem zůstává modrá', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  await renderReferenceView(page, reference.views.find((view) => view.id === 'wilson'));
  const [riverRed, , riverBlue] = await averageRegion(page, { x: 460, y: 610, width: 32, height: 32 });
  expect(riverBlue).toBeGreaterThan(125);
  expect(riverBlue - riverRed).toBeGreaterThan(25);
});

test('E15 – portály a značení u Valíku jsou vidět', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  await renderReferenceView(page, reference.views.find((view) => view.id === 'valik-zapad'));
  const region = (x, y) => ({ x, y, width: 16, height: 16 });
  const [, left] = await averageRegion(page, region(534, 315));
  const [, right] = await averageRegion(page, region(700, 315));
  const [, exterior] = await averageRegion(page, region(609, 280));
  expect(exterior - Math.max(left, right)).toBeGreaterThan(25);
  const [, marking] = await averageRegion(page, { x: 402, y: 597, width: 9, height: 6 });
  const [, asphalt] = await averageRegion(page, { x: 420, y: 597, width: 9, height: 6 });
  expect(marking - asphalt).toBeGreaterThan(60);
});

test('E15 – dlažba náměstí Republiky je vidět', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openReferenceGame(page, gameUrl(baseURL));
  await renderReferenceView(page, reference.views.find((view) => view.id === 'namesti-den'));
  const [brickRed, brickGreen, brickBlue] = await averageRegion(page, { x: 600, y: 665, width: 32, height: 32 });
  expect(brickRed).toBeGreaterThan(170);
  expect(brickRed - brickBlue).toBeGreaterThan(18);
  expect(brickGreen - brickBlue).toBeGreaterThan(10);
});
