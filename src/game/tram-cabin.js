// Rozměry prvního vozu soupravy Tatra v místních metrech. Čelo je ve směru +z.
export const PILOT_TRIP = '685462';
export const CABIN_DOORS = [6.02, 0.09, -5.96];
export const CABIN_SEATS = [-4.9, -3.85, -2.8, -1.75, 1.55, 2.6, 3.65, 4.7]
  .flatMap(z => [-0.81, 0.81].map(x => ({ x, z })));

export const ARTICULATED_TRIP = '685463';
export const BUS_TRIP = '688856';
export const TROLLEY_TRIP = '692185';

const tatraLayout = [{ doors: CABIN_DOORS, seats: CABIN_SEATS, min: -6.53, max: 6.48 }];
export const ARTICULATED_CABIN = [
  { length: 9.4, doors: [2.36, -3.25], rows: [-1.9, -0.85, 0.2, 1.25], min: -4.7, max: 3.05 },
  { length: 10.34, doors: [0], rows: [-3.6, -2.5, -1.4, 1.4, 2.5, 3.6], min: -5.17, max: 5.17 },
  { length: 9.4, doors: [3.25, -2.36], rows: [-1.25, -0.2, 0.85, 1.9], min: -3.05, max: 4.7 },
].map(section => ({ ...section, seats: section.rows.flatMap(z => [-0.81, 0.81].map(x => ({ x, z }))) }));

export const BUS_CABIN = [{
  length: 12, doors: [4.69, -0.63, -4.23], wheelWells: [3.3, -2.6], min: -5.1, max: 5.04,
  seats: [-3.07, -1.95, 0.63, 1.76, 2.94].flatMap(z => [-0.81, 0.81].map(x => ({ x, z }))),
}];

export const TROLLEY_CABIN = [{
  length: 11.8, doors: [3.9, -1.5], wheelWells: [2.52, -3.36], min: -5, max: 4.96,
  seats: [-4.35, -3.18, -0.25, 0.94, 2.19].flatMap(z => [-0.81, 0.81].map(x => ({ x, z }))),
}];

export const CABIN_SERVICES = [
  { trip: PILOT_TRIP, type: 'tram', ref: '1', layout: tatraLayout, stop: '54717/1',
    name: 'Průchozí tramvaj · linka 1', marker: '1 · Průchozí Tatra', aliases: ['Tatra'],
    access: 'První vůz spoje 685462 směr Bolevec. V pondělí 9. 11. 2026 odjezd v 10:06 ze stanoviště 1.' },
  { trip: ARTICULATED_TRIP, type: 'tram', ref: '1', layout: ARTICULATED_CABIN, stop: '54717/1',
    name: 'Článková tramvaj · linka 1', marker: '1 · Článková tramvaj', aliases: [],
    access: 'Tři průchozí články spoje 685463 směr Bolevec. V pondělí 9. 11. 2026 odjezd v 10:13 ze stanoviště 1.' },
  { trip: BUS_TRIP, type: 'bus', ref: '33', layout: BUS_CABIN, stop: '54717/4',
    name: 'Průchozí autobus · linka 33', marker: '33 · Průchozí autobus', aliases: ['SOR'],
    access: 'Spoj 688856 směr Hlavní nádraží. V pondělí 9. 11. 2026 odjezd v 8:20 ze stanoviště 4.' },
  { trip: TROLLEY_TRIP, type: 'trolleybus', ref: '49', layout: TROLLEY_CABIN, stop: '53408/1',
    name: 'Průchozí trolejbus · linka 49', marker: '49 · Průchozí trolejbus', aliases: [],
    access: 'Spoj 692185 směr Karlov. V pondělí 9. 11. 2026 odjezd v 8:26 ze stanoviště 1 u hlavního nádraží.' },
];

export function boardingDoor(across, along, doors = CABIN_DOORS) {
  if (across < 1.22 || across > 3.9) return null;
  return doors.find(z => Math.abs(z - along) <= 0.85) ?? null;
}

function canStand(section, x, z) {
  const atJoint = Math.abs(z) > (section.length ?? Infinity) / 2 - 0.75;
  return Math.abs(x) <= (atJoint ? 0.68 : 1.04) && z >= section.min && z <= section.max &&
    !(Math.abs(x) > 0.68 && section.wheelWells?.some(axle => Math.abs(z - axle) < 0.70)) &&
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
