// Rozměry prvního vozu soupravy Tatra v místních metrech. Čelo je ve směru +z.
export const PILOT_TRIP = '685462';
export const CABIN_DOORS = [6.02, 0.09, -5.96];
export const CABIN_SEATS = [-4.9, -3.85, -2.8, -1.75, 1.55, 2.6, 3.65, 4.7]
  .flatMap(z => [-0.81, 0.81].map(x => ({ x, z })));

export const ARTICULATED_TRIP = '685463';

const tatraLayout = [{ doors: CABIN_DOORS, seats: CABIN_SEATS, min: -6.53, max: 6.48 }];
export const ARTICULATED_CABIN = [
  { length: 9.4, doors: [2.36, -3.25], rows: [-1.9, -0.85, 0.2, 1.25], min: -4.7, max: 3.05 },
  { length: 10.34, doors: [0], rows: [-3.6, -2.5, -1.4, 1.4, 2.5, 3.6], min: -5.17, max: 5.17 },
  { length: 9.4, doors: [3.25, -2.36], rows: [-1.25, -0.2, 0.85, 1.9], min: -3.05, max: 4.7 },
].map(section => ({ ...section, seats: section.rows.flatMap(z => [-0.81, 0.81].map(x => ({ x, z }))) }));

export function boardingDoor(across, along, doors = CABIN_DOORS) {
  if (across < 1.22 || across > 3.9) return null;
  return doors.find(z => Math.abs(z - along) <= 0.85) ?? null;
}

function canStand(section, x, z) {
  const atJoint = Math.abs(z) > (section.length ?? Infinity) / 2 - 0.75;
  return Math.abs(x) <= (atJoint ? 0.68 : 1.04) && z >= section.min && z <= section.max &&
    !section.seats.some(seat => Math.abs(x - seat.x) < 0.43 && Math.abs(z - seat.z) < 0.47);
}

export class TramCabin {
  constructor(door, platform, layout = tatraLayout, section = 0) {
    this.layout = layout;
    this.section = section;
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
    let z = this.z + (forward * cos + right * sin) * scale;
    const current = this.layout[this.section];
    if (canStand(current, x, this.z)) this.x = x;
    let index = this.section;
    if (z < current.min && index + 1 < this.layout.length) {
      index++;
      z += (current.length + this.layout[index].length) / 2;
    } else if (z > current.max && index > 0) {
      index--;
      z -= (current.length + this.layout[index].length) / 2;
    }
    if (canStand(this.layout[index], this.x, z)) {
      this.section = index;
      this.z = z;
    }
  }

  get door() {
    return this.x < -0.3 ? this.layout[this.section].doors.find(z => Math.abs(this.z - z) <= 0.6) ?? null : null;
  }

  nearbySeat() {
    let nearest = null, distance = 1.06;
    for (const seat of this.layout[this.section].seats) {
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
