// Pokračování ve stejném směru za hranicí mapového dílu. U křižovatky se posuzují
// i vnitřní uzly průběžné ulice, ke kterým může končit kratší připojovací úsek.
export function roadContinuations(world, roads, station) {
  const { rOff, rpx, rpz } = world, ends = new Map(), links = new Map();
  const key = p => rpx[p] + '/' + rpz[p];
  for (let road = 0; road < roads.length; road++) {
    if (!roads[road]) continue;
    for (const p of [rOff[road], rOff[road + 1] - 1]) {
      const id = key(p);
      if (!ends.has(id)) ends.set(id, []);
    }
  }
  for (let road = 0; road < roads.length; road++) {
    if (!roads[road]) continue;
    for (let p = rOff[road]; p < rOff[road + 1]; p++) {
      const list = ends.get(key(p));
      if (list) list.push(road, p);
    }
  }
  for (let road = 0; road < roads.length; road++) {
    if (!roads[road]) continue;
    for (const dir of [-1, 1]) {
      const p = dir < 0 ? rOff[road] : rOff[road + 1] - 1, q = p - dir;
      const len = Math.abs(station[p] - station[q]);
      if (!len) continue;
      const dx = (rpx[p] - rpx[q]) / len, dz = (rpz[p] - rpz[q]) / len;
      const list = ends.get(key(p));
      let best = -Infinity;
      for (let j = 0; j < list.length; j += 2) {
        const other = list[j], k = list[j + 1];
        if (other === road && k === p) continue;
        // Vjezd do garáže leží pod horní odjezdovou plochou i při shodných souřadnicích.
        if (world.elevatedWidths?.has(road) && world.elevatedWidths.has(other) &&
            Math.abs(world.rpy[p] - world.rpy[k]) > 1) continue;
        for (const sign of [-1, 1]) {
          const next = k + sign;
          if (next < rOff[other] || next >= rOff[other + 1]) continue;
          const d = Math.abs(station[k] - station[next]);
          if (!d) continue;
          const cosine = ((rpx[next] - rpx[k]) * dx + (rpz[next] - rpz[k]) * dz) / d;
          if (cosine < 0.72) continue;
          const rank = cosine + (world.r.name[other] === world.r.name[road] ? 0.15 : 0)
            - 0.02 * Math.abs(world.r.cls[other] - world.r.cls[road]);
          if (rank <= best) continue;
          best = rank;
          links.set(p, { road: other, from: station[k], sign });
        }
      }
    }
  }
  return links;
}
