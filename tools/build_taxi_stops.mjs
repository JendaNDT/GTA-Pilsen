// Spuštění z kořene projektu: node tools/build_taxi_stops.mjs data-raw/kandidat/taxi-stops.json
import { readFile, writeFile } from 'node:fs/promises';
import { installShim } from './godot/node-shim.mjs';

installShim();
globalThis.fetch = async url => {
  try { return new Response(await readFile('public/' + String(url).replace(/^\/+/, '').split('?')[0])); }
  catch { return new Response(null, { status: 404 }); }
};
const { loadAll } = await import('../src/data.js');
const { World } = await import('../src/world/world.js');
const { roadVerge } = await import('../src/world/road-verge.js');
const { Districts } = await import('../src/world/districts.js');
const { sidewalkWidth } = await import('../src/world/sidewalks.js');
const { canJoin } = await import('../src/world/walking-map.js');
const { taxiStop, taxiRoute } = await import('../src/game/taxi.js');
const data = await loadAll(() => {});
const world = new World(data);
const verge = roadVerge(world, new Districts(data.heritage.districts));
world.sidewalks = Float32Array.from(verge, (v,i) => sidewalkWidth(world.r.cls[i], world.r.flags[i], v));
const places = world.meta.places.filter(([x,z]) => world.inBounds(x,z,35));
const addresses = world.meta.addresses.map(([x,z,i,n]) => ({ x, z, street: world.roadNames[i], number: n }));
const result = [];
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const point = (x,z) => ({ x, z, y: world.walkY(x,z) });
function stopAt(place, street, sidewalk) {
  return taxiStop(world, place, stop => {
    const { waiting, edge } = stop;
    if (waiting.x < world.playMinX + 10 || waiting.x > world.playMaxX - 10 ||
        waiting.z < world.playMinZ + 10 || waiting.z > world.playMaxZ - 10) return false;
    if (street && world.roadNames[world.r.name[world.eRoad[edge]]] !== street) return false;
    const outside = point(waiting.x, waiting.z);
    return (!sidewalk || Number.isFinite(world.sidewalkY(waiting.x,waiting.z))) &&
      !world.onCarriageway(waiting.x,waiting.z,outside.y,.25) && canJoin(world, point(stop.x,stop.z), outside);
  });
}
for (const [px,pz,area] of places) {
  const center = area === 'Plzeň' ? { x:124.2, z:555.1 } : { x:px, z:pz };
  const near = addresses.filter(a => a.street && a.number && distance(a,center) <= 500)
    .sort((a,b) => distance(a,center)-distance(b,center));
  // Bez čísla domu pojmenujeme zastavení podle sídla. Hledáme i v jeho přilehlých ulicích.
  const candidates = near.slice(0,50).map(a => ({ ...a, name: a.street + ' ' + a.number }));
  candidates.push({ ...center, name: area });
  for (const radius of [85,180,300]) {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      candidates.push({ x: px + radius * Math.sin(angle), z: pz + radius * Math.cos(angle), name: area });
    }
  }
  let stop;
  for (const sidewalk of area === 'Starý Plzenec' ? [true] : [true,false]) {
    for (const candidate of candidates) {
      const site = stopAt(candidate, candidate.street, sidewalk);
      if (!site || result.some(other => distance(other,site) < 15)) continue;
      if (result.length) {
        const trip = taxiRoute(world,result[0],site,world.edgeCount);
        if (!trip || !taxiRoute(world,site,result[0],world.edgeCount)) continue;
        if (area === 'Starý Plzenec' && trip.path.at(-1) === world.reverseEdge(site.edge)) continue;
      }
      stop = site;
      break;
    }
    if (stop) break;
  }
  if (!stop) continue;
  const { edge, along, x, z, label } = stop;
  result.push({ area, label, edge, along, x: +x.toFixed(2), z: +z.toFixed(2) });
}
const plzenec = result.find(r => r.area === 'Starý Plzenec');
if (result[0]?.area !== 'Plzeň' || !plzenec) throw Error('Chybí referenční spojení do Starého Plzence.');
console.log(result.length, 'stanovišť', result[0], plzenec);
await writeFile(process.argv[2], '[\n' + result.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
