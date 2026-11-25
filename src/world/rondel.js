// Mimoúrovňová křižovatka u Roudné. Osy a opěry z OSM, výšky v Bpv z DMP/DMR ČÚZK.
// Zdroj půdorysu: ortofoto ČÚZK a https://plzen.eu/doprava/dopravni-stavby-a-projekty/rondel/
import { RC, RF } from '../config.js';

// Nástupy na lávky jsou na společných uzlech. DMR pod nosnou konstrukcí měří dolní terén.
const FOOT_SPANS = [
  [[-148.5, -846.2], [-174.8, -833.9], 310.93, 2.05],
  [[-159.2, -733.1], [-130.3, -729.8], 310.82, 2.65],
];
const WALLS = [
  [[-176.5, -808.9], [-172.8, -815.3], [-170.1, -819.3], [-171.9, -826.7], [-174.8, -833.9], [-175.3, -835.4], [-184.5, -831.8]],
  [[-139.9, -851.3], [-148.9, -847.6], [-148.5, -846.2], [-146.5, -839.3], [-144.3, -833.1], [-140.8, -833.5], [-131.5, -833.8]],
  [[-117.2, -751.1], [-122.7, -748.6], [-130.0, -746.8], [-130.4, -740.7], [-130.3, -729.8], [-130.3, -728.1], [-121.3, -726.9]],
  [[-167.3, -732.1], [-159.2, -731.4], [-159.2, -733.1], [-159.3, -742.4], [-159.0, -744.9], [-159.4, -751.5], [-164.1, -753.9], [-170.6, -760.7]],
];
const ROAD_HEIGHT = 310.78;

const inRing = (x, z) => x >= -195 && x <= -84 && z >= -844 && z <= -736;
const meets = (p, x, z) => Math.hypot(p[0] - x, p[1] - z) <= 0.3;

function ringElevation(x, z) {
  const crossing = Math.min(1, Math.abs(z + 790) / 46);
  const east = Math.min(1, Math.max(0, (x + 147) / 58));
  return ROAD_HEIGHT - (0.12 + 0.24 * east) * (1 - crossing);
}

/** Doplní profily do stejných os, které používá vykreslování, graf a kolize. */
export function prepareRondel(world) {
  const { r, rCount, rOff, rpx, rpz, rpy, baseElevation } = world;
  const through = new Set(), ring = new Set(), elevated = new Map(), trackAccess = new Set(), walls = new Map();
  for (let road = 0; road < rCount; road++) {
    const a = rOff[road], b = rOff[road + 1] - 1;
    const x = rpx[a], z = rpz[a], ex = rpx[b], ez = rpz[b];
    const name = world.roadNames[r.name[road]];
    if (name === 'Karlovarská' && r.cls[road] === RC.PRIMARY) {
      for (let k = a; k <= b; k++) if (inRing(rpx[k], rpz[k])) through.add(road);
    }
    if (name === 'Rondel' && (r.flags[road] & RF.ROUNDABOUT) && inRing(x, z) && inRing(ex, ez)) {
      ring.add(road);
      elevated.set(road, Math.max(r.w[road] / 2 + 0.30, r.lanes[road] === 1 ? 3.55 : 3.9));
      for (let k = a; k <= b; k++) rpy[k] = ringElevation(rpx[k], rpz[k]) - baseElevation;
    } else if (r.cls[road] === RC.FOOTWAY && Math.max(x, ex) < -100 && Math.min(x, ex) > -220
        && Math.max(z, ez) < -720 && Math.min(z, ez) > -858) {
      for (const [left, right, elevation, halfWidth] of FOOT_SPANS) {
        const start = meets(left, x, z) || meets(right, x, z);
        const end = meets(left, ex, ez) || meets(right, ex, ez);
        if (!start && !end) continue;
        const h = elevation - baseElevation;
        elevated.set(road, start && end ? halfWidth : r.w[road] / 2 + 0.30);
        for (let k = a; k <= b; k++) {
          const d = start && end ? 0 : start ? Math.hypot(rpx[k] - x, rpz[k] - z) : Math.hypot(rpx[k] - ex, rpz[k] - ez);
          const w = Math.max(0, 1 - d / 16);
          rpy[k] += (h - rpy[k]) * w;
        }
        break;
      }
    } else if (name === 'Karlovarská' && r.cls[road] === RC.SERVICE && (r.flags[road] & RF.PRIVATE)
        && x > -300 && x < -150 && z > -1035 && z < -480) {
      // Po tramvajovém pásu vede souběžná servisní trasa pro zásah. Zachová se v grafu.
      trackAccess.add(road);
    }
  }

  // Také připojovací pruhy od okruhu vedou po vlastní niveletě až k nejbližšímu uzlu.
  const exits = new Set();
  for (const road of ring) for (const k of [rOff[road], rOff[road + 1] - 1]) exits.add(rpx[k] + '/' + rpz[k]);
  for (let road = 0; road < rCount; road++) {
    if (r.cls[road] !== RC.PRIMARY_LINK || world.roadNames[r.name[road]] !== 'Karlovarská') continue;
    if ([rOff[road], rOff[road + 1] - 1].some(k => exits.has(rpx[k] + '/' + rpz[k]))) through.add(road);
  }
  if (ring.size) {
    for (const path of WALLS) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const tile = world.chunkIndex((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        if (tile < 0) continue;
        if (!walls.has(tile)) walls.set(tile, []);
        walls.get(tile).push([a, b, ROAD_HEIGHT - baseElevation]);
      }
    }
  }
  return { ring, through, elevated, trackAccess, walls };
}
