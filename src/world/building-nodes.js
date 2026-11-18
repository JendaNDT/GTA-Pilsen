import {
  Fn, If, attribute, float, mix, positionWorld, select, smoothstep, step, struct, vec2, vec3, vec4,
  vertexColor,
} from 'three/tsl';
import { hash21, valueNoise } from './material-noise.js';
import { SURFACE } from './material-table.js';

function softRange(value, min, max, width) {
  return smoothstep(float(min).sub(width), float(min).add(width), value)
    .sub(smoothstep(float(max).sub(width), float(max).add(width), value));
}

const windowData = attribute('aWin', 'vec3');
const surfaceProperties = attribute('aSurface', 'vec2');
const wallColor = vertexColor().rgb;
const buildingSurface = struct({ color: 'vec3', illumination: 'float', glass: 'float' });

function facade(color, illumination, glazing, cell, code, style, width, night, heritage) {
  const uv = cell.fract().toVar(), id = cell.floor().toVar();
  const detail = smoothstep(0.25, 0.8, width.x.max(width.y)).oneMinus().toVar();
  const ground = step(id.y, 0.5).toVar();
  const h1 = hash21(id.add(7)).toVar();
  const h2 = hash21(id.mul(1.7).add(3.1)).toVar();
  const column = hash21(vec2(id.x, 5)).toVar();
  const plaster = valueNoise(cell.mul(vec2(2.3, 1.7))).mul(detail, 0.10).add(0.95);
  const wall = color.mul(plaster).toVar();
  const trim = mix(wall.mul(1.28), vec3(0.86, 0.85, 0.80), 0.45).toVar();
  const rect = vec4(0.30, 0.70, 0.30, 0.75).toVar(); // x0, x1, y0, y1
  const frameWidth = float(0.035).toVar();
  const vertical = float(0).toVar(), horizontal = float(0).toVar();
  const sill = float(1).toVar(), door = float(0).toVar();
  const shop = float(0).toVar(), loggia = float(0).toVar();

  If(style.lessThan(1.5), () => { // rodinný dům
    rect.assign(vec4(0.30, 0.70, 0.30, 0.74));
    vertical.assign(1);
    If(ground.greaterThan(0.5).and(column.greaterThan(0.72)), () => {
      rect.assign(vec4(0.36, 0.64, 0, 0.72));
      door.assign(1);
      sill.assign(0);
    });
  }).ElseIf(style.lessThan(2.5), () => { // panelový dům
    rect.assign(vec4(0.20, 0.80, 0.36, 0.78));
    vertical.assign(1);
    If(column.greaterThan(0.6).and(ground.lessThan(0.5)), () => {
      loggia.assign(1);
      rect.assign(vec4(0.22, 0.78, 0.44, 0.88));
      sill.assign(0);
    });
    const joint = smoothstep(0, width.x.add(0.014), uv.x)
      .min(smoothstep(0, width.y.add(0.018), uv.y)).oneMinus();
    wall.mulAssign(joint.mul(0.14, detail).oneMinus());
  }).ElseIf(style.lessThan(3.5), () => { // činžovní dům
    rect.assign(vec4(0.30, 0.70, 0.22, 0.80));
    vertical.assign(1);
    horizontal.assign(1);
    If(ground.greaterThan(0.5), () => {
      If(column.greaterThan(0.8), () => {
        rect.assign(vec4(0.32, 0.68, 0, 0.76));
        door.assign(1);
      }).Else(() => {
        rect.assign(vec4(0.07, 0.93, 0.10, 0.70));
        shop.assign(1);
        vertical.assign(0);
        horizontal.assign(0);
      });
      sill.assign(0);
    });
    // Římsa mezi patry a lizény mezi okny.
    wall.mulAssign(smoothstep(0.03, width.y.add(0.05), uv.y).oneMinus().mul(0.13, detail, ground.oneMinus()).add(1));
    wall.mulAssign(softRange(uv.x, 0.05, 0.95, width.x).oneMinus().mul(0.06, detail).add(1));
  }).ElseIf(style.lessThan(4.5), () => { // kanceláře
    rect.assign(vec4(0, 1, 0.30, 0.84));
    frameWidth.assign(0);
    sill.assign(0);
  }).ElseIf(style.lessThan(5.5), () => { // hala
    rect.assign(vec4(0.14, 0.86, 0.60, 0.86));
    sill.assign(0);
  }).ElseIf(style.greaterThan(6.5), () => { // radnice
    rect.assign(vec4(0.25, 0.75, 0.20, 0.78));
    vertical.assign(1);
    horizontal.assign(1);
    If(ground.greaterThan(0.5), () => {
      rect.assign(vec4(0.23, 0.77, 0.05, 0.68));
      sill.assign(0);
    });
    const band = softRange(uv.y, 0.09, 0.15, width.y).add(softRange(uv.y, 0.86, 0.91, width.y).mul(0.75));
    const pilaster = softRange(uv.x, 0.06, 0.13, width.x).add(softRange(uv.x, 0.87, 0.94, width.x));
    wall.mulAssign(band.mul(0.38).add(pilaster.mul(0.26)).mul(detail).add(1));
    trim.assign(mix(trim, wall.mul(1.25), 0.68));
  }).Else(() => { // kostel
    rect.assign(vec4(0.40, 0.60, 0.20, 0.80));
    sill.assign(0);
    wall.mulAssign(softRange(uv.x, 0.08, 0.92, width.x).oneMinus().mul(0.16, detail).oneMinus());
  });

  // Sokl, římsa pod střechou a holé zdivo pod terénem ve svahu.
  const lowStyle = step(style, 3.5);
  wall.mulAssign(smoothstep(0.14, width.y.add(0.17), cell.y).oneMinus().mul(0.26, lowStyle).oneMinus());
  const above = step(0, cell.y).toVar();
  const topDistance = code.div(8).floor().sub(cell.y).toVar();
  const cornice = smoothstep(0.07, width.y.add(0.09), topDistance).oneMinus().mul(lowStyle).toVar();
  const corniceShade = smoothstep(0.09, 0.15, topDistance).oneMinus().mul(cornice.oneMinus(), lowStyle);
  const arch = style.greaterThan(5.5).and(style.lessThan(6.5));
  const yTop = rect.w.sub(select(arch, uv.x.sub(0.5).abs().mul(0.9), 0)).toVar();
  const window = softRange(uv.x, rect.x, rect.y, width.x).mul(softRange(uv.y, rect.z, yTop, width.y))
    .clamp(0, 1).mul(above).toVar();
  const frame = softRange(uv.x, rect.x.sub(frameWidth), rect.y.add(frameWidth), width.x)
    .mul(softRange(uv.y, rect.z.sub(frameWidth), yTop.add(frameWidth), width.y))
    .sub(window).clamp(0, 1).mul(above, step(0.001, frameWidth));
  const sillMask = softRange(uv.x, rect.x.sub(0.06), rect.y.add(0.06), width.x)
    .mul(softRange(uv.y, rect.z.sub(0.075), rect.z.sub(0.035), width.y), sill, above);

  const glassHeight = uv.y.sub(rect.z).div(yTop.sub(rect.z).max(0.05)).clamp(0, 1).toVar();
  const glass = mix(vec3(0.06, 0.091, 0.125), vec3(0.24, 0.34, 0.45), h1.mul(0.6).add(glassHeight.mul(0.4))).toVar();
  glass.assign(mix(glass, vec3(0.62, 0.60, 0.55), step(0.72, h2).mul(0.4, shop.oneMinus())));
  If(style.greaterThan(3.5).and(style.lessThan(4.5)), () => {
    const bars = softRange(uv.x.mul(3).fract(), 0.035, 0.965, width.x.mul(3)).oneMinus();
    glass.assign(mix(glass, wall.mul(0.7), bars.mul(detail)));
  }).ElseIf(style.greaterThan(4.5).and(style.lessThan(5.5)), () => {
    const bars = softRange(uv.x.mul(5).fract(), 0.06, 0.94, width.x.mul(5)).oneMinus();
    glass.assign(mix(glass, wall.mul(0.6), bars.mul(detail)));
  });

  const lit = step(night.mul(0.5).oneMinus(), h2).mul(night).max(shop.mul(step(0.35, h1), night))
    .mul(mix(1, 0.2, step(4.5, style).mul(step(style, 5.5))), door.oneMinus()).toVar();
  const litColor = mix(vec3(1, 0.78, 0.44), vec3(0.70, 0.82, 1), step(0.86, h1))
    .mul(h1.mul(0.38).add(0.62), glassHeight.mul(0.2).add(0.8));
  glass.assign(mix(glass, litColor, lit));
  const crossX = smoothstep(0.008, width.x.add(0.012), uv.x.sub(rect.x.add(rect.y).mul(0.5)).abs()).oneMinus();
  const crossY = smoothstep(0.008, width.y.add(0.012), uv.y.sub(mix(rect.z, yTop, 0.68)).abs()).oneMinus();
  const bars = crossX.mul(vertical).max(crossY.mul(horizontal)).mul(detail).toVar();
  glass.assign(mix(glass, trim, bars));
  If(door.greaterThan(0.5), () => {
    glass.assign(mix(vec3(0.20, 0.13, 0.09), vec3(0.30, 0.20, 0.13), h1).mul(glassHeight.mul(0.30).add(0.85)));
  });

  const recess = softRange(uv.x, 0.07, 0.93, width.x).mul(softRange(uv.y, 0.05, 0.95, width.y), loggia, above);
  const rail = softRange(uv.y, 0.05, 0.40, width.y).mul(recess);
  const railColor = mix(wall.mul(0.80), vec3(0.45, 0.52, 0.58), hash21(vec2(id.x.mul(0.25).floor(), 2)).mul(0.35).add(0.25));
  const sign = softRange(uv.x, 0.05, 0.95, width.x).mul(softRange(uv.y, 0.75, 0.93, width.y), shop, step(0.3, h2), above);
  const hue = vec3(0, 0.33, 0.67).add(h1).mul(6.2831).cos().mul(0.19).add(0.25);
  const signColor = mix(wall.mul(0.70), hue, heritage ? 0.46 : 0.62);
  const windowArea = rect.y.sub(rect.x).mul(yTop.sub(rect.z)).toVar();
  let shade = mix(wall, wall.mul(0.52), recess.mul(detail));
  shade = mix(shade, railColor, rail.mul(detail));
  shade = mix(shade, trim, frame.mul(detail));
  shade = mix(shade, trim, sillMask.mul(detail));
  shade = mix(shade, signColor, sign.mul(detail));
  shade = mix(shade, glass, mix(windowArea.mul(above), window, detail));
  shade = mix(wall.mul(0.78), shade, above);
  color.assign(mix(shade, trim, cornice).mul(corniceShade.mul(0.22, detail).oneMinus()));
  illumination.assign(lit.mul(above, mix(windowArea, window.mul(bars.oneMinus()), detail), h1.mul(0.45).add(0.55)));
  glazing.assign(window.mul(bars.oneMinus(), door.oneMinus(), detail));
}

