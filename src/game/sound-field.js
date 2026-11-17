// Poslech je u postavy nebo vozidla, otočený ve směru pohledu kamery.
export function soundListener(game) {
  const { focus, mode, camYaw, world } = game;
  const y = focus.y + (mode === 'heli' ? 1.8 : 1.5);
  return {
    x: focus.x, y, z: focus.z, focus,
    rightX: -Math.cos(camYaw), rightZ: Math.sin(camYaw),
    tube: world.tunnelAt(focus.x, focus.z, focus.y)?.tunnel,
    cabin: mode === 'car' || mode === 'heli' || mode === 'transit' && !focus.doorsOpen,
  };
}

export function soundField(world, listener, source, range) {
  const dx = source.x - listener.x, dz = source.z - listener.z;
  const y = source.y + 0.85, dy = y - listener.y;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance) || distance >= range) return null;
  const own = source === listener.focus;
  const pan = own ? 0 : Math.max(-1, Math.min(1,
    (dx * listener.rightX + dz * listener.rightZ) / Math.max(3, Math.hypot(dx, dz))));
  const edge = Math.max(0, Math.min(1, (range - distance) / (range * 0.28)));
  let gain = own ? 0.86 : edge / (1 + (distance / 17) ** 1.45);
  let lowpass = 15_000;
  if (!own && listener.cabin) {
    gain *= 0.47;
    lowpass = 1700;
  }
  if (!own && distance > 4) {
    const outsideTube = world.tunnelAt(source.x, source.z, source.y)?.tunnel;
    const tubeWall = outsideTube !== listener.tube && (outsideTube || listener.tube);
    const wall = !tubeWall && world.raycast(listener.x, listener.z, source.x, source.z, (listener.y + y) / 2) < 0.98;
    if (tubeWall || wall) {
      gain *= tubeWall ? 0.22 : 0.42;
      lowpass = Math.min(lowpass, tubeWall ? 570 : 1100);
    }
  }
  return { distance, gain, lowpass, pan };
}

const CELL = 128;
const RANGE = 100;

export class WaterSound {
  constructor(world, millrace, weirs = []) {
    this.world = world;
    this.grid = new Map();
    this.flow = { x: 0, y: 0, z: 0 };
    this.weir = { x: 0, y: 0, z: 0 };
    const land = world.l;
    for (let i = 0; i < land.header.lineCount; i++) {
      const kind = land.lCls[i];
      if (kind > 3) continue;
      for (let j = land.lStart[i]; j + 1 < land.lStart[i + 1]; j++) {
        this.add(land.lx[j] * 0.1, land.lz[j] * 0.1, land.lx[j + 1] * 0.1, land.lz[j + 1] * 0.1, kind, false);
      }
    }
    if (millrace) this.add(...millrace, 1, false);
    for (const [x, z] of weirs) this.add(x, z, x, z, 0, true);
  }

  add(x, z, bx, bz, kind, weir) {
    const dx = bx - x, dz = bz - z;
    const segment = { x, z, dx, dz, length2: dx * dx + dz * dz, kind, weir };
    for (let u = Math.floor(Math.min(x, bx) / CELL); u <= Math.floor(Math.max(x, bx) / CELL); u++) {
      for (let v = Math.floor(Math.min(z, bz) / CELL); v <= Math.floor(Math.max(z, bz) / CELL); v++) {
        const key = `${u}:${v}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(segment);
      }
    }
  }

  nearby(listener, add) {
    const { x, y, z } = listener;
    let flow = RANGE ** 2, fall = RANGE ** 2, flowStrength = 0;
    for (let u = Math.floor((x - RANGE) / CELL); u <= Math.floor((x + RANGE) / CELL); u++) {
      for (let v = Math.floor((z - RANGE) / CELL); v <= Math.floor((z + RANGE) / CELL); v++) {
        for (const s of this.grid.get(`${u}:${v}`) ?? []) {
          const projection = s.length2 ? Math.max(0, Math.min(1, ((x - s.x) * s.dx + (z - s.z) * s.dz) / s.length2)) : 0;
          const sx = s.x + s.dx * projection, sz = s.z + s.dz * projection;
          const d2 = (x - sx) ** 2 + (z - sz) ** 2;
          const strength = [1, 0.92, 0.69, 0.36][s.kind];
          if (s.weir ? d2 >= fall : d2 / strength >= flow) continue;
          const sy = this.world.heightAt(sx, sz);
          if (Math.abs(y - sy) >= 55) continue;
          const source = s.weir ? this.weir : this.flow;
          source.x = sx; source.z = sz; source.y = sy;
          if (s.weir) fall = d2;
          else { flow = d2 / strength; flowStrength = strength; }
        }
      }
    }
    if (flow < RANGE ** 2) add(this.flow, 'water', RANGE, { power: flowStrength });
    if (fall < RANGE ** 2) add(this.weir, 'weir', RANGE, { power: 1 });
  }
}
