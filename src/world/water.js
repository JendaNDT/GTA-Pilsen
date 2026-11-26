import { DataTexture, LinearFilter } from 'three/webgpu';
import { LC } from '../config.js';
import { fillLandPolygon } from './terrain-classes.js';
import { RADBUZA, waterCurrent, waterPilotAt, waterPilotWeight } from './water-profile.js';

// Metry od břehu se počítají i v okolních dlaždicích, aby na jejich hraně nevznikla mělčina.
export function waterField(land, polygons, lines, weirs, x, z, size = 256, pixels = 64, pilot = false) {
  const ids = polygons.filter((id) => land.cls[id] === LC.WATER);
  if (!ids.length) return null;
  const step = size / pixels,
    reach = 48,
    pad = Math.ceil(reach / step) + 1,
    n = pixels + 2 * pad;
  const originX = x - pad * step,
    originZ = z - pad * step;
  const body = new Uint32Array(n * n);
  for (const id of ids) fillLandPolygon(land, id, originX, originZ, step, n, body, id + 1);
  const depth = Float32Array.from(body, (id) => (id ? 16 : 0));
  const diag = step * Math.SQRT2;
  for (let r = 1; r < n - 1; r++)
    for (let c = 1; c < n - 1; c++) {
      const i = r * n + c;
      if (body[i])
        depth[i] = Math.min(
          depth[i],
          depth[i - 1] + step,
          depth[i - n] + step,
          depth[i - n - 1] + diag,
          depth[i - n + 1] + diag
        );
    }
  for (let r = n - 2; r > 0; r--)
    for (let c = n - 2; c > 0; c--) {
      const i = r * n + c;
      if (body[i])
        depth[i] = Math.min(
          depth[i],
          depth[i + 1] + step,
          depth[i + n] + step,
          depth[i + n + 1] + diag,
          depth[i + n - 1] + diag
        );
    }
  const output = new Uint8Array(pixels * pixels * 4),
    best = new Float32Array(pixels * pixels).fill(reach * reach);
  for (let r = 0; r < pixels; r++)
    for (let c = 0; c < pixels; c++) {
      const source = (r + pad) * n + c + pad,
        k = (r * pixels + c) * 4;
      output[k] = output[k + 1] = 128;
      output[k + 2] = Math.round((255 * Math.max(0, depth[source] - step / 2)) / (16 - step / 2));
    }
  for (const id of lines) {
    if (land.lCls[id] > 2) continue;
    for (let k = land.lStart[id] + 1; k < land.lStart[id + 1]; k++) {
      const ax = land.lx[k - 1] * 0.1,
        az = land.lz[k - 1] * 0.1,
        bx = land.lx[k] * 0.1,
        bz = land.lz[k] * 0.1;
      const dx = bx - ax,
        dz = bz - az,
        len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - x) / step)),
        c1 = Math.min(pixels - 1, Math.floor((Math.max(ax, bx) + reach - x) / step));
      const r0 = Math.max(0, Math.floor((Math.min(az, bz) - reach - z) / step)),
        r1 = Math.min(pixels - 1, Math.floor((Math.max(az, bz) + reach - z) / step));
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const wet = body[(r + pad) * n + c + pad];
          if (!wet) continue;
          const px = x + (c + 0.5) * step,
            pz = z + (r + 0.5) * step;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
          const sx = ax + dx * t,
            sz = az + dz * t,
            d = (sx - px) ** 2 + (sz - pz) ** 2,
            i = r * pixels + c;
          if (d >= best[i]) continue;
          const col = Math.floor((sx - originX) / step),
            row = Math.floor((sz - originZ) / step);
          if (col < 0 || col >= n || row < 0 || row >= n || body[row * n + col] !== wet) continue;
          best[i] = d;
          output[i * 4] = 128 + Math.round((127 * dx) / len);
          output[i * 4 + 1] = 128 + Math.round((127 * dz) / len);
        }
    }
  }
  if (pilot) {
    const current = {};
    for (let r = 0; r < pixels; r++) for (let c = 0; c < pixels; c++) {
      const source = (r + pad) * n + c + pad;
      if (!body[source]) continue;
      const px = x + (c + 0.5) * step, pz = z + (r + 0.5) * step;
      const area = waterPilotAt(px, pz);
      if (!area) continue;
      waterCurrent(area, px, pz, depth[source], current);
      const k = (r * pixels + c) * 4;
      const keep = 1 - waterPilotWeight(area, px, pz);
      output[k] = 128 + Math.round((output[k] - 128) * keep + 127 * current.vx);
      output[k + 1] = 128 + Math.round((output[k + 1] - 128) * keep + 127 * current.vz);
      // Jemnější pobřežní pás pro barvu mělčiny, beze změny kanálu pěny na jezech.
      if (area !== RADBUZA) output[k + 2] = Math.round(255 * Math.min(1, Math.max(0, depth[source] - step / 2) / 12));
    }
  }
  for (const [wx, wz] of weirs) {
    if (wx < x - 12 || wx > x + size + 12 || wz < z - 12 || wz > z + size + 12) continue;
    for (let r = 0; r < pixels; r++)
      for (let c = 0; c < pixels; c++) {
        const i = (r * pixels + c) * 4 + 3;
        if (body[(r + pad) * n + c + pad])
          output[i] = Math.max(
            output[i],
            Math.round(
              255 * Math.max(0, 1 - Math.hypot(x + (c + 0.5) * step - wx, z + (r + 0.5) * step - wz) / 12)
            )
          );
      }
  }
  return output;
}

export function waterTile(manager, ci, x, z, size, pilot, detail) {
  const { world: w, landIndex: index } = manager;
  if (!index.polys[ci]?.some((id) => w.l.cls[id] === LC.WATER)) return null;
  const polygons = new Set(),
    lines = new Set(),
    cx = ci % w.cols,
    cz = Math.floor(ci / w.cols);
  for (let r = Math.max(0, cz - 1); r <= Math.min(w.rows - 1, cz + 1); r++)
    for (let c = Math.max(0, cx - 1); c <= Math.min(w.cols - 1, cx + 1); c++) {
      const neighbor = r * w.cols + c;
      for (const id of index.polys[neighbor] ?? []) if (w.l.cls[id] === LC.WATER) polygons.add(id);
      for (const id of index.lines[neighbor] ?? []) if (w.l.lCls[id] <= 2) lines.add(id);
    }
  if (!detail && !lines.size) return null;
  const field = waterField(
    w.l,
    [...polygons].sort((a, b) => a - b),
    [...lines].sort((a, b) => a - b),
    manager.weirs,
    x,
    z,
    size, 64, pilot
  );
  const tex = new DataTexture(field, 64, 64);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
