// Rozměry prvního vozu soupravy Tatra v místních metrech. Čelo je ve směru +z.
export const PILOT_TRIP = '685462';
export const CABIN_DOORS = [6.02, 0.09, -5.96];
export const CABIN_SEATS = [-4.9, -3.85, -2.8, -1.75, 1.55, 2.6, 3.65, 4.7]
  .flatMap(z => [-0.81, 0.81].map(x => ({ x, z })));

export function boardingDoor(across, along) {
  if (across < 1.22 || across > 3.9) return null;
  return CABIN_DOORS.find(z => Math.abs(z - along) <= 0.85) ?? null;
}

function canStand(x, z) {
  return Math.abs(x) <= 1.04 && z >= -6.53 && z <= 6.48 &&
    !CABIN_SEATS.some(seat => Math.abs(x - seat.x) < 0.43 && Math.abs(z - seat.z) < 0.47);
}

export class TramCabin {
  constructor(door, platform) {
    this.x = -0.82;
    this.z = door;
    this.yaw = door > 0.5 ? Math.PI : 0;
    this.pitch = 0;
    this.platform = platform;
    this.seat = null;
  }

  walk(dt, right, forward) {
    if (this.seat || (!right && !forward)) return;
    const scale = dt * 1.75 / Math.max(1, Math.hypot(right, forward));
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const x = this.x + (forward * sin - right * cos) * scale;
    const z = this.z + (forward * cos + right * sin) * scale;
    if (canStand(x, this.z)) this.x = x;
    if (canStand(this.x, z)) this.z = z;
  }

  get door() {
    return this.x < -0.3 ? CABIN_DOORS.find(z => Math.abs(this.z - z) <= 0.6) ?? null : null;
  }

  nearbySeat() {
    let nearest = null, distance = 1.06;
    for (const seat of CABIN_SEATS) {
      const d = Math.hypot(this.x - seat.x, this.z - seat.z);
      if (d < distance) { nearest = seat; distance = d; }
    }
    return nearest;
  }

  get action() {
    if (this.seat) return 'Vstát';
    if (this.door !== null) return 'Vystoupit';
    return this.nearbySeat() ? 'Sednout si' : null;
  }
}
