import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

// Prešovská u náměstí: tramvajová kolej leží v sousední dlaždici než asfalt ulice.
const PRESOVSKA = [-104, 112.5];

async function buildAround(page, [x, z]) {
  return page.evaluate(async ([x, z]) => {
    const g = window.__game, { chunks } = g, w = g.world;
    g.player.place(x, z);
    for (let i = 0; i < 6000; i++) {
      const built = chunks.update(x, z, g.camera.far / 1.35, 40, w.groundY(x, z) + 2);
      if (!built && !chunks.pending && !w.structures?.loading) break;
      if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }, [x, z]);
}

/** Ploché povrchy v bodě: [druh, dlaždice] všech trojúhelníků asfaltu, které ho kryjí. */
async function asphaltLayers(page, [x, z]) {
  return page.evaluate(([x, z]) => {
    const g = window.__game, layers = [];
    for (const ch of g.chunks.chunks.values()) {
      const mesh = ch.asphalt;
      if (!mesh) continue;
      const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index, layout = mesh.geometry.attributes.roadLayout;
      for (let t = 0; t < idx.count; t += 3) {
        const [a, b, c] = [0, 1, 2].map((o) => idx.getX(t + o));
        const ax = pos.getX(a), az = pos.getZ(a), bx = pos.getX(b), bz = pos.getZ(b), cx = pos.getX(c), cz = pos.getZ(c);
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
        // asfalt ulice nese šířku vozovky; tramvajový pás a rohy ne
        layers.push([layout.getY(a) !== 0 ? 'ulice' : 'jiny pas', ch.ci]);
      }
    }
    return layers;
  }, [x, z]);
}

test('v Prešovské leží koleje v asfaltu ulice bez tramvajového pásu navrch', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const layersAt = async (extra) => {
    await page.goto(gameUrl(`/?debug&adapt=0&quality=medium&traffic=0&date=2026-11-09&hour=10${extra}`));
    await page.waitForFunction(() => window.__ready);
    await buildAround(page, PRESOVSKA);
    return asphaltLayers(page, PRESOVSKA);
  };
  // původně: přes asfalt ulice ležel tramvajový pás ze sousední dlaždice
  const original = await layersAt('&obraz=puvodni');
  expect(original.filter(([kind]) => kind === 'ulice').length, JSON.stringify(original)).toBeGreaterThan(0);
  const bed = original.find(([kind]) => kind === 'jiny pas'), road = original.find(([kind]) => kind === 'ulice');
  expect(bed, JSON.stringify(original)).toBeTruthy();
  expect(bed[1]).not.toBe(road[1]);
  const now = await layersAt('');
  expect(now.filter(([kind]) => kind === 'ulice').length, JSON.stringify(now)).toBeGreaterThan(0);
  expect(now.filter(([kind]) => kind !== 'ulice'), JSON.stringify(now)).toEqual([]);
  // koleje zůstávají
  const rails = await page.evaluate(([x, z]) => [...window.__game.chunks.chunks.values()].some((ch) => {
    const pos = ch.marks?.geometry.attributes.position;
    if (!pos) return false;
    for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i) - x, pos.getZ(i) - z) < 4) return true;
    return false;
  }), PRESOVSKA);
  expect(rails).toBe(true);
  // sousední dlaždice mají pevné pořadí asfaltu
  const orders = await page.evaluate(() => {
    const g = window.__game, cols = g.world.cols, byTile = new Map();
    for (const ch of g.chunks.chunks.values()) if (ch.asphalt) byTile.set(ch.ci, ch.asphalt.renderOrder);
    let pairs = 0, differ = 0;
    for (const [ci, order] of byTile) {
      for (const other of [ci + 1, ci + cols]) {
        if (!byTile.has(other) || (other === ci + 1 && (ci + 1) % cols === 0)) continue;
        pairs++;
        if (byTile.get(other) !== order) differ++;
      }
    }
    return { pairs, differ };
  });
  expect(orders.pairs).toBeGreaterThan(0);
  expect(orders.differ).toBe(orders.pairs);
  expect(errors).toEqual([]);
});

test('vysoká předvolba doostří obraz, filtruje zemi ostře a ?obraz=puvodni vrátí původní obraz', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const read = () => page.evaluate(() => {
    const g = window.__game;
    const tile = [...g.chunks.chunks.values()].find((ch) => ch.tex);
    return {
      sharpen: Boolean(g.postfx?.sharpen), antialias: g.postfx?.antialias,
      anisotropy: tile?.tex.anisotropy, max: g.renderer.getMaxAnisotropy(),
    };
  });
  await page.goto(gameUrl('/?debug&adapt=0&quality=high&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const now = await read();
  if (now.antialias === 'traa') expect(now.sharpen).toBe(true);
  expect(now.anisotropy).toBe(Math.min(16, now.max));
  await page.goto(gameUrl('/?debug&adapt=0&quality=high&view=350&date=2026-11-09&hour=10&obraz=puvodni'));
  await page.waitForFunction(() => window.__ready);
  const original = await read();
  expect(original.sharpen).toBe(false);
  expect(original.anisotropy).toBe(Math.min(4, original.max));
  expect(errors).toEqual([]);
});

test('nízká předvolba kreslí na počítači v plném rozlišení', async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => window.__game.renderer.getPixelRatio())).toBe(1);
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10&obraz=puvodni'));
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => window.__game.renderer.getPixelRatio())).toBe(0.75);
});
