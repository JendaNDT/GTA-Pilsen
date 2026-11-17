import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

async function averageRegion(page, clip) {
  const image = await page.screenshot({ clip });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    const rgb = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      rgb[0] += data[i];
      rgb[1] += data[i + 1];
      rgb[2] += data[i + 2];
    }
    return rgb.map((sum) => sum / (data.length / 4));
  }, image.toString('base64'));
}

test('E15 – obloha má ve dne mraky a v noci ztmavne', async ({ page, baseURL }) => {
  await openReferenceGame(page, baseURL);
  await page.addStyleTag({ content: '#menu, #hud { visibility: hidden }' });
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

test('E15 – některá okna na náměstí v noci svítí a sousední zůstávají tmavá', async ({ page, baseURL }) => {
  await openReferenceGame(page, baseURL);
  await page.addStyleTag({ content: '#menu, #hud { visibility: hidden }' });
  await renderReferenceView(page, reference.views.find((view) => view.id === 'namesti-noc'));
  const [litRed, , litBlue] = await averageRegion(page, { x: 40, y: 331, width: 8, height: 8 });
  const [darkRed] = await averageRegion(page, { x: 52, y: 333, width: 8, height: 8 });
  expect(litRed - darkRed).toBeGreaterThan(100);
  expect(litRed - litBlue).toBeGreaterThan(12);
});

test('E15 – voda pod Wilsonovým mostem, dlažba, portály a značení u Valíku jsou vidět', async ({ page, baseURL }) => {
  await openReferenceGame(page, baseURL);
  await page.addStyleTag({ content: '#menu, #hud { visibility: hidden }' });
  const view = (id) => reference.views.find((entry) => entry.id === id);
  const region = (x, y, size = 32) => ({ x, y, width: size, height: size });
  await renderReferenceView(page, view('wilson'));
  const [riverRed, , riverBlue] = await averageRegion(page, region(460, 610));
  expect(riverBlue).toBeGreaterThan(125);
  expect(riverBlue - riverRed).toBeGreaterThan(25);

  await renderReferenceView(page, view('valik-zapad'));
  const [, left] = await averageRegion(page, region(534, 315, 16));
  const [, right] = await averageRegion(page, region(700, 315, 16));
  const [, exterior] = await averageRegion(page, region(609, 280, 16));
  expect(exterior - Math.max(left, right)).toBeGreaterThan(25);
  const [, marking] = await averageRegion(page, { x: 402, y: 597, width: 9, height: 6 });
  const [, asphalt] = await averageRegion(page, { x: 420, y: 597, width: 9, height: 6 });
  expect(marking - asphalt).toBeGreaterThan(60);

  await renderReferenceView(page, view('namesti-den'));
  const [brickRed, brickGreen, brickBlue] = await averageRegion(page, region(600, 665));
  expect(brickRed).toBeGreaterThan(170);
  expect(brickRed - brickBlue).toBeGreaterThan(18);
  expect(brickGreen - brickBlue).toBeGreaterThan(10);
});
