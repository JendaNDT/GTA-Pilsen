import { RC } from '../config.js';

/** Směrové hrany pokryté geometrií městského profilu. */
export function matchCityProfile(world, profile) {
  const points = profile.line.map(([lon, lat]) => world.gpsToWorld(lat, lon));
  const sensor = world.gpsToWorld(profile.point[1], profile.point[0]);
  const angle = profile.heading * Math.PI / 180;
  const tx = Math.sin(angle), tz = -Math.cos(angle);
  const segments = [];
  let nearest = Infinity, alignment = 0, total = 0;
  for (let i = 1; i < points.length; i++) {
    const { x, z } = points[i - 1];
    const dx = points[i].x - x, dz = points[i].z - z;
    const length = Math.hypot(dx, dz);
    if (length < 0.5) continue;
    const along = Math.max(0, Math.min(1, ((sensor.x - x) * dx + (sensor.z - z) * dz) / length ** 2));
    const distance = Math.hypot(sensor.x - (x + dx * along), sensor.z - (z + dz * along));
    if (distance < nearest) {
      nearest = distance;
      alignment = (dx * tx + dz * tz) / length;
    }
    segments.push({ x, z, dx, dz, length });
    total += length;
  }
  if (nearest > 28 || Math.abs(alignment) < 0.65 || total < 8) return new Map();
  const sign = Math.sign(alignment), matches = new Map(), road = {};
  let covered = 0;
  for (const { x, z, dx, dz, length } of segments) {
    const steps = Math.ceil(length / 9), weight = length / steps;
    const heading = { tx: sign * dx / length, tz: sign * dz / length };
    for (let step = 0; step < steps; step++) {
      const t = (step + 0.5) / steps;
      const match = world.nearestRoad(x + dx * t, z + dz * t, 10, RC.LIVING, 0, road, undefined, true, heading);
      if (!match) continue;
      let edge = world.edgeOfPt[match.seg];
      if (edge < 0) continue;
      if (match.dx * heading.tx + match.dz * heading.tz < 0) edge = world.reverseEdge(edge);
      if (edge < 0) continue;
      const hit = matches.get(edge) ?? { length: 0, offset: 0 };
      hit.length += weight;
      hit.offset += match.dist * weight;
      covered += weight;
      matches.set(edge, hit);
    }
  }
  if (covered < 0.7 * total) return new Map();
  for (const [edge, hit] of matches) {
    if (hit.length < Math.min(12, world.eLen[edge] * 0.5)) matches.delete(edge);
  }
  return matches;
}
