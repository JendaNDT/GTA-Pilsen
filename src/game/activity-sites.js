export const ACTIVITY_COLOR = '#caa8fa';

export const ACTIVITY_SITES = [
  {
    id: 'skodaland-minigolf',
    x: -1596, z: 3587, y: 4.44,
    name: 'Škodaland',
    title: 'Škodaland · zkušební trasa',
    aliases: ['minigolf', 'V Lukách 34', 'V Lukách 2976/34', 'České údolí'],
    access: 'V Lukách 34 · příchod pěšky od zastávky U Přehrady.',
    startLabel: 'Spustit zkušební trasu',
    returnPoint: { x: -1592.5, z: 3591, yaw: -2.36 },
    trial: {
      target: { x: -1582, z: 3603, y: 4.95 },
      path: [-1596, 3587, -1587.2, 3597.1, -1582, 3603],
    },
  },
];

export function atActivityPoint(player, point, radius = 3.5) {
  return !player.swimming && Math.abs(player.y - point.y) < 1.5
    && Math.hypot(player.x - point.x, player.z - point.z) <= radius;
}
