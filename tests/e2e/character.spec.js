import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E19 – vystoupení na mostě, v tunelu a po přistání na střeše', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const results = await page.evaluate(() => {
    const g = window.__game, w = g.world, player = g.player, car = player.lastCar;
    const walk = (dx, dz) => {
      const x = player.x, z = player.z, y = player.y;
      for (let i = 0; i < 70; i++) player.update(1 / 60, dx, dz, false, false);
      return { distance: Math.hypot(player.x - x, player.z - z), heightChange: player.y - y,
        grounded: player.grounded, height: player.y, mode: g.mode };
    };
    const road = [...w.archedBridges.keys()].find(i => w.roadNames[w.r.name[i]] === 'Wilsonův most');
    const k = w.rOff[road], end = w.rOff[road + 1] - 1;
    const bridge = { x: (w.rpx[k] + w.rpx[end]) / 2, z: (w.rpz[k] + w.rpz[end]) / 2,
      y: (w.rpy[k] + w.rpy[end]) / 2 };
    const tube = w.tunnels[0], mid = Math.floor(tube.points.length / 2);
    const results = [];
    for (const [spot, dx, dz] of [
      [bridge, w.rpx[end] - w.rpx[k], w.rpz[end] - w.rpz[k]],
      [tube.points[mid], tube.points[mid + 1].x - tube.points[mid].x, tube.points[mid + 1].z - tube.points[mid].z],
    ]) {
      const length = Math.hypot(dx, dz);
      car.place(spot.x, spot.z, Math.atan2(dx, dz), spot.y);
      g._enterCar(car);
      const seated = !player.character;
      g.doAction();
      results.push({ seated, expected: spot.y, ...walk(dx / length, dz / length) });
    }

    // Mimo měřený střed zvolíme velkou plochou střechu se stejnou výškou
    // pod vrtulníkem, vedle dveří i na konci krátké pěší trasy.
    for (let i = 0; i < w.bCount; i++) {
      const x = (w.bMinX[i] + w.bMaxX[i]) / 2, z = (w.bMinZ[i] + w.bMaxZ[i]) / 2;
      if (w.bTop[i] - w.heightAt(x, z) < 6 || g.colliders.replaced.has(i)) continue;
      if (![0, 2.2, 5.2].every(offset => w.buildingAt(x + offset, z) === i)) continue;
      const h = g.helis[0];
      g._enterHeli(h);
      const seated = !player.character;
      h.x = x; h.z = z; h.y = w.bTop[i] + 0.3; h.yaw = 0; h.vy = -1;
      for (let j = 0; j < 120 && (j === 0 || !h.landed); j++) h.update(1 / 60, 0, 0, -1);
      g.doAction();
      results.push({ seated, landed: h.landed, expected: w.bTop[i], ...walk(1, 0) });
      break;
    }
    return results;
  });
  expect(results).toHaveLength(3);
  expect(results[2].landed).toBe(true);
  for (const sample of results) {
    expect(sample.seated).toBe(true);
    expect(sample.mode).toBe('foot');
    expect(sample.grounded, JSON.stringify(sample)).toBe(true);
    expect(sample.distance).toBeGreaterThan(2);
    expect(Math.abs(sample.height - sample.expected), JSON.stringify(sample)).toBeLessThan(0.35);
  }
});

const historical = [[19, 0], [3070, 0]];
const otherBridges = [[4074, 1], [341, 0], [344, 0], [499, 0], [496, 0], [3445, 0], [4166, 0],
  [64, 0], [363, 0], [17658, 0], [31, 0], [253, 0], [2085, 0], [21571, 0], [665, 0], [2450, 0, 0.75],
  [9670, 0], [1839, 0]];

