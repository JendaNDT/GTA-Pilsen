import { Color, DataTexture, LinearFilter } from 'three/webgpu';
import { LensflareElement, LensflareMesh } from 'three/addons/objects/LensflareMesh.js';

function disc(size, ring) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(2 * (x + .5) / size - 1, 2 * (y + .5) / size - 1);
    const glow = ring ? Math.exp(-100 * (radius - .69) ** 2) * .24 : Math.max(0, 1 - radius) ** 3;
    data.set([255,255,255, Math.round(255 * glow)], (y * size + x) * 4);
  }
  const tex = new DataTexture(data,size,size);
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function makeSunFlare() {
  const flare = new LensflareMesh();
  flare.addElement(new LensflareElement(disc(64,false), 112, 0, new Color(0xffe4ae)));
  flare.addElement(new LensflareElement(disc(48,true), 48, .51, new Color(0x8baaa8)));
  flare.addElement(new LensflareElement(disc(32,false), 28, .77, new Color(0xd39169)));
  return flare;
}