function addSurfaceDetail(color, facadePoint, cell, code) {
  const pixel = facadePoint.x.fwidth().max(facadePoint.y.fwidth(), facadePoint.z.fwidth());
  const near = smoothstep(0.10, 0.48, pixel).oneMinus().toVar();
  const brush = valueNoise(facadePoint.xz.add(facadePoint.yy.mul(0.49)).mul(vec2(1.12, 1.71)));
  const grain = valueNoise(facadePoint.xz.add(facadePoint.yy.mul(0.71)).mul(7.1)).sub(0.5);
  color.mulAssign(brush.mul(0.08).add(grain.mul(0.075, near), 0.97));
  If(code.equal(-1).or(code.equal(-2)), () => {
    // Tašky a šindel mají úzké překryvy, kdežto na zdivu jsou spáry širší.
    const blocks = cell.mul(select(code.equal(-1), vec2(3.1, 3.55), vec2(1.34, 2.35))).toVar();
    blocks.x.addAssign(blocks.y.floor().mod(2).mul(0.5));
    const uv = blocks.fract().toVar();
    const edge = uv.x.min(uv.x.oneMinus(), uv.y, uv.y.oneMinus());
    const seam = smoothstep(0.016, 0.057, edge).oneMinus();
    color.mulAssign(hash21(blocks.floor()).sub(0.5).mul(0.16).sub(seam.mul(0.20)).mul(near).add(1));
  });
  If(code.equal(-4), () => {
    const plank = cell.x.mul(6.2).toVar();
    const grain = hash21(vec2(plank.floor(), 4)).sub(0.5).mul(0.19);
    const seam = smoothstep(0.02, 0.10, plank.fract()).oneMinus();
    color.mulAssign(grain.sub(seam.mul(near, 0.14)).add(1));
  });
}

