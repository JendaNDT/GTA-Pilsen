// Jednoduché rastrování pro mapu povrchů: vyplnění mnohoúhelníků (sudá–lichá)
// a tahy čar s kulatým zakončením. Hodnoty jsou čísla barev z palety.

/** rings: pole kruhů, každý [x0, y0, x1, y1, …] v pixelech. Střed pixelu je v (i+0.5, j+0.5). */
export function fillRings(target, W, H, rings, value) {
  let minY = Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (let k = 1; k < ring.length; k += 2) { if (ring[k] < minY) minY = ring[k]; if (ring[k] > maxY) maxY = ring[k]; }
  }
  if (maxY < 0 || minY > H) return;
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
  const xs = [];
  for (let j = y0; j <= y1; j++) {
    const yc = j + 0.5;
    xs.length = 0;
    for (const ring of rings) {
      const n = ring.length / 2;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const ya = ring[a * 2 + 1], yb = ring[b * 2 + 1];
        if ((ya > yc) === (yb > yc)) continue;
        const xa = ring[a * 2], xb = ring[b * 2];
        xs.push(xa + (yc - ya) * (xb - xa) / (yb - ya));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] - 0.5)), i1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      if (i1 >= i0) target.fill(value, j * W + i0, j * W + i1 + 1);
    }
  }
}

/** Tah lomené čáry šířky width (pixely) s kulatými spoji a konci. pts = [x0, y0, x1, y1, …]. */
export function strokeLine(target, W, H, pts, width, value) {
  const r = width / 2, r2 = r * r;
  const n = pts.length / 2;
  for (let s = 0; s < Math.max(1, n - 1); s++) {
    const ax = pts[s * 2], ay = pts[s * 2 + 1];
    const bx = n > 1 ? pts[s * 2 + 2] : ax, by = n > 1 ? pts[s * 2 + 3] : ay;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), i1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), j1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + r));
    if (i0 > i1 || j0 > j1) continue;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let j = j0; j <= j1; j++) {
      const py = j + 0.5;
      for (let i = i0; i <= i1; i++) {
        const px = i + 0.5;
        let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const qx = ax + dx * t - px, qy = ay + dy * t - py;
        if (qx * qx + qy * qy <= r2) target[j * W + i] = value;
      }
    }
  }
}
