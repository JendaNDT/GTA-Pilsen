// Přístupné body před fasádami Rud’s Pizza a domu Prokopova 25.
export const PIZZA = {
  name: 'Rud’s Pizza · Prokopova',
  pick: { x: 104.7, z: 434 },
  bike: { x: 104.2, z: 439, yaw: 0 },
  park: { x: 118.2, z: 574, label: 'Místo k sesednutí · Prokopova' },
  drop: { x: 120.4, z: 586, label: 'Prokopova 25' },
  label: 'Prokopova 25', reward: 100, bonus: 40, limit: 120,
};

export function atPizzaDoor(player, point, world) {
  return !player.swimming && Math.hypot(player.x - point.x, player.z - point.z) <= 2 &&
    Math.abs(player.y - world.groundY(point.x, point.z)) < 1.5 &&
    !world.onCarriageway(player.x, player.z, player.y);
}

export function pizzaResult(job) {
  const bonus = job.time >= 0 ? job.bonus : 0;
  return { type: 'pizza', state: 'paid', amount: job.reward + bonus,
    note: `${job.reward} Kč za předání + ${bonus} Kč za čas` };
}
