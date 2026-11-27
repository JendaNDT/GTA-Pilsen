import shops from './pizza-routes.json' with { type: 'json' };

export const PIZZERIAS = shops;

export function pizzaOrder(shop, order) {
  const { label, park, drop, metres } = order;
  const reward = 100 + Math.round(Math.max(0, metres - 250) / 100) * 5;
  const bonus = Math.round(reward * .4 / 5) * 5;
  const limit = Math.max(120, Math.ceil((35 + metres / 3.2) / 15) * 15);
  return { name: shop.name, pick: shop.pick, bike: shop.bike, label,
    park: { ...park, label: 'Místo k sesednutí · ' + label }, drop: { ...drop, label }, metres, reward, bonus, limit };
}
