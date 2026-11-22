import {writeFile} from 'node:fs/promises';

export async function saveStructurePhoto(page, file) {
  const data = await page.evaluate(async () => {
    // Výstupní texturu lze přečíst i v menu, kdy výměnný řetězec čeká na další snímek.
    const g = window.__game, renderer = g.renderer;
    const {width,height} = renderer.domElement;
    const Target = g.postfx.scenePass.renderTarget.constructor;
    const target = new Target(width,height);
    const previous = renderer.getRenderTarget();
    let pixels;
    try {
      renderer.setRenderTarget(target);
      g.render();
      pixels = await renderer.readRenderTargetPixelsAsync(target,0,0,width,height);
    } finally {
      renderer.setRenderTarget(previous);
      target.dispose();
    }
    const copy = document.createElement('canvas');
    copy.width = width; copy.height = height;
    const ctx = copy.getContext('2d'), frame = ctx.createImageData(width,height);
    const data = frame.data;
    for (let y = 0; y < height; y++) {
      const row = renderer.backend.isWebGPUBackend ? y : height-y-1;
      data.set(pixels.subarray(row*width*4,(row+1)*width*4),y*width*4);
    }
    ctx.putImageData(frame,0,0);
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4*113) {
      if (data[i+3] > 200) colors.add((data[i]<<16) | (data[i+1]<<8) | data[i+2]);
    }
    if (colors.size < 32) throw Error('Na snímku chybí vykreslená scéna (' + colors.size + ' barev).');
    return copy.toDataURL('image/jpeg',0.85).split(',')[1];
  });
  const jpeg = Buffer.from(data,'base64');
  await writeFile(file,jpeg);
  return jpeg.length;
}
