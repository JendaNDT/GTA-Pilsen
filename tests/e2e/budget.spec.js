import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';

const viewIds = ['namesti-den', 'lochotin', 'rokycany-pole'];
const budgetFile = new URL('../budgets.json', import.meta.url);

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

test('E13 – náměstí, Lochotín a Rokycany se vejdou do rozpočtu vykreslování', async ({ page, baseURL }) => {
  const update = process.env.UPDATE_BUDGETS === '1';
  const baseline = update ? null : JSON.parse(await readFile(budgetFile, 'utf8'));
  const measured = {};
  await openReferenceGame(page, baseURL);
  for (const id of viewIds) {
    const view = reference.views.find((entry) => entry.id === id);
    await test.step(view.name, async () => {
      const { calls, triangles } = await renderReferenceView(page, view);
      measured[id] = { calls, triangles };
      for (const [field, label] of [['calls', 'volání'], ['triangles', 'trojúhelníky']]) {
        const count = measured[id][field];
        expect(count, `${view.name}: ${label}`).toBeGreaterThan(0);
        if (update) continue;
        const budget = baseline[id]?.[field];
        expect(budget, `${view.name}: chybí rozpočet pro ${label}`).toBeGreaterThan(0);
        expect(count, `${view.name}: ${label} proti rozpočtu ${budget} (+10 %)`)
          .toBeLessThanOrEqual(Math.floor(budget * 1.1));
      }
    });
  }
  if (update) await writeFile(budgetFile, JSON.stringify(measured, null, 2) + '\n');
});