async function runAtEdges(page, bridges) {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  return page.evaluate((bridges) => {
    const { world: w, player, colliders } = __game;
    const results = [];
    for (const [road, segment, fraction = 0.5] of bridges) {
      const k = w.rOff[road] + segment;
      const x = w.rpx[k] + fraction * (w.rpx[k + 1] - w.rpx[k]);
      const z = w.rpz[k] + fraction * (w.rpz[k + 1] - w.rpz[k]);
      const y = w.rpy[k] + fraction * (w.rpy[k + 1] - w.rpy[k]);
      const dx = w.rpx[k + 1] - w.rpx[k], dz = w.rpz[k + 1] - w.rpz[k], length = Math.hypot(dx, dz);
      const nx = -dz / length, nz = dx / length;
      for (let j = 0; j < 25; j++) colliders.update(x, z);
      for (const side of [-1, 1]) {
        player.place(x, z, y);
        let ux = nx * side, uz = nz * side, pressed = 0;
        for (let j = 0; j < 720 && pressed < 120; j++) {
          player.update(1 / 60, ux, uz, true, false);
          const contacts = player.character.character.GetActiveContacts();
          for (let i = 0; i < contacts.size(); i++) {
            const hit = contacts.at(i), normal = hit.mSurfaceNormal;
            if (hit.mUserData !== 3 || !hit.mHadCollision || Math.abs(normal.GetY()) > 0.1) continue;
            // Po doběhnutí tlač dvě sekundy přímo proti místnímu zábradlí.
            // Šikmá hrana navádí běžce podél mostu až k volnému nájezdu.
            if (normal.GetX() * ux + normal.GetZ() * uz > -0.3) continue;
            ux = -normal.GetX(); uz = -normal.GetZ(); pressed++;
            break;
          }
        }
        // Po uvolnění směru se kapsle po styku s hranou schodu může usadit.
        for (let j = 0; j < 60; j++) player.update(1 / 60, 0, 0, false, false);
        const alongNormal = (player.x - x) * nx + (player.z - z) * nz;
        const deck = w.deckAt(player.x, player.z, y + 0.7);
        // Na sdílené ploše může být vnější hrana až za sousední vozovkou.
        // U měřených vystupujících říms porovnáme kapsli s vnitřní stěnou chodníku.
        let gap = Infinity;
        for (const tile of colliders.tiles.keys()) for (const edge of w.bridgeEdges.get(tile) ?? []) {
          const a = edge.corners[edge.measured ? 3 : 0], b = edge.corners[edge.measured ? 2 : 1], sx = b[0] - a[0], sz = b[2] - a[2], len = Math.hypot(sx, sz);
          const t = ((player.x - a[0]) * sx + (player.z - a[2]) * sz) / (len * len);
          if (t < 0 || t > 1 || Math.abs(a[1] + t * (b[1] - a[1]) - deck) > 0.5) continue;
          const signed = ((player.x - a[0]) * sz - (player.z - a[2]) * sx) / len;
          if (Math.abs(signed) < Math.abs(gap)) gap = signed;
        }
        results.push({ road, side, gap, measured: w.deckCalibrations.has(road), pressed, travel: alongNormal * side,
          grounded: player.grounded, height: player.y - deck, stone: w.archedBridges.has(road) });
      }
    }
    return results;
  }, bridges);
}

test('E19 – kamenné ohrazení zastaví běžce na obou stranách Švédského i Wilsonova mostu', { tag: '@webgpu' }, async ({ page }) => {
  const samples = await runAtEdges(page, historical);
  expect(samples).toHaveLength(4);
  for (const s of samples) {
    expect(s.stone).toBe(true);
    expect(s.pressed, JSON.stringify(s)).toBe(120);
    expect(s.grounded, JSON.stringify(s)).toBe(true);
    expect(Math.abs(s.height)).toBeLessThan(0.15);
    expect(s.gap, JSON.stringify(s)).toBeGreaterThan(s.measured ? 0.32 : 0.7);
    expect(s.gap, JSON.stringify(s)).toBeLessThan(s.measured ? 0.45 : 1.05);
  }
});

