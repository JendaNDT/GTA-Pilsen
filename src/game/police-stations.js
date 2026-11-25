// Venkovní herní místa návratu. Podklady a kontrola poloh jsou v docs/E46.md.
export const POLICE_STATIONS = [
  { name: 'Policie ČR – Plzeň-střed', x: 287, z: 184, yaw: -0.91 },
  { name: 'Policie ČR – Plzeň-Bory', x: -284, z: 1095, yaw: -1.06 },
  { name: 'Policie ČR – Plzeň-Skvrňany', x: -3122, z: 494, yaw: 0.17 },
  { name: 'Policie ČR – Plzeň-Vinice', x: -1735, z: -1392, yaw: -1.41 },
  { name: 'Policie ČR – Plzeň 1', x: -301, z: -3130, yaw: 1.15 },
  { name: 'Policie ČR – Plzeň 2', x: 1913, z: 2980, yaw: 1.13 },
  { name: 'Policie ČR – Plzeň 4', x: 3358, z: -1145, yaw: 2.06 },
  { name: 'Městská policie – Plzeň-Lochotín', x: -737, z: -2974, yaw: 2.65 },
  { name: 'Městská policie – Plzeň-Slovany', x: 1851, z: 1698, yaw: 0.12 },
  { name: 'Městská policie – Plzeň-střed', x: 184, z: -93, yaw: -1.66 },
  { name: 'Městská policie – Plzeň-Bory', x: -74, z: 2610, yaw: -1.28 },
  { name: 'Městská policie – Plzeň-Doubravka', x: 2472, z: 534, yaw: -0.21 },
  { name: 'Městská policie – Plzeň-Skvrňany', x: -3380, z: 432, yaw: -1.55 },
  { name: 'Městská policie – Plzeň-Vinice', x: -2044, z: -1493, yaw: 0.20 },
  { name: 'Městská policie – Plzeň-Radčice', x: -3722, z: -1676, yaw: -1.16 },
  { name: 'Policie ČR – Rokycany', x: 15787, z: 819, yaw: 2.94 },
  { name: 'Městská policie – Rokycany, radnice', x: 15703, z: 598, yaw: 2.70 },
  { name: 'Policie ČR – Hrádek', x: 19530, z: 4088, yaw: -0.54 },
  { name: 'Městská policie – Hrádek', x: 19510, z: 4141, yaw: 2.34 },
  { name: 'Policie ČR – Starý Plzenec', x: 7211, z: 5574, yaw: 2.62 },
  { name: 'Policie ČR – Třemošná', x: 1268, z: -7186, yaw: -1.36 },
  { name: 'Policie ČR – Chrást', x: 8379, z: -5217, yaw: 1.34 },
  { name: 'Městská policie – Horní Bříza', x: -1475, z: -10422, yaw: -2.55 },
  { name: 'Městská policie – Plzeň, celoměstská služebna', x: 2954, z: -796, yaw: 1.77 },
  { name: 'Městská policie – Plzeň, hlavní nádraží', x: 721, z: 485, yaw: 2.03 },
];

export const BORY_RELEASE = { name: 'Věznice Bory', x: -1200, z: 2779, yaw: -2.06 };

export function arrestDestination(position, serious) {
  if (serious) return BORY_RELEASE;
  let nearest;
  let distance = Infinity;
  for (const station of POLICE_STATIONS) {
    const squared = (station.x - position.x) ** 2 + (station.z - position.z) ** 2;
    if (squared < distance) {
      nearest = station;
      distance = squared;
    }
  }
  return nearest;
}
