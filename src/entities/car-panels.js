import { SURFACE } from '../world/material-table.js';

export function carPanel(parts, points, outward, color, surface) {
  const [a, b, c] = points;
  const u = b.map((v, i) => v - a[i]), v = c.map((value, i) => value - a[i]);
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const sign = n.reduce((sum, value, i) => sum + value * outward[i], 0) < 0 ? -1 : 1;
  const length = Math.hypot(...n);
  if (length < 1e-9) return;
  parts.polygon(sign < 0 ? points.slice().reverse() : points, n.map(value => value * sign / length), color, surface);
}

// Sklo se odspodu ke střeše zesvětluje a guma sleduje stejný obrys jako výplň.
export function carGlass(det, points, normal, sill = 0.97, height = 0.44) {
  // Zasklení má v rozích malé poloměry a po obvodu viditelné černé těsnění.
  points = points.flatMap((p, i) => {
    const previous = points[(i+points.length-1)%points.length], next = points[(i+1)%points.length];
    return [previous, next].map(q => p.map((v,k) => v + (q[k]-v)*.042));
  });
  const center = points.reduce((sum, p) => sum.map((v,i) => v+p[i]/points.length), [0,0,0]);
  det.polygon(points, normal, [0.023, 0.026, 0.028]);
  const inside = points.map(p => p.map((v,i) => center[i]+(v-center[i])*.951+normal[i]*.0035));
  const start = det.c.length;
  det.polygon(inside, normal, [0.23, 0.26, 0.28], SURFACE.glass);
  for (let i = start; i < det.c.length; i+=3) {
    const t = Math.max(0, Math.min(1, (det.p[i+1]-sill)/height));
    det.c[i] = .018 + .071*t; det.c[i+1] = .026 + .081*t; det.c[i+2] = .034 + .086*t;
  }
}