export function buildingNodes(night, textures, heritage) {
  const surface = Fn(() => {
    const cell = windowData.xy.toVar();
    const code = windowData.z.add(0.5).floor().toVar();
    const style = code.mod(8).toVar();
    const width = cell.fwidth().mul(0.75).add(0.0001).toVar();
    const color = wallColor.toVar();
    const illumination = float(0).toVar();
    const glazing = float(0).toVar();
    If(code.greaterThan(0).and(style.greaterThan(0.5)), () => {
      facade(color, illumination, glazing, cell, code, style, width, night, heritage);
    });
    if (textures) addSurfaceDetail(color, positionWorld, cell, code);
    return buildingSurface(color, illumination, glazing);
  })().toVar();

  const colorNode = vec4(surface.get('color'), 1);
  const emissiveNode = Fn(() => {
    const emission = vec3(1, 0.78, 0.42).mul(surface.get('illumination'), 0.90).toVar();
    if (heritage) {
      const code = windowData.z;
      If(code.lessThan(-4.5), () => {
        emission.addAssign(vec3(0.43, 0.23, 0.09).mul(night, 0.36));
      });
      If(code.lessThan(-1.5).and(code.greaterThan(-2.5), positionWorld.xz.length().lessThan(39)), () => {
        const litStone = smoothstep(3, 42, positionWorld.y).oneMinus();
        emission.addAssign(vec3(0.18, 0.115, 0.065).mul(litStone, night));
      });
    }
    return emission;
  })();
  let roughness = surfaceProperties.x;
  if (heritage) {
    const code = windowData.z.add(0.5).floor();
    roughness = select(code.equal(-1), SURFACE.tile.roughness,
      select(code.equal(-2), SURFACE.stone.roughness,
        select(code.equal(-4), SURFACE.timber.roughness,
          select(code.equal(-5), SURFACE.glass.roughness, SURFACE.plaster.roughness))));
  }
  const roughnessNode = mix(roughness, SURFACE.glass.roughness, surface.get('glass'));
  const metalnessNode = heritage ? null : surfaceProperties.y.mul(surface.get('glass').oneMinus());
  return { colorNode, emissiveNode, roughnessNode, metalnessNode };
}
