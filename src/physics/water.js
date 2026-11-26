import { sampleWater, waterDepthFromShore } from '../world/water-profile.js';

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
      depth = Math.max(depth, waterDepthFromShore(distance));
    }
    lastZ = z;
    return depth;
  };
}

// Obálku sestavíme jen vozu, který se skutečně potápí. Rozměry typu zahrnují podvozek.
function submergedBounds(car) {
  const bounds = { halfWidth: car.type.wid / 2, halfLength: car.type.len / 2, top: car.type.h, bottom: 0 };
  if (!car.mesh) return bounds;
  const { body, detail } = car.mesh.userData.batches;
  for (const part of [body, detail, ...(car.mesh.userData.beacons ?? [])]) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    const { min, max } = part.geometry.boundingBox, p = part.position;
    bounds.halfWidth = Math.max(bounds.halfWidth, -min.x - p.x, max.x + p.x);
    bounds.halfLength = Math.max(bounds.halfLength, -min.z - p.z, max.z + p.z);
    bounds.top = Math.max(bounds.top, max.y + p.y);
    bounds.bottom = Math.min(bounds.bottom, min.y + p.y);
  }
  return bounds;
}

function highestBodyPoint(centerY, q, height, bounds) {
  const { x, y, z, w } = q;
  const upY = 1 - 2 * (x * x + z * z);
  return centerY + upY * ((upY >= 0 ? bounds.top : bounds.bottom) - height)
    + 2 * Math.abs(x * y + z * w) * bounds.halfWidth
    + 2 * Math.abs(y * z - x * w) * bounds.halfLength;
}

export class Water {
  constructor(physics) {
    this.physics = physics;
    const { Jolt } = physics;
    this.point = new Jolt.RVec3();
    this.up = new Jolt.Vec3(0, 1, 0);
    this.current = new Jolt.Vec3(0, 0, 0);
    this.sunk = new Set();
    this.surface = {};
  }

  step(vehicle, world, dt) {
    const { car, body } = vehicle;
    if (!world.isWater(car.x, car.z)) {
      car.floodTime = 0;
      return false;
    }
    const { level: surface, vx, vz } = sampleWater(world, car.x, car.z, this.surface);
    if (car.y > surface + car.type.len / 2) return false;
    this.point.Set(car.x, surface, car.z);
    this.current.Set(vx, 0, vz);
    const age = car.floodTime || 0;
    const lift = Math.max(0.18, 1.95 - Math.max(0, age - 2) * 0.24);
    const wet = body.ApplyBuoyancyImpulse(this.point, this.up, lift, 0.65, 0.8, this.current,
      this.physics.system.GetGravity(), dt);
    if (!wet) return false;
    this.physics.bodies.ActivateBody(body.GetID());
    car.floodTime = age + dt;
    vehicle.controller.SetDriverInput(0, 0, 0, 0);
    if (car.mode !== 'player') car.mode = 'loose';
    if (age >= 6) {
      const bounds = vehicle.submergedBounds ??= submergedBounds(car);
      const { position, rotation, previousPosition, previousRotation } = vehicle.pose;
      const height = vehicle.spec.height;
      // I na začátku interpolace musí být poslední viditelná střecha pod hladinou.
      if (highestBodyPoint(position.y, rotation, height, bounds) < surface - 0.02 &&
          highestBodyPoint(previousPosition.y, previousRotation, height, bounds) < surface - 0.02) this.sunk.add(car);
    }
    return age === 0;
  }

  dispose() {
    for (const v of [this.current, this.up, this.point]) this.physics.Jolt.destroy(v);
  }
}
