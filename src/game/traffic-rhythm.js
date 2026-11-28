import { RC, RF } from '../config.js';
import { weekday } from './clock.js';
import { matchCityProfile } from './traffic-profile-map.js';

// Odhad pro ulice bez měření. Obě řady začínají o půlnoci.
const residential = {
  weekday: [0.12, 0.08, 0.07, 0.07, 0.09, 0.25, 0.59, 0.83, 0.70, 0.58, 0.55, 0.57,
    0.63, 0.65, 0.72, 0.84, 0.90, 0.82, 0.66, 0.51, 0.35, 0.24, 0.18, 0.14],
  weekend: [0.15, 0.11, 0.08, 0.07, 0.07, 0.10, 0.20, 0.37, 0.54, 0.66, 0.72, 0.73,
    0.68, 0.62, 0.63, 0.68, 0.70, 0.67, 0.58, 0.47, 0.34, 0.25, 0.19, 0.16],
};

export function hourlyActivity(profile, clock) {
  const h = Math.floor(clock.hour);
  const fraction = clock.hour - h;
  const series = (day) => weekday(day) < 5 ? profile.weekday : profile.weekend;
  // Hodinový medián platí uprostřed příslušné hodiny. Půlnoc míchá sousední dny.
  const current = series(clock.day)[h];
  const other = fraction < 0.5
    ? series(clock.day - (h === 0 ? 1 : 0))[(h + 23) % 24]
    : series(clock.day + (h === 23 ? 1 : 0))[(h + 1) % 24];
  return current + (other - current) * Math.abs(fraction - 0.5);
}

function meanProfile(profiles) {
  if (!profiles.length) return residential;
  return Object.fromEntries(['weekday', 'weekend'].map((kind) => [kind,
    residential[kind].map((_, hour) => profiles.reduce((sum, profile) => sum + profile[kind][hour], 0) / profiles.length)]));
}

export class TrafficRhythm {
  constructor(world, data, timetable) {
    this.world = world;
    this.timetable = timetable;
    this.measured = new Map();
    const groups = { centrum: [], prijezd: [] };
    for (const source of data?.profiles ?? []) {
      const peak = Math.max(1, ...source.weekday, ...source.weekend);
      const curve = {
        id: source.id, weekday: source.weekday.map((n) => n / peak), weekend: source.weekend.map((n) => n / peak),
      };
      if (this.bind(source, curve)) groups[source.area].push(curve);
    }
    for (const source of data?.city?.profiles ?? []) {
      const peak = Math.max(1, ...source.weekday, ...source.weekend);
      const scale = Math.max(0.35, Math.min(1, peak / 900));
      const curve = {
        id: `plzen-${source.id}`, weekday: source.weekday.map((n) => n / peak * scale),
        weekend: source.weekend.map((n) => n / peak * scale),
      };
      for (const [edge, hit] of matchCityProfile(world, source)) {
        const previous = this.measured.get(edge);
        const score = hit.length / (1 + hit.offset / hit.length);
        if (!previous || (previous.score !== undefined && score > previous.score)) this.measured.set(edge, { curve, score });
      }
    }
    this.measuredByChunk = new Map();
    for (const edge of this.measured.keys()) {
      if (world.eLen[edge] < 12) continue;
      const mid = (world.eA[edge] + world.eB[edge]) >> 1;
      const chunk = world.chunkIndex(world.rpx[mid], world.rpz[mid]);
      if (!this.measuredByChunk.has(chunk)) this.measuredByChunk.set(chunk, []);
      this.measuredByChunk.get(chunk).push(edge);
    }
    this.center = meanProfile(groups.centrum);
    this.arterial = meanProfile(groups.prijezd);
    this.rokycany = world.meta.places.find((place) => place[2] === 'Rokycany');
    this.dobriv = world.meta.places.find((place) => place[2] === 'Dobřív');
    this.road = {};
    this.point = {};
  }

