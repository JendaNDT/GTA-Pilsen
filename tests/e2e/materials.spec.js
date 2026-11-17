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
