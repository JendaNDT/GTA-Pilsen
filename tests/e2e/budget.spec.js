import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

const viewIds = ['namesti-den', 'lochotin', 'rokycany-pole'];
const budgetFile = new URL('../budgets-e17.json', import.meta.url);

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

for (const quality of ['ultra', 'high', 'medium', 'low']) {
  test(`E17 – předvolba ${quality} se vejde do rozpočtu vykreslování`, { tag: '@webgpu' }, async ({ page, baseURL }) => {
    const update = process.env.UPDATE_BUDGETS === '1';
    const all = JSON.parse(await readFile(budgetFile, 'utf8'));
    const baseline = all[quality];
    const measured = {};
    // Stejné počasí podle pevného data jako při měření pohledů nástrojem tools/reference_views.mjs.
    const url = new URL(gameUrl(baseURL, { weather: null }));
    url.searchParams.set('quality', quality);
    await openReferenceGame(page, url.href);
    for (const id of viewIds) {
      const view = reference.views.find((entry) => entry.id === id);
      await test.step(view.name, async () => {
        const { calls, triangles } = await renderReferenceView(page, view);
        measured[id] = { calls, triangles };
        for (const [field, label] of [['calls', 'volání'], ['triangles', 'trojúhelníky']]) {
          const count = measured[id][field];
          expect(count, `${view.name}: ${label}`).toBeGreaterThan(0);
          if (update) continue;
          const budget = baseline?.[id]?.[field];
          expect(budget, `${view.name}: chybí rozpočet pro ${label}`).toBeGreaterThan(0);
          expect(count, `${view.name}: ${label} proti rozpočtu ${budget} (+10 %)`)
            .toBeLessThanOrEqual(Math.floor(budget * 1.1));
        }
      });
    }
    if (update) await writeFile(budgetFile, JSON.stringify({ ...all, [quality]: measured }, null, 2) + '\n');
  });
}