  bind(source, curve) {
    const w = this.world;
    const { x, z } = w.gpsToWorld(source.lat, source.lon);
    const anchor = w.nearestRoad(x, z, 13, RC.LIVING, 0, {}, undefined, true);
    if (!anchor || w.roadNames[w.r.name[anchor.road]] !== source.street) return false;
    const angle = source.heading * Math.PI / 180;
    const tx = Math.sin(angle), tz = -Math.cos(angle);
    const direction = anchor.dx * tx + anchor.dz * tz;
    if (Math.abs(direction) < 0.8) return false;
    const at = w.traffic.locate(anchor.road, x, z, Math.sign(direction));
    if (!at) return false;
    const point = {};
    for (let edge = 0; edge < w.edgeCount; edge++) {
      const road = w.eRoad[edge];
      if (w.roadNames[w.r.name[road]] !== source.street || w.r.cls[road] > RC.LIVING ||
          (w.r.flags[road] & (RF.PRIVATE | RF.TUNNEL))) continue;
      w.edgePoint(edge, w.eLen[edge] / 2, 0, point);
      const distance = edge === at.edge ? 0 : Math.hypot(x - point.x, z - point.z);
      if (distance > 300 || edge !== at.edge && point.tx * tx + point.tz * tz < 0.72) continue;
      const previous = this.measured.get(edge);
      if (!previous || distance < previous.distance) this.measured.set(edge, { curve, distance });
    }
    return this.measured.get(at.edge)?.curve === curve;
  }

  inCenter(x, z) { return x * x + z * z <= 1250 ** 2; }

  regionalScale(x, z) {
    if (this.dobriv && (x - this.dobriv[0]) ** 2 + (z - this.dobriv[1]) ** 2 < 1300 ** 2) return 0.62;
    if (this.rokycany && (x - this.rokycany[0]) ** 2 + (z - this.rokycany[1]) ** 2 < 2400 ** 2) return 0.82;
    return 1;
  }

  settlement(x, z) {
    return Math.min(1, 0.48 + (this.world.bChunks[this.world.chunkIndex(x, z)]?.length ?? 0) / 90);
  }

  carWeight(edge, clock) {
    const measured = this.measured.get(edge);
    if (measured) return Math.max(0.025, hourlyActivity(measured.curve, clock));
    const w = this.world;
    w.edgePoint(edge, w.eLen[edge] / 2, 0, this.point);
    const { x, z } = this.point;
    const cls = w.r.cls[w.eRoad[edge]];
    const scale = this.regionalScale(x, z);
    if (cls <= RC.SECONDARY_LINK) return Math.max(0.06, hourlyActivity(this.arterial, clock) * 0.94 * scale);
    if (this.inCenter(x, z) && cls <= RC.TERTIARY_LINK) return hourlyActivity(this.center, clock) * 0.88;
    return hourlyActivity(residential, clock) * this.settlement(x, z) * 0.8 * scale;
  }

  carDensity(x, z, clock, arterialOnly = false) {
    const w = this.world;
    const road = w.nearestRoad(x, z, arterialOnly ? 100 : 50, arterialOnly ? RC.SECONDARY_LINK : RC.LIVING,
      0, this.road, undefined, true);
    if (arterialOnly && (!road || w.r.flags[road.road] & RF.TUNNEL)) return 0;
    const edge = road ? w.edgeOfPt[road.seg] : -1;
    if (edge < 0) return arterialOnly ? 0 : hourlyActivity(residential, clock) * this.settlement(x, z) * this.regionalScale(x, z);
    const reverse = w.reverseEdge(edge);
    const density = this.carWeight(edge, clock);
    const both = reverse < 0 ? density : Math.max(density, this.carWeight(reverse, clock));
    // Plný přísun na vozovce i chodníku, k okraji sousední čtvrti postupně slábne.
    return arterialOnly ? both * Math.min(1, (100 - road.dist) / 65) : both;
  }

  pedestrianWeight(x, z, clock) {
    const center = this.inCenter(x, z);
    const scale = center ? 0.84 : this.settlement(x, z) * this.regionalScale(x, z) * 0.74;
    const base = hourlyActivity(center ? this.center : residential, clock) * scale;
    const departures = this.timetable.departures(x, z, clock, 20 * 60)?.rows.length ?? 0;
    return Math.min(1, base + departures * 0.09);
  }
}
