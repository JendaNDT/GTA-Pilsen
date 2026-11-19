import { DataTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three/webgpu';
import {
  Fn,
  mix,
  normalWorldGeometry,
  positionWorld,
  select,
  smoothstep,
  step,
  texture,
  vec2,
  vec3
} from 'three/tsl';

let atlas;
export function roomAtlas() {
  if (atlas) return atlas;
  atlas = new DataTexture(new Uint8Array([122, 132, 130, 255]), 1, 1);
  atlas.colorSpace = SRGBColorSpace;
  atlas.magFilter = LinearFilter;
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  fetch((import.meta.env?.BASE_URL ?? '/') + 'textures/facades/interiery.webp')
    .then((r) => {
      if (!r.ok) throw Error('Chybí atlas interiérů.');
      return r.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then((bitmap) => {
      try {
        if (bitmap.width !== 1536 || bitmap.height !== 960) throw Error('Nesprávný rozměr atlasu interiérů.');
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.translate(0, bitmap.height);
        ctx.scale(1, -1);
        ctx.drawImage(bitmap, 0, 0);
        atlas.dispose();
        atlas.image = {
          width: bitmap.width,
          height: bitmap.height,
          data: new Uint8Array(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer)
        };
        atlas.needsUpdate = true;
      } finally {
        bitmap.close();
      }
    })
    .catch(() => {});
  return atlas;
}

export function roomView(map, opening, style, shop, h1, h2, night, lit, camera, sky) {
  return Fn(() => {
    const n = normalWorldGeometry.toVar(),
      eye = camera.sub(positionWorld).normalize().toVar();
    const tangent = vec3(n.z.negate(), 0, n.x).normalize();
    const cosine = eye.dot(n).abs().clamp(0.035, 1);
    const delta = vec2(eye.dot(tangent), eye.y).negate().div(cosine).mul(vec2(0.82, 0.75)).toVar();
    const hit = vec2(select(delta.x.greaterThan(0), opening.x.oneMinus(), opening.x),
      select(delta.y.greaterThan(0), opening.y.oneMinus(), opening.y)).div(delta.abs().max(0.001)).toVar();
    const depth = hit.x.min(hit.y, 1).toVar();
    const xy = opening.add(delta.mul(depth)).clamp(0, 1).toVar();
    const side = hit.x.lessThan(hit.y),
      back = depth.greaterThanEqual(0.999);
    const face = select(
      back,
      0,
      select(side, select(delta.x.lessThan(0), 1, 2), select(delta.y.lessThan(0), 3, 4))
    );
    const sideUv = vec2(select(delta.x.lessThan(0), depth, depth.oneMinus()), xy.y);
    const panel = select(back, xy, select(side, sideUv, vec2(xy.x, depth)))
      .mul(190 / 192)
      .add(1 / 192);
    const office = style.equal(4).or(style.equal(5));
    const variant = select(
      shop.greaterThan(0.5),
      select(h1.greaterThan(0.48), 5, 7),
      select(office, h1.mul(2).floor().min(1).add(3), select(h2.greaterThan(0.86), 6, h1.mul(3).floor().min(2)))
    );
    const room = texture(map, vec2(variant, face).add(panel).div(vec2(8, 5))).rgb.toVar();
    const curtain = smoothstep(0.04, 0.22, opening.x.min(opening.x.oneMinus())).oneMinus().mul(step(0.6, h1));
    const slat = step(0.86, opening.y.mul(14).fract()).mul(
      step(0.59, h2),
      step(opening.y, h1.mul(0.54).add(0.25))
    );
    room.assign(mix(room, vec3(0.48, 0.38, 0.3), curtain.mul(0.83)));
    room.assign(mix(room, vec3(0.53, 0.54, 0.48), slat.mul(0.82)));
    const illuminated = room.mul(mix(0.34, 0.13, night).add(lit.mul(0.92)));
    const fresnel = cosine.oneMinus().pow(5).mul(0.73).add(0.12);
    return mix(illuminated, sky, fresnel);
  })();
}
