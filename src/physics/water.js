// V terénním modelu je vidět hladina. Pro kolize odhadujeme dno podle vzdálenosti od břehu.
const BANK_WIDTH = 8;
const BANK_SLOPE = 0.12;
const CHANNEL_SLOPE = 0.025;
const MAX_DEPTH = 2.4;
const BANK_RANGE = BANK_WIDTH + (MAX_DEPTH - BANK_WIDTH * BANK_SLOPE) / CHANNEL_SLOPE;

export function riverBed(world, x0, z0, size) {
  const land = world.l, profiles = [];
  const x1 = x0 + size, z1 = z0 + size;
  for (const area of world.water ?? []) {
    if (area.x1 < x0 || area.x0 > x1 || area.z1 < z0 || area.z0 > z1) continue;
    const crossings = [], banks = [];
    for (let r = land.pRing[area.i]; r < land.pRing[area.i + 1]; r++) {
      const start = land.ringStart[r], end = land.ringStart[r + 1];
      for (let a = end - 1, b = start; b < end; a = b++) {
        const x = land.vx[a] * 0.1, z = land.vz[a] * 0.1;
        const xx = land.vx[b] * 0.1, zz = land.vz[b] * 0.1;
        const minZ = Math.min(z, zz), maxZ = Math.max(z, zz);
        if (maxZ < z0 - BANK_RANGE || minZ > z1 + BANK_RANGE) continue;
        const dx = xx - x, dz = zz - z;
        const edge = { x, z, dx, dz, minZ, maxZ, length2: dx * dx + dz * dz };
        if (dz && maxZ > z0 && minZ <= z1) crossings.push(edge);
        if (edge.length2 && Math.max(x, xx) >= x0 - BANK_RANGE && Math.min(x, xx) <= x1 + BANK_RANGE) banks.push(edge);
      }
    }
    if (banks.length || world.landContains(area.i, x0 + size / 2, z0 + size / 2)) {
      profiles.push({ crossings, banks, intersections: [] });
    }
  }
  if (!profiles.length) return null;
  let lastZ;
  return (x, z) => {
    let depth = 0;
    for (const p of profiles) {
      if (lastZ !== z) {
        p.intersections.length = 0;
        for (const e of p.crossings) if (z >= e.minZ && z < e.maxZ) {
          p.intersections.push(e.x + (z - e.z) * e.dx / e.dz);
        }
        p.intersections.sort((a, b) => a - b);
      }
      let i = 0;
      while (i < p.intersections.length && p.intersections[i] <= x) i++;
      if (!(i % 2)) continue;
      let distance2 = BANK_RANGE ** 2;
      for (const e of p.banks) {
        if (z < e.minZ - BANK_RANGE || z > e.maxZ + BANK_RANGE) continue;
        const t = Math.max(0, Math.min(1, ((x - e.x) * e.dx + (z - e.z) * e.dz) / e.length2));
        const dx = x - e.x - e.dx * t, dz = z - e.z - e.dz * t;
        distance2 = Math.min(distance2, dx * dx + dz * dz);
      }
      const distance = Math.sqrt(distance2);
      depth = Math.max(depth, Math.min(distance, BANK_WIDTH) * BANK_SLOPE +
        Math.max(0, distance - BANK_WIDTH) * CHANNEL_SLOPE);
    }
    lastZ = z;
    return depth;
  };
}

export class Water {
  constructor(physics) {
    this.physics = physics;
    const { Jolt } = physics;
    this.point = new Jolt.RVec3();
    this.up = new Jolt.Vec3(0, 1, 0);
    this.current = new Jolt.Vec3(0, 0, 0);
    this.sunk = new Set();
  }

  step(vehicle, world, dt) {
    const { car, body } = vehicle;
    if (!world.isWater(car.x, car.z)) {
      car.floodTime = 0;
      return false;
    }
    const surface = world.heightAt(car.x, car.z);
    if (car.y > surface + car.type.len / 2) return false;
    this.point.Set(car.x, surface, car.z);
    const age = car.floodTime || 0;
    const lift = Math.max(0.18, 1.95 - Math.max(0, age - 2) * 0.24);
    const wet = body.ApplyBuoyancyImpulse(this.point, this.up, lift, 0.65, 0.8, this.current,
      this.physics.system.GetGravity(), dt);
    if (!wet) return false;
    this.physics.bodies.ActivateBody(body.GetID());
    car.floodTime = age + dt;
    vehicle.controller.SetDriverInput(0, 0, 0, 0);
    if (car.mode !== 'player') car.mode = 'loose';
    // Nejvyšší bod obálky karoserie i při náklonu po sjezdu z břehu.
    const q = body.GetRotation(), x = q.GetX(), y = q.GetY(), z = q.GetZ(), w = q.GetW();
    const upY = 1 - 2 * (x * x + z * z);
    const roof = body.GetPosition().GetY() - upY * vehicle.spec.height + Math.max(0, upY) * car.type.h + Math.abs(x * y + z * w) * car.type.wid +
      Math.abs(y * z - x * w) * car.type.len;
    if (age >= 6 && roof < surface - 0.02) this.sunk.add(car);
    return age === 0;
  }

  dispose() {
    for (const v of [this.current, this.up, this.point]) this.physics.Jolt.destroy(v);
  }
}
