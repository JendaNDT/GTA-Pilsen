// Sestaví kandidáta z uložených metadat GBFS a zkoušky přístupu v místním sestavení hry.
// Použití: node tools/import_bike_stations.mjs <stanoviste.json> <system.json> <url hry> <výstup.json>
import { chromium } from '@playwright/test';
import { readFile, rename, writeFile } from 'node:fs/promises';

const [stationPath, systemPath, origin, outputPath] = process.argv.slice(2);
if (!stationPath || !systemPath || !origin || !outputPath) {
  throw new Error('Zadej snímek seznamu, metadata systému, adresu místní hry a výstupní JSON.');
}
const url = new URL(origin);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Měření patří do místního sestavení.');
url.searchParams.set('debug', '');
url.searchParams.set('quality', 'low');
url.searchParams.set('adapt', '0');
url.searchParams.set('weather', 'clear');

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const [feed, system] = await Promise.all([readJSON(stationPath), readJSON(systemPath)]);
if (feed.version !== '3.0' || system.version !== '3.0' ||
    !system.data?.name?.some(name => name.language === 'cs' && name.text === 'Pilsen Bike') ||
    !Number.isFinite(Date.parse(feed.last_updated)) || !Array.isArray(feed.data?.stations) || !feed.data.stations.length) {
  throw new Error('Nečekaný formát zdroje Pilsen Bike.');
}
// Nevyplněná pole znamenají podle GBFS 3.0 výchozí CC0. Jiné podmínky se musí znovu posoudit.
const license = system.data.license_id || (system.data.license_url ? null : 'CC0-1.0');
if (!['CC0-1.0', 'CC-BY-4.0'].includes(license)) throw new Error('Zdroj má jiné podmínky použití než dosavadní vrstva.');
const ids = new Set();
const stations = feed.data.stations.map(row => {
  const station = {
    id: row.station_id, name: row.name?.find(name => name.language === 'cs')?.text,
    lat: row.lat, lon: row.lon, capacity: row.capacity, radius: row.radius,
  };
  if (typeof station.id !== 'string' || !/^\d+$/.test(station.id) || ids.has(station.id) ||
      typeof station.name !== 'string' || !station.name.trim() ||
      !Number.isFinite(station.lat) || station.lat < 49.6 || station.lat > 49.9 ||
      !Number.isFinite(station.lon) || station.lon < 13.15 || station.lon > 13.6 ||
      !Number.isSafeInteger(station.capacity) || station.capacity < 1 ||
      !Number.isFinite(station.radius) || station.radius < 4) throw new Error('Neplatné stanoviště: ' + station.name);
  ids.add(station.id);
  return station;
}).sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }) || a.id.localeCompare(b.id));

