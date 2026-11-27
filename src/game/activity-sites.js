export const ACTIVITY_COLOR = '#caa8fa';

export const ACTIVITY_SITES = [
  {
    id: 'skodaland-minigolf',
    x: -1599, z: 3583, y: 4.45,
    name: 'Škodaland',
    title: 'Škodaland · zkušební trasa',
    aliases: ['minigolf', 'V Lukách 34', 'V Lukách 2976/34', 'České údolí'],
    access: 'V Lukách 34 · příchod pěšky od zastávky U Přehrady. Minigolf je u pěšiny za příjezdovou cestou.',
    golf: { x: -1588, z: 3609.5, y: 5 },
    startLabel: 'Spustit zkušební trasu',
    returnPoint: { x: -1601, z: 3586, yaw: 2.55 },
    trial: {
      target: { x: -1582, z: 3603, y: 4.95 },
      path: [-1599, 3583, -1596, 3587, -1587.2, 3597.1, -1582, 3603],
    },
  },
  {
    id: 'papirny-bowling', bowling: true,
    x: 638, z: 1217, y: 2.89,
    name: 'Bowling U Papírny', title: 'Bowling U Papírny',
    aliases: ['bowling', 'kulečník', 'kulečník U Papírny', 'pool', 'Papírnická 3', 'U Papírny', 'kuželky'],
    access: 'Papírnická 3 · pěšky od Mikulášského náměstí. Ke kulečníku přejdeš od bowlingové dráhy.',
    startLabel: 'Zahrát bowling',
    returnPoint: { x: 638, z: 1217, yaw: -1.22 },
  },
  {
    id: 'lobzy-sportovni-terce', targets: true,
    x: 2874, z: 1142, y: -2.83,
    name: 'Sportovní terče v Lobzích', title: 'Sportovní terče v Lobzích',
    aliases: ['Lobzy', 'terče', 'sportovní terče', 'Ke Střelnici'],
    access: 'Pěšky po cestě u ulice Ke Střelnici. U fialové značky můžeš spustit volný trénink.',
    startLabel: 'Spustit trénink',
    returnPoint: { x: 2874, z: 1142, yaw: .96 },
  },
];

export function atActivityPoint(player, point, radius = 3.5) {
  return !player.swimming && Math.abs(player.y - point.y) < 1.5
    && Math.hypot(player.x - point.x, player.z - point.z) <= radius;
}
