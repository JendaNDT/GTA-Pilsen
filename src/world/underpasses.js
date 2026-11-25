// Horní nájezd může přecházet přes kraj spodní cesty. Obě výšky tam potřebují vlastní pás.
export function approachHeight(approaches, station) {
  for (const { start, end, path } of approaches.spans) {
    if (station < start - 0.001 || station > end + 0.001) continue;
    const f = Math.max(0, Math.min(path.n - 1, (station - start) * (path.n - 1) / (end - start)));
    const k = Math.min(path.n - 2, Math.floor(f));
    return path.y[k] + (path.y[k + 1] - path.y[k]) * (f - k);
  }
  return NaN;
}

export function surveyedApproaches(world, rows) {
  const roads = new Map();
  for (const [road, from, to, heights] of rows ?? []) {
    const a = world.rOff[road], b = world.rOff[road + 1] - 1;
    if (!(b > a && to > from && heights.length >= 2)) continue;
    if (!roads.has(road)) {
      const stations = new Float64Array(b - a + 1);
      for (let k = a + 1; k <= b; k++) {
        stations[k - a] = stations[k - a - 1] + Math.hypot(world.rpx[k] - world.rpx[k - 1], world.rpz[k] - world.rpz[k - 1]);
      }
      roads.set(road, { stations, spans: [] });
    }
    const entry = roads.get(road), length = entry.stations.at(-1);
    const start = from / 100, end = Math.abs(to / 100 - length) < 0.02 ? length : Math.min(to / 100, length);
    if (end <= start) continue;
    const n = heights.length, path = { n, x: [], z: [], y: [], px: NaN, pz: NaN, nx: NaN, nz: NaN };
    let k = 0;
    for (let j = 0; j < n; j++) {
      const s = start + j * (end - start) / (n - 1);
      while (k < b - a - 1 && entry.stations[k + 1] < s) k++;
      const t = (s - entry.stations[k]) / (entry.stations[k + 1] - entry.stations[k] || 1);
      for (const [out, axis] of [[path.x, world.rpx], [path.z, world.rpz]]) {
        out.push(axis[a + k] + t * (axis[a + k + 1] - axis[a + k]));
      }
      path.y.push(heights[j] / 100 - world.baseElevation);
    }
    entry.spans.push({ start, end, path });
  }
  return roads;
}
