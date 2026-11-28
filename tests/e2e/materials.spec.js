import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

async function openMaterialGame(page, baseURL) {
  await openReferenceGame(page, gameUrl(baseURL, { weather: null, seed: null }));
  // Stejné světlo a procedurální obloha jako při pořízení předloh materiálů E15.
  await page.evaluate(() => window.__game.setWeatherMode('clear'));
}

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
  await openMaterialGame(page, baseURL);
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
  await openMaterialGame(page, baseURL);
  await renderReferenceView(page, reference.views.find((view) => view.id === 'namesti-noc'));
  await page.waitForFunction(()=>{
    const fronts=__game.scene.getObjectsByProperty('name','Domy na náměstí Republiky');
    return fronts.some(mesh=>mesh.geometry.userData.squareAddresses.includes(32) && mesh.material.map.image?.complete);
  });
  // Dvě sousední okna téhož patra západní řady, vlevo od hotelu Central.
  const [litRed, , litBlue] = await averageRegion(page, { x: 94, y: 351, width: 8, height: 8 });
  const [darkRed] = await averageRegion(page, { x: 116, y: 351, width: 8, height: 8 });
  expect(litRed - darkRed).toBeGreaterThan(100);
  expect(litRed - litBlue).toBeGreaterThan(12);
});

test('E15 – proudění náhonu mění odlesk a lampy osvětlují povrch', async ({ page, baseURL }) => {
  await openMaterialGame(page, baseURL);
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
    const game = window.__game;
    game.env.poolMat.visible = false;
    // Na vysoké předvolbě dopadá na stejnou dlažbu také světlo skutečných bodových lamp.
    for (const lamp of game.nightLights?.lamps ?? []) lamp.removeFromParent();
    game.postfx?.resetHistory();
  });
  const [unlit] = await averageRegion(page, underLamp);
  expect(lit - unlit, JSON.stringify({ lit, unlit })).toBeGreaterThan(30);
});

test('E15 – světlomety auta zůstávají v noci jasné', async ({ page, baseURL }) => {
  await openMaterialGame(page, baseURL);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const bulbs = await page.evaluate((date) => {
    window.__freeze(true);
    const game = window.__game, car = game.player.lastCar;
    window.__setClock(date, 22);
    game._enterCar(car);
    // První jízdní krok rozsvítí potkávací světla nastartovaného auta.
    window.__step(1 / 60);
    const { x, y, z, yaw } = car;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    window.__view(x + dx * 4, y + 1.15, z + dz * 4, x + dx * 1.5, y + 0.75, z + dz * 1.5);
    const mesh = car.mesh.userData.batches.detail;
    const { position, aLens } = mesh.geometry.attributes;
    const { width, height } = game.renderer.domElement;
    mesh.updateWorldMatrix(true, false);
    const project = (i) => {
      const p = mesh.localToWorld(mesh.position.clone().fromBufferAttribute(position, i)).project(game.camera);
      return [(1 + p.x) * width / 2, (1 - p.y) * height / 2];
    };
    return [-1, 1].map((side) => {
      // Vrchol čočky leží na jejím lemu. Měříme uvnitř největšího viditelného čela.
      let best = null, area = 0;
      for (let i = 0; i < aLens.count; i += 3) {
        if (aLens.getX(i) !== 1 || Math.sign(position.getX(i)) !== side) continue;
        const [a, b, c] = [project(i), project(i + 1), project(i + 2)];
        const facing = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
        if (facing <= area) continue;
        area = facing;
        best = { x: Math.floor((a[0] + b[0] + c[0]) / 3) - 1,
          y: Math.floor((a[1] + b[1] + c[1]) / 3) - 1, width: 3, height: 3 };
      }
      if (!best) throw new Error('Chybí viditelné čelo přední žárovky na straně ' + side);
      return best;
    });
  }, reference.date);
  const lit = [];
  for (const bulb of bulbs) {
    const [headlight] = await averageRegion(page, bulb);
    lit.push(headlight);
    expect(headlight, JSON.stringify(bulb)).toBeGreaterThan(190);
  }
  await page.evaluate(() => {
    const { car, postfx } = window.__game;
    car.mesh.userData.batches.detail.userData.carSignals.x = 0;
    postfx?.resetHistory();
  });
  for (let i = 0; i < bulbs.length; i++) {
    const [unlit] = await averageRegion(page, bulbs[i]);
    expect(lit[i] - unlit, JSON.stringify(bulbs[i])).toBeGreaterThan(160);
  }
});

test('E15 – voda pod Wilsonovým mostem zůstává modrá', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openMaterialGame(page, baseURL);
  await renderReferenceView(page, reference.views.find((view) => view.id === 'wilson'));
  const [riverRed, , riverBlue] = await averageRegion(page, { x: 460, y: 610, width: 32, height: 32 });
  const [bankRed, , bankBlue] = await averageRegion(page, { x: 160, y: 525, width: 32, height: 32 });
  // G13 rozlišuje světlejší mělčinu u břehu a tmavší střed toku.
  expect(bankBlue).toBeGreaterThan(125);
  expect(bankBlue - bankRed).toBeGreaterThan(25);
  expect(riverBlue - riverRed).toBeGreaterThan(25);
  expect(bankBlue - riverBlue).toBeGreaterThan(10);
});

test('E15 – portály a značení u Valíku jsou vidět', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  await openMaterialGame(page, baseURL);
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
  await openMaterialGame(page, baseURL);
  await renderReferenceView(page, reference.views.find((view) => view.id === 'namesti-den'));
  const [brickRed, brickGreen, brickBlue] = await averageRegion(page, { x: 600, y: 665, width: 32, height: 32 });
  expect(brickRed).toBeGreaterThan(170);
  expect(brickRed - brickBlue).toBeGreaterThan(18);
  expect(brickGreen - brickBlue).toBeGreaterThan(10);
});
