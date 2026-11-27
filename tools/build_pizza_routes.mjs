// Spuštění z kořene projektu: node tools/build_pizza_routes.mjs data-raw/kandidat/pizza-routes.json
import { readFile, writeFile } from 'node:fs/promises';
import { installShim } from './godot/node-shim.mjs';

installShim();
globalThis.fetch = async url => {
  try { return new Response(await readFile('public/' + String(url).replace(/^\/+/, '').split('?')[0])); }
  catch { return new Response(null, { status: 404 }); }
};
const { loadAll, parsePack } = await import('../src/data.js');
const { World } = await import('../src/world/world.js');
const { RC, RF } = await import('../src/config.js');
const { CycleNetwork } = await import('../src/world/cycle-network.js');
const { canJoin } = await import('../src/world/walking-map.js');
const { PIZZA } = await import('../src/game/pizza.js');
const { BikeGuide } = await import('../src/game/bike-guide.js');
const w = new World(await loadAll(() => {}));
const bytes = await readFile('public/data/cycle-network.bin');
const net = new CycleNetwork(parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
if (net.pack.header.osmTimestamp !== w.meta.osmTimestamp) throw Error('Cyklistická síť a adresy mají různé stáří.');
function finish(generator) {
  let step;
  do { step = generator.next(); } while (!step.done);
  return step.value;
}
finish(net.prepare());
const guide = new BikeGuide(w);
guide.network = net;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function point(x, z) {
  x = Math.round(x * 10) / 10;
  z = Math.round(z * 10) / 10;
  return { x, z, y: +w.groundY(x, z).toFixed(3) };
}
function clear(p) {
  const [west, north, east, south] = net.pack.header.bounds;
  return p.x >= west && p.x <= east && p.z >= north && p.z <= south && !w.isWater(p.x, p.z) &&
    !w.onCarriageway(p.x, p.z, p.y, .35) && !w.collideCircle(p.x, p.z, .55, p.y + .05, p.y + 1.8);
}

// Od veřejné ulice směrem k adresnímu bodu. U zastavěného bodu se zastavíme před fasádou.
function entrance(x, z) {
  const r = w.nearestRoad(x, z, 60, RC.SERVICE, RC.SECONDARY, {}, undefined, true);
  if (!r || w.r.flags[r.road] & (RF.TUNNEL | RF.BRIDGE | RF.ROUNDABOUT)) return null;
  const side = (x - r.x) * r.dz - (z - r.z) * r.dx >= 0 ? 1 : -1;
  const nx = side * r.dz, nz = -side * r.dx, half = w.r.w[r.road] / 2;
  const street = w.meta.roadNames[w.r.name[r.road]] || '';
  for (const shift of [0, 3, -3, 6, -6, 10, -10]) {
    const cx = r.x + shift * r.dx, cz = r.z + shift * r.dz;
    const curb = point(cx + nx * (half + 1.25), cz + nz * (half + 1.25));
    if (!clear(curb)) continue;
    const d = Math.hypot(x - curb.x, z - curb.z);
    let door = curb;
    for (let m = 1; m <= d; m++) {
      const next = point(curb.x + (x - curb.x) * m / d, curb.z + (z - curb.z) * m / d);
      if (!clear(next) || !canJoin(w, door, next)) break;
      door = next;
    }
    if (Math.hypot(door.x - x, door.z - z) > 20) continue;
    for (const along of [5, -5, 8, -8]) {
      const park = point(curb.x + r.dx * along, curb.z + r.dz * along);
      if (distance(park, door) < 3 || !clear(park) || !canJoin(w, park, door)) continue;
      if (!net.candidates(park, (p,c,l) => guide.connect(p,c,l)).length) continue;
      return { door, park, street, yaw: Math.atan2(r.dx, r.dz) };
    }
  }
  return null;
}

function locality(x, z) {
  const district = w.districtAt(x, z);
  const towns = w.meta.places.filter(p => p[3] === 'town' || p[3] === 'city');
  const nearest = towns.sort((a,b) => Math.hypot(x-a[0],z-a[1]) - Math.hypot(x-b[0],z-b[1]))[0];
  if (district === 'Střed' && nearest) return nearest[2] + ' – ' + district;
  return district;
}

const shops = [];
for (const [x,z,,name,cuisine] of w.meta.food) {
  if (!/pizz/i.test(name + ' ' + cuisine)) continue;
  if (x === 101 && z === 433.9) {
    shops.unshift({ name: PIZZA.name, pick: point(PIZZA.pick.x, PIZZA.pick.z), bike: { ...point(PIZZA.bike.x, PIZZA.bike.z), yaw: PIZZA.bike.yaw }, orders: [] });
    continue;
  }
  const site = entrance(x,z);
  if (!site || shops.some(s => distance(s.pick, site.door) < 4)) continue;
  const place = locality(x,z);
  shops.push({ name: [name, site.street, place].filter(Boolean).join(' · '), pick: site.door,
    bike: { ...site.park, yaw: +site.yaw.toFixed(3) }, orders: [] });
}
const addresses = w.meta.addresses.filter(a => w.meta.roadNames[a[2]] && /[1-9]/.test(a[3])).map(([x,z,street,number]) => ({
  x,z, label: w.meta.roadNames[street] + ' ' + number,
}));
const cache = new Map();
function routeLength(from, to) {
  const path = finish(guide.route(from, to, false));
  if (!path) return 0;
  let metres = 0;
  for (let i = 2; i < path.length; i += 2) metres += Math.hypot(path[i] - path[i-2], path[i+1] - path[i-1]);
  return Math.round(metres);
}
function offer(shop, address) {
  if (!cache.has(address)) cache.set(address, entrance(address.x, address.z));
  const site = cache.get(address);
  if (address.label === PIZZA.label && distance(address, PIZZA.drop) < 20) return false;
  if (!site || distance(site.park, shop.bike) < 120) return false;
  const area = locality(address.x, address.z);
  const label = [address.label, area].filter(Boolean).join(' · ');
  if (shop.orders.some(o => o.label === label)) return true;
  const metres = routeLength(shop.bike, site.park);
  if (!metres) return false;
  shop.orders.push({ label, park: site.park, drop: site.door, metres });
  return true;
}

// Každý podnik dostane místní objednávky a každá obydlená část mapy má vlastní kandidáty.
for (const shop of shops) {
  const near = [...addresses].sort((a,b) => distance(a,shop.pick) - distance(b,shop.pick));
  for (const a of near) {
    if (offer(shop,a) && shop.orders.length >= 3) break;
  }
}
const cells = new Map();
for (const a of addresses) {
  const key = Math.floor(a.x / 850) + '/' + Math.floor(a.z / 850);
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(a);
}
for (const candidates of cells.values()) {
  for (const a of candidates) {
    const near = [...shops].sort((s,t) => distance(s.pick,a) - distance(t.pick,a));
    if (near.some(shop => offer(shop,a))) break;
  }
}
// I městský výdej má vedle místních adres vyjížďky do vzdálenějších částí mapy.
const regional = [...cache.keys()].filter(a => cache.get(a));
for (const shop of shops) {
  for (const radius of [1500, 5000, 12000]) {
    const ranked = [...regional].sort((a,b) =>
      Math.abs(distance(shop.bike,a) - radius) - Math.abs(distance(shop.bike,b) - radius));
    ranked.some(a => offer(shop,a));
  }
}
for (const shop of shops) shop.orders.sort((a,b) => a.metres - b.metres);
const pilot = shops.find(shop => shop.name === PIZZA.name);
const park = point(PIZZA.park.x, PIZZA.park.z);
const metres = routeLength(pilot.bike, park);
if (!metres) throw Error('Chybí spojení pro původní trasu v Prokopově.');
pilot.orders.unshift({ label: PIZZA.label, park, drop: point(PIZZA.drop.x, PIZZA.drop.z), metres });
const ready = [pilot, ...shops.filter(s => s !== pilot && s.orders.length)
  .sort((a, b) => a.name.localeCompare(b.name, 'cs'))];
console.log(ready.length, 'výdejních míst,', ready.reduce((n,s) => n + s.orders.length, 0), 'spojení');
await writeFile(process.argv[2], '[\n' + ready.map(s => JSON.stringify(s)).join(',\n') + '\n]\n');
