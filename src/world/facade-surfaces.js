import { SURFACE } from './material-table.js';

const defaultRoofs = new Map([
  [SURFACE.tile, 7],
  [SURFACE.sheet, 8],
  [SURFACE.copper, 9],
  [SURFACE.felt, 10]
]);
const mappedRoofs = new Map([
  [0x5f8f7b, 9],
  [0x4a4d52, 11],
  [0x9c4a36, 7],
  [0x8d949b, 8],
  [0x3f4246, 10]
]);
export function buildingLayers(style, district, wall, roof, roofColor, mapped) {
  const defaultWall =
    wall === SURFACE.stone
      ? 4
      : wall === SURFACE.brick
        ? 2
        : wall === SURFACE.panel || wall === SURFACE.concrete
          ? 3
          : wall === SURFACE.sheet
            ? 5
            : wall === SURFACE.timber
              ? 6
              : style === 1 || (district ?? 0) > 2
                ? 1
                : 0;
  const wallLayer = mapped?.[0] >= 0 ? mapped[0] : defaultWall;
  const roofLayer =
    mapped?.[1] >= 0 ? mapped[1] : (mappedRoofs.get(roofColor & 0xffffff) ?? defaultRoofs.get(roof) ?? 7);
  return { wallLayer, roofLayer };
}