const browser = await chromium.launch({
  channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
try {
  const page = await browser.newPage();
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  const placements = [];
  const rejected = [];
  for (const station of stations) {
    const placement = await page.evaluate(station => {
      const { world: w, player: p, colliders } = window.__game;
      const source = w.gpsToWorld(station.lat, station.lon);
      const referenceY = w.heightAt(source.x, source.z);
      const { x: ox, z: oz } = source;
      const ground = (x, z) => w.groundY(x, z, referenceY + 1.8);
      const onDryGround = (x, z, y, radius, pavement) =>
        x > w.playMinX + 21 && x < w.playMaxX - 21 && z > w.playMinZ + 21 && z < w.playMaxZ - 21 &&
        !w.isWater(x, z) && !w.collideCircle(x, z, radius, y + .035, y + 1.75) &&
        (!pavement || !w.onCarriageway(x, z, y, radius * .65));
      for (let i = 0; i < 25; i++) colliders.update(ox, oz);
      const placePlayer = (x, z) => {
        const y = colliders.exitHeight(x, z, ground(x, z));
        p.place(x, z, y);
        p.setWalking(true);
        p.character.place(x, y, z);
      };
      const canMove = (startX, startZ, endX, endZ, curbHeight) => {
        placePlayer(startX, startZ);
        const movement = 1.8, dt = 1 / 60;
        for (let i = 0; i < 185; i++) {
          const dx = endX - p.x, dz = endZ - p.z, distance = Math.hypot(dx, dz);
          if (distance < .25 && p.grounded) return true;
          const speed = Math.min(movement, distance / dt);
          p.vx = speed * dx / Math.max(.001, distance);
          p.vz = speed * dz / Math.max(.001, distance);
          p.character.move(dt, p, false, curbHeight);
        }
        return false;
      };
      const round = n => Math.round(n * 1000) / 1000;
      const offsets = [[0, 0]];
      for (let radius = 1; radius <= Math.min(station.radius - 3, 28); radius++) {
        const steps = Math.ceil(Math.PI * radius * 1.4);
        for (let k = 0; k < steps; k++) {
          const a = k / steps * Math.PI * 2;
          offsets.push([radius * Math.cos(a), radius * Math.sin(a)]);
        }
      }
      const pilotYaw = station.id === '43' ? Math.PI * .52 : station.id === '57' ? -.11 : null;
      for (const [dx, dz] of offsets) {
        const x = ox + round(dx), z = oz + round(dz), y = ground(x, z);
        if (!onDryGround(x, z, y, .53, true)) continue;
        const road = w.nearestRoad(x, z, 30, 99, 0, {}, y);
        const along = road ? Math.atan2(road.dx, road.dz) : 0;
        const yawOptions = [along, along + Math.PI];
        for (let i = 1; i < 8; i++) yawOptions.push(along + i * Math.PI / 4);
        if (pilotYaw !== null) yawOptions.unshift(pilotYaw);
        for (let yaw of yawOptions) {
          const preservePilotYaw = pilotYaw !== null && yaw === pilotYaw && dx === 0 && dz === 0;
          if (!preservePilotYaw) yaw = round(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
          const fx = Math.sin(yaw), fz = Math.cos(yaw), nx = Math.cos(yaw), nz = -Math.sin(yaw);
          const sideIsFree = side => {
            const sx = x + nx * side, sz = z + nz * side, sy = ground(sx, sz);
            return Math.abs(sy - y) < .32 && onDryGround(sx, sz, sy, .38, true);
          };
          const parkingIsFree = side => sideIsFree(side) && [-.58, .58].every(offset => {
            const px = x + nx * side + fx * offset, pz = z + nz * side + fz * offset;
            const py = ground(px, pz);
            return Math.abs(py - y) < .35 && onDryGround(px, pz, py, .24, true);
          });
          if (!sideIsFree(.72) && !sideIsFree(-.72)) continue;
          if (!parkingIsFree(-.45)) continue;
          const signSide = [1, -1].find(side => {
            const sx = x + nx * 1.45 * side, sz = z + nz * 1.45 * side, sy = ground(sx, sz);
            return Math.abs(sy - y) < .5 && onDryGround(sx, sz, sy, .23, true);
          });
          if (!signSide) continue;
          let valid = true;
          // Místní nájezd a výjezd k nejbližšímu volnému povrchu. Kontrola předního kola přesahuje střed kola.
          for (let metres = .25; metres <= 4.5; metres += .25) {
            const px = x + fx * metres, pz = z + fz * metres, py = ground(px, pz);
            if (Math.abs(py - y) > .23 * metres + .07 || !onDryGround(px, pz, py, .38, false) ||
                w.collideCircle(px + fx * .62, pz + fz * .62, .26, py + .2, py + 1.35)) {
              valid = false; break;
            }
          }
          if (!valid) continue;
          const ex = x + fx * 4.5, ez = z + fz * 4.5;
          if (!canMove(ex, ez, x, z, .35) || !canMove(x, z, ex, ez, .16) || !canMove(ex, ez, x, z, .16)) continue;
          // Zkouška vrácení skončí stabilně na vhodné výšce mimo jízdní pruh.
          if (w.onCarriageway(p.x, p.z, p.y)) continue;
          return { dx: round(dx), dz: round(dz), yaw, signSide, parking: signSide === 1 && parkingIsFree(-1.12) ? 2 : 1 };
        }
      }
      return null;
    }, station);
    if (!placement) {
      rejected.push(station);
      console.error('Bez průchodu:', station.id, station.name);
      continue;
    }
    placements.push({ ...station, ...placement });
    if (placements.length % 30 === 0) console.log('Ověřeno:', placements.length, '/', stations.length);
  }
  if (rejected.length) throw new Error('Stanoviště bez ověřeného přístupu: ' + rejected.map(station => station.id).join(', '));
  const document = { source: 'Pilsen Bike (PMDP / Freebike, GBFS 3.0)', retrieved: feed.last_updated, license, stations: placements };
  const temp = outputPath + '.' + process.pid + '.tmp';
  await writeFile(temp, JSON.stringify(document, null, 2) + '\n');
  await rename(temp, outputPath);
  console.log('Uloženo:', placements.length, '/', stations.length);
} finally {
  await browser.close();
}
