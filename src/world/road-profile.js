export const BRIDGE_THICKNESS = 0.94;

/**
 * Zahuštěná lomená čára: body s až e pole (xs, zs), u mostů i výšky mostovky (ys).
 * a, b = meze celé linie – sousední body mimo úsek slouží k plynulému navázání.
 */
export function densePath(xs, zs, ys, s, e, a, b, step) {
  const X = [xs[s]], Z = [zs[s]], Y = ys ? [ys[s]] : null;
  for (let k = s; k < e; k++) {
    const dx = xs[k + 1] - xs[k], dz = zs[k + 1] - zs[k];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    for (let q = 1; q <= n; q++) {
      const t = q / n;
      X.push(xs[k] + dx * t); Z.push(zs[k] + dz * t);
      if (Y) Y.push(ys[k] + (ys[k + 1] - ys[k]) * t);
    }
  }
  return {
    x: X, z: Z, y: Y, n: X.length,
    px: s > a ? xs[s - 1] : NaN, pz: s > a ? zs[s - 1] : NaN,
    nx: e < b ? xs[e + 1] : NaN, nz: e < b ? zs[e + 1] : NaN,
  };
}

/** Směr kolmý na čáru v bodě k (průměr sousedních úseků) + měřítko pro ostré lomy. */
const _nrm = { x: 0, z: 0, scale: 1, dot: 1 };
export function pathNormal(D, k) {
  const X = D.x, Z = D.z, n = D.n;
  const ax = k > 0 ? X[k - 1] : D.px, az = k > 0 ? Z[k - 1] : D.pz;
  const bx = k < n - 1 ? X[k + 1] : D.nx, bz = k < n - 1 ? Z[k + 1] : D.nz;
  let d0x = 0, d0z = 0, d1x = 0, d1z = 0;
  const has0 = ax === ax, has1 = bx === bx;
  if (has0) { d0x = X[k] - ax; d0z = Z[k] - az; const l = Math.hypot(d0x, d0z) || 1; d0x /= l; d0z /= l; }
  if (has1) { d1x = bx - X[k]; d1z = bz - Z[k]; const l = Math.hypot(d1x, d1z) || 1; d1x /= l; d1z /= l; }
  let nx, nz, scale = 1, dot = 1;
  if (has0 && has1) {
    nx = -(d0z + d1z); nz = d0x + d1x;
    const l = Math.hypot(nx, nz);
    if (l < 1e-4) { nx = -d1z; nz = d1x; } else { nx /= l; nz /= l; }
    dot = nx * -d1z + nz * d1x;
    scale = 1 / Math.max(0.55, dot);
  } else if (has1) { nx = -d1z; nz = d1x; } else { nx = -d0z; nz = d0x; }
  _nrm.x = nx; _nrm.z = nz; _nrm.scale = scale; _nrm.dot = dot;
  return _nrm;
}

/** Posun konstrukce vůči ose jízdních pruhů zachová návaznost uličního grafu. */
export function offsetDeck(path, calibration) {
  if (!calibration) return path;
  const {shiftX, shiftZ} = calibration;
  return {...path, x:path.x.map(x => x + shiftX), z:path.z.map(z => z + shiftZ),
    px:path.px + shiftX, pz:path.pz + shiftZ, nx:path.nx + shiftX, nz:path.nz + shiftZ};
}