test('E19 – zábradlí na silničních mostech a lávkách včetně Rondelu', { tag: '@webgpu' }, async ({ page }) => {
  const samples = await runAtEdges(page, otherBridges);
  expect(samples).toHaveLength(36);
  for (const s of samples) {
    expect(s.pressed, JSON.stringify(s)).toBe(120);
    expect(s.grounded, JSON.stringify(s)).toBe(true);
    expect(Math.abs(s.height), JSON.stringify(s)).toBeLessThan(0.35);
    expect(s.gap, JSON.stringify(s)).toBeGreaterThan(0);
    expect(s.gap, JSON.stringify(s)).toBeLessThan(1.2);
    if (s.road === 2450 && s.side === 1) expect(s.travel).toBeGreaterThan(15);
  }
});

test('E19 – po chodníku přes Wilsonův most a podél vozovky na Domažlické', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const results = await page.evaluate(() => {
    const { world: w, player, colliders } = __game;
    return [[19, 5.8], [2450, 0]].map(([road, offset]) => {
      const a = w.rOff[road], b = w.rOff[road + 1] - 1;
      const dx = w.rpx[b] - w.rpx[a], dz = w.rpz[b] - w.rpz[a], length = Math.hypot(dx, dz);
      const ux = dx / length, uz = dz / length;
      const x = w.rpx[a] - offset * uz + ux, z = w.rpz[a] + offset * ux + uz;
      for (let i = 0; i < 25; i++) colliders.update(x, z);
      player.place(x, z, w.rpy[a] + (w.rpy[b] - w.rpy[a]) / length);
      let progress = 0, drift = 0, swimming = false;
      for (let i = 0; i < 60 * length / 2 && progress < length - 2; i++) {
        player.update(1 / 60, ux, uz, false, false);
        progress = (player.x - x) * ux + (player.z - z) * uz;
        drift = Math.max(drift, Math.abs((player.x - x) * uz - (player.z - z) * ux));
        swimming ||= player.swimming;
      }
      return { road, progress, length, drift, swimming, grounded: player.grounded };
    });
  });
  for (const sample of results) {
    expect(sample.progress, JSON.stringify(sample)).toBeGreaterThanOrEqual(sample.length - 2);
    expect(sample.drift, JSON.stringify(sample)).toBeLessThan(0.35);
    expect(sample.swimming).toBe(false);
    expect(sample.grounded).toBe(true);
  }
});

test('E19 – hráč projde pod lávkou U Prazdroje a překoná šířku Wilsonova mostu spodem v řece', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const results = await page.evaluate(() => {
    const { world: w, player, colliders } = __game;
    const street = w.nearestRoad(657, 162, 5, 13, 0, {});
    const a = w.rOff[19], b = w.rOff[20] - 1;
    const dx = w.rpx[b] - w.rpx[a], dz = w.rpz[b] - w.rpz[a], length = Math.hypot(dx, dz);
    // Mimo středový pilíř, mezi oběma vnějšími líci mostu.
    const river = { x: w.rpx[a] + dx / 3, z: w.rpz[a] + dz / 3, dx: -dz / length, dz: dx / length };
    return [street, river].map(({ x, z, dx, dz }) => {
      for (let i = 0; i < 25; i++) colliders.update(x, z);
      player.place(x - 12 * dx, z - 12 * dz);
      let along = -12, terrainError = 0, swam = false;
      const deckHeight = w.deckAt(x, z, Infinity);
      let headroom = Infinity;
      for (let i = 0; i < 960 && along < 12; i++) {
        player.update(1 / 60, dx, dz, false, false);
        along = (player.x - x) * dx + (player.z - z) * dz;
        swam ||= player.swimming;
        terrainError = Math.max(terrainError, Math.abs(player.y - w.heightAt(player.x, player.z)));
        if (Math.abs(along) < 1) headroom = Math.min(headroom, deckHeight - player.y);
      }
      return { along, terrainError, swam, headroom };
    });
  });
  for (const sample of results) {
    expect(sample.along, JSON.stringify(sample)).toBeGreaterThanOrEqual(12);
    expect(sample.terrainError, JSON.stringify(sample)).toBeLessThan(0.35);
    expect(sample.headroom, JSON.stringify(sample)).toBeGreaterThan(1.8);
    expect(Number.isFinite(sample.headroom)).toBe(true);
  }
  expect(results[0].swam).toBe(false);
  expect(results[1].swam).toBe(true);
});
