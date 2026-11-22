const CORNER_ALIGN = 0.995;             // směr silnice a ramene rohu se liší nejvýš o 5,7°

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
  let entryLane = car.lane, exitLane = car.nextLane;
  if (cross > 0) {
    const wide = cornerTurn(world, car, length, angle, sign, cross, turnRadius);
    if (wide) return wide;
    // Vnitřní bok potřebuje zůstat na asfaltu alespoň jedné z obou ulic.
    // Vzdálenost oblouku od jeho tečny je R·(1 − cos úhlu). Potřebné místo
    // získáme nejdřív na příjezdu, aby vůz zatáčku dokončil ve svém pruhu.
    const half = car.type.wid / 2;
    // Tečna dráhy středu vozu a směr zadní nápravy se v oblouku liší.
    // Započítáme proto i průmět převisu karoserie směrem k protisměru.
    const sine = car.type.len * 0.32 / turnRadius;
    const centerClearance = half * Math.sqrt(1 - sine * sine) + car.type.len / 2 * sine;
    const stopBeforeTurn = world.traffic?.byEdge.get(car.edge)?.some(c => c.kind !== 'signal' &&
      length - c.s < turnRadius * Math.tan(angle / 2) + car.type.len * 2);
    const entryRoom = world.r.w[world.eRoad[car.edge]] / 2 - entryLane - half;
    const exitRoom = world.r.w[world.eRoad[car.next]] / 2 - exitLane - half;
    const covered = room => Math.acos(1 - Math.min(2, Math.max(0, room) / turnRadius));
    const needed = room => turnRadius * (1 - Math.cos(Math.max(0, angle - covered(room))));
    const entryShift = Math.min(Math.max(0, entryLane - (stopBeforeTurn ? centerClearance : half + 0.25)),
      Math.max(0, needed(exitRoom) - entryRoom));
    entryLane -= entryShift;
    exitLane -= Math.min(Math.max(0, exitLane - half - 0.25), Math.max(0, needed(entryRoom + entryShift) - exitRoom));
  }
  return arcTurn(world, car, length, entryLane, exitLane, turnRadius, angle, sign, cross);
}

/**
 * Odbočení vpravo v zaobleném rohu: vůz jede po oblouku soustředném s obrubníkem, ve stejné
 * vzdálenosti od okraje jako v pruhu. Poloměr je větší než nejostřejší zatočení, vůz proto
 * nevybočuje do protisměru a zatáčí rychleji. Null, když roh chybí, když by dráha byla
 * k obrubníku blíž než půl šířky vozu a 0,3 m, nebo když vůz (vnitřní bok, střed nebo vnější
 * bok) cestou opustí asfalt (silnice se před rohem stáčí a oblouk s okrajem přesně nelícuje).
 */
function cornerTurn(world, car, length, angle, sign, cross, turnRadius) {
  if (!world.cornerBetween) return null;
  const node = world.edgePoint(car.edge, length, 0, {}), out = world.edgePoint(car.next, 0, 0, {});
  const corner = world.cornerBetween(node.x, node.z, -node.tx, -node.tz, out.tx, out.tz);
  if (!corner) return null;
  // Oblouk rohu sedí na okraje jen tam, kde silnice u křižovatky vede rovně ve směru ramene.
  const aligned = (arm, dx, dz) => arm.dx * dx + arm.dz * dz > CORNER_ALIGN;
  if (!((aligned(corner.a, -node.tx, -node.tz) && aligned(corner.b, out.tx, out.tz)) ||
    (aligned(corner.a, out.tx, out.tz) && aligned(corner.b, -node.tx, -node.tz)))) return null;
  const roomA = world.r.w[world.eRoad[car.edge]] / 2 - car.lane, roomB = world.r.w[world.eRoad[car.next]] / 2 - car.nextLane;
  const radius = corner.radius + Math.min(roomA, roomB);
  if (!(radius > turnRadius)) return null;
  const turn = arcTurn(world, car, length, car.lane, car.nextLane, radius, angle, sign, cross);
  if (!turn) return null;
  const margin = car.type.wid / 2 + 0.3;
  const gap = turn.radius - corner.radius - Math.hypot(turn.cx - corner.center[0], turn.cz - corner.center[1]);
  if (gap < margin) return null;
  if (world.onCarriageway) {
    const arc = turn.radius * turn.angle, p = {};
    const steps = Math.max(2, Math.ceil(arc / 0.75));
    for (let i = 0; i <= steps; i++) {
      turnPoint(turn, arc * i / steps, p);
      for (const offset of [-margin, -margin / 2, 0, car.type.wid / 2]) {
        const k = (turn.radius + offset) / turn.radius;
        const x = turn.cx + (p.x - turn.cx) * k, z = turn.cz + (p.z - turn.cz) * k;
        if (!world.onCarriageway(x, z, world.heightAt(x, z))) return null;
      }
    }
  }
  return turn;
}

