import {
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace
} from 'three/webgpu';
import { drawStreetFixture } from './street-furniture.js';
import { SolidBuf } from './solid-buffer.js';
import { attachRoadFurniture } from './road-furniture.js';

const WIDTH = 256,
  HEIGHT = 224,
  CELL_HEIGHT = 384;
const modeNames = { tram: 'TRAM', trolleybus: 'TROLEJBUS', bus: 'BUS' };

function paintBoard(ctx, board) {
  ctx.fillStyle = '#18364c';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#4bb8b5';
  ctx.fillRect(5, 5, 246, 6);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(board.modes.map((m) => modeNames[m] ?? m).join(' · '), 13, 35, 166);
  ctx.fillStyle = '#f5cc62';
  ctx.fillRect(186, 14, 57, 42);
  ctx.fillStyle = '#142d43';
  ctx.textAlign = 'center';
  ctx.font = 'bold 31px sans-serif';
  ctx.fillText(board.number, 214, 36, 51);
  ctx.fillStyle = '#fff9e9';
  ctx.fillRect(6, 65, 244, 150);
  ctx.fillStyle = '#152e41';
  ctx.font = 'bold 29px sans-serif';
  const words = board.name.split(' '),
    first = [];
  while (words.length && (!first.length || ctx.measureText([...first, words[0]].join(' ')).width <= 224))
    first.push(words.shift());
  ctx.fillText(first.join(' '), 128, words.length ? 89 : 103, 226);
  if (words.length) ctx.fillText(words.join(' '), 128, 119, 226);
  ctx.fillStyle = '#96a6a9';
  ctx.fillRect(16, 143, 224, 2);
  ctx.fillStyle = '#16364d';
  ctx.font = 'bold 25px sans-serif';
  const middle = Math.ceil(board.lines.length / 2),
    split = board.lines.length > 6;
  ctx.fillText((split ? board.lines.slice(0, middle) : board.lines).join(' · '), 128, split ? 165 : 178, 226);
  if (split) ctx.fillText(board.lines.slice(middle).join(' · '), 128, 194, 226);
  ctx.fillStyle = '#c0c6c3';
  ctx.fillRect(0, HEIGHT, WIDTH, CELL_HEIGHT - HEIGHT);
  ctx.fillStyle = '#fffdf2';
  ctx.fillRect(7, HEIGHT + 5, 242, 150);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#18364c';
  ctx.font = 'bold 23px sans-serif';
  ctx.fillText(board.directions.length ? 'Směry linek' : 'Výstupní zastávka', 16, HEIGHT + 22, 222);
  ctx.font = '18px sans-serif';
  board.directions.slice(0, 5).forEach((direction, i) => {
    ctx.fillText(direction, 16, HEIGHT + 49 + i * 21, 222);
  });
}

// Všechny oboustranné tabule dlaždice sdílejí jednu texturu a jedno kreslení.
export function buildStopBoards(world, owner, fixtures, glassMaterial) {
  if (!fixtures.length) return;
  const signs = fixtures.filter((f) => f.board);
  const columns = Math.max(1, Math.ceil(Math.sqrt(signs.length))),
    rows = Math.max(1, Math.ceil(signs.length / columns));
  const canvas = document.createElement('canvas');
  canvas.width = columns * WIDTH;
  canvas.height = rows * CELL_HEIGHT + 16;
  const ctx = canvas.getContext('2d'),
    solid = new SolidBuf(),
    uv = [],
    ranges = [];
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, rows * CELL_HEIGHT, canvas.width, 16);
  const white = [0.5, 8 / canvas.height];
  signs.forEach((f, i) => {
    const col = i % columns,
      row = Math.floor(i / columns),
      start = solid.p.length;
    ctx.save();
    ctx.translate(col * WIDTH, row * CELL_HEIGHT);
    paintBoard(ctx, f.board);
    ctx.restore();
    const dx = Math.cos(f.yaw),
      dz = Math.sin(f.yaw);
    const point = (u, h, v) => [f.x + u * dx - v * dz, f.y + h, f.z + u * dz + v * dx];
    const face = (a, b, c, d, color, printed = false) => {
      solid.quad(a, b, c, d, color);
      for (const [u, v] of [
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 1],
        [1, 0],
        [0, 0]
      ]) {
        if (printed)
          uv.push(
            (col * WIDTH + 1 + u * (WIDTH - 2)) / canvas.width,
            1 -
              (row * CELL_HEIGHT +
                (printed === 'směry' ? HEIGHT : 0) +
                1 +
                v * ((printed === 'směry' ? CELL_HEIGHT - HEIGHT : HEIGHT) - 2)) /
                canvas.height
          );
        else uv.push(...white);
      }
    };
    const block = (w, d, lo, hi, color, printed = false) => {
      const side = (h) => [point(-w, h, d), point(w, h, d), point(w, h, -d), point(-w, h, -d)];
      const a = side(lo),
        b = side(hi);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4,
          label = !(j % 2) && printed;
        face(a[j], a[k], b[k], b[j], label ? [1, 1, 1] : color, label);
      }
      face(...b, color);
      face(...a.reverse(), color);
    };
    block(0.048, 0.048, 0, 2.07, [0.32, 0.38, 0.38]);
    block(f.width / 2, f.depth / 2, 2.04, f.height, [0.024, 0.065, 0.1], true);
    block(0.145, 0.059, 0.91, 1.39, [0.29, 0.32, 0.33], 'směry');
    ranges.push({ fixture: f, start, end: solid.p.length });
  });
  const glass = new SolidBuf(),
    panes = [];
  for (const fixture of fixtures) {
    if (fixture.board) continue;
    const transparent = fixture.piece === 'sklo',
      buf = transparent ? glass : solid;
    const start = buf.p.length;
    drawStreetFixture(buf, fixture);
    (transparent ? panes : ranges).push({ fixture, start, end: buf.p.length });
  }
  while (uv.length < (solid.p.length / 3) * 2) uv.push(...white);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshStandardMaterial({
    map: texture,
    vertexColors: true,
    roughness: 0.83,
    side: DoubleSide
  });
  const geometry = solid.geometry();
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const mesh = new Mesh(geometry, material);
  mesh.name = 'Označníky MHD';
  mesh.castShadow = mesh.receiveShadow = true;
  owner.group.add(mesh);
  owner.disposables.push(texture, material, geometry);
  owner.stopMesh = mesh;
  owner.stopBoards = attachRoadFurniture(world.breakables, owner.group, geometry, material, ranges);
  if (panes.length) {
    const geo = glass.geometry();
    owner.stopGlass = new Mesh(geo, glassMaterial);
    owner.group.add(owner.stopGlass);
    owner.disposables.push(geo);
    owner.stopBoards.push(...attachRoadFurniture(world.breakables, owner.group, geo, glassMaterial, panes));
  }
}
