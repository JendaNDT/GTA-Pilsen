// Kružnicový oblouk spojuje tečny obou jízdních pruhů. Jejich osy se protínají
// jinde než středové čáry silnic, zvlášť u ostrého odbočení doprava.
export function laneTurn(world, car) {
  const length = world.eLen[car.edge];
  const a = world.edgePoint(car.edge, length, car.lane, {});
  const b = world.edgePoint(car.next, 0, car.nextLane, {});
  const cross = a.tx * b.tz - a.tz * b.tx;
  const dot = a.tx * b.tx + a.tz * b.tz;
  if (dot > 0.95 || Math.abs(cross) < 0.05) return null;
  const angle = Math.atan2(Math.abs(cross), dot), sign = Math.sign(cross);
  const turnRadius = car.type.len * 0.64 / Math.tan(0.62) + 1;
  // U ostrého pravého rohu potřebují zadní kola místo na vnitřní straně oblouku.
  const room = (edge, lane) => cross > 0 ? Math.min(Math.max(0, lane - car.type.wid / 2),
    Math.max(0, lane + turnRadius * (1 - Math.cos(angle / 2)) + car.type.wid / 2 - world.r.w[world.eRoad[edge]] / 2)) : 0;
  const entryLane = car.lane - room(car.edge, car.lane), exitLane = car.nextLane - room(car.next, car.nextLane);
  world.edgePoint(car.edge, length, entryLane, a);
  world.edgePoint(car.next, 0, exitLane, b);
  const dx = b.x - a.x, dz = b.z - a.z;
  const alongA = (dx * b.tz - dz * b.tx) / cross;
  const alongB = (dx * a.tz - dz * a.tx) / cross;
  const tangent = Math.tan(angle / 2);
  const radius = Math.min(turnRadius,
    (length + alongA) / tangent, (world.eLen[car.next] - alongB) / tangent);
  if (radius < 1) return null;
  const entry = length + alongA - radius * tangent, exit = alongB + radius * tangent;
  if (entry >= length || exit <= 0) return null;
  const start = world.edgePoint(car.edge, entry, entryLane, {});
  const end = world.edgePoint(car.next, exit, exitLane, {});
  const cx = start.x - a.tz * radius * sign, cz = start.z + a.tx * radius * sign;
  // Oblouk platí pro rovné příjezdy. Krátké zalomené spojky mají vlastní osu.
  const endX = cx + b.tz * radius * sign, endZ = cz - b.tx * radius * sign;
  if (Math.hypot(endX - end.x, endZ - end.z) > 1) return null;
  return { from: car.edge, to: car.next, length, entry, exit, entryLane, exitLane,
    lane: car.lane, nextLane: car.nextLane, start, end, cx, cz, radius, angle, sign };
}

export function turnDistance(turn, x, z) {
  const { start, end, cx, cz, sign, angle, radius } = turn;
  const before = (x - start.x) * start.tx + (z - start.z) * start.tz;
  const after = (x - end.x) * end.tx + (z - end.z) * end.tz;
  const rx = x - cx, rz = z - cz;
  const phase = Math.atan2(rx * start.tx + rz * start.tz, sign * (rx * start.tz - rz * start.tx));
  if (phase < 0) return before;
  if (phase > angle) return radius * angle + after;
  return radius * phase;
}

export function turnPoint(turn, distance, out) {
  const { start, cx, cz, radius, sign } = turn;
  const phase = sign * distance / radius, sin = Math.sin(phase), cos = Math.cos(phase);
  out.tx = start.tx * cos - start.tz * sin;
  out.tz = start.tz * cos + start.tx * sin;
  out.x = cx + sign * radius * out.tz;
  out.z = cz - sign * radius * out.tx;
  return out;
}

// Volná vzdálenost pro nárazník podél plánované trasy, včetně zatáčky.
export function pathClearance(x, z, yaw, halfLength, halfWidth, other, path) {
  const ux = Math.sin(other.yaw ?? yaw), uz = Math.cos(other.yaw ?? yaw);
  const half = other.halfLen ?? 0.5, width = other.radius ?? 0.45;
  let travelled = 0;
  for (const p of path) {
    const dx = p.x - x, dz = p.z - z, length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const tx = dx / length, tz = dz / length, ox = other.x - x, oz = other.z - z;
    const cosine = Math.abs(ux * tx + uz * tz), sine = Math.abs(ux * tz - uz * tx);
    const along = ox * tx + oz * tz, across = ox * tz - oz * tx;
    const reach = half * cosine + width * sine;
    if (along + reach > 0 && along - reach < length &&
        Math.abs(across) < halfWidth + width * cosine + half * sine + 0.1) {
      return travelled + along - reach - halfLength;
    }
    travelled += length; x = p.x; z = p.z;
  }
  return Infinity;
}