/** Kružnicový oblouk poloměru nejvýš turnRadius mezi pruhy entryLane a exitLane (null, když se nevejde). */
function arcTurn(world, car, length, entryLane, exitLane, turnRadius, angle, sign, cross) {
  const a = world.edgePoint(car.edge, length, entryLane, {});
  const b = world.edgePoint(car.next, 0, exitLane, {});
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
  // Před stopčárou stojí vůz uprostřed svého pruhu, aby jej protijedoucí minul.
  // Do širšího nájezdu se posune až mezi čárou a začátkem oblouku.
  const line = world.traffic?.byEdge.get(car.edge)?.findLast(c => c.s <= entry);
  const approachLength = line ? Math.max(1, Math.min(12, entry - line.s)) : 12;
  return { from: car.edge, to: car.next, length, entry, exit, entryLane, exitLane,
    lane: car.lane, nextLane: car.nextLane, start, end, cx, cz, radius, angle, sign, approachLength };
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

export function opposingLeftTurns(first, second) {
  if (!second || first.sign >= 0 || second.sign >= 0) return false;
  const a = first.start, b = second.start;
  if (a.tx * b.tx + a.tz * b.tz > -0.9) return false;
  // Oba oblouky patří do téže křižovatky také tehdy, když řidiči
  // začnou odbočovat ještě před místem, kde by se při jízdě rovně minuli.
  return Math.hypot(a.x - b.x, a.z - b.z) < first.radius + second.radius;
}

// Vzdálenost po ose protijedoucího auta do místa, kde ji protne levé odbočení.
export function oncomingDistance(turn, halfLength, other, tx, tz) {
  const a = turn.start, b = turn.end;
  if (a.tx * tx + a.tz * tz > -0.8) return Infinity;
  const dx = b.x + b.tx * halfLength - a.x, dz = b.z + b.tz * halfLength - a.z;
  const cross = dx * tz - dz * tx;
  if (Math.abs(cross) < 0.1) return Infinity;
  const x = a.x - other.x, z = a.z - other.z;
  const t = (z * tx - x * tz) / cross;
  return t < 0 || t > 1 ? Infinity : (x + dx * t) * tx + (z + dz * t) * tz;
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
    const forward = ux * tx + uz * tz, side = uz * tx - ux * tz;
    const cosine = Math.abs(forward), sine = Math.abs(side);
    const along = ox * tx + oz * tz, across = ox * tz - oz * tx;
    const reach = half * cosine + width * sine;
    const clearance = halfWidth + 0.1;
    if (along + reach > 0 && along - reach < length &&
        Math.abs(across) < clearance + width * cosine + half * sine) {
      // Na šikmém úseku může roh průmětu ležet v pruhu, zatímco karoserie je venku.
      // Omezíme místo dotyku nárazníku také oběma skutečnými boky překážky.
      let enter = Math.max(0, along - reach), leave = Math.min(length, along + reach);
      for (let axis = 0; axis < 2; axis++) {
        const direction = axis === 0 ? forward : side;
        const offset = axis === 0 ? ox * ux + oz * uz : ox * uz - oz * ux;
        const extent = axis === 0 ? half + clearance * sine : width + clearance * cosine;
        if (Math.abs(direction) < 1e-8) {
          if (Math.abs(offset) > extent) { leave = -1; break; }
        } else {
          const first = (offset - extent) / direction, second = (offset + extent) / direction;
          enter = Math.max(enter, Math.min(first, second));
          leave = Math.min(leave, Math.max(first, second));
        }
      }
      if (enter <= leave) return travelled + enter - halfLength;
    }
    travelled += length; x = p.x; z = p.z;
  }
  return Infinity;
}
