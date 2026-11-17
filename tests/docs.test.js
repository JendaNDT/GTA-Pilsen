import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'dist', 'data-raw', 'test-results', 'playwright-report', '.venv']);

function markdownFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (name.endsWith('.md')) out.push(path);
  }
  return out;
}

/** Relativní odkazy z Markdownu mimo bloky kódu: [text](cíl) a ![obrázek](cíl). */
export function relativeLinks(markdown) {
  const text = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const links = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    links.push(decodeURIComponent(target.split('#')[0]));
  }
  return links;
}

test('odkazy mezi dokumenty vedou na existující soubory', () => {
  const broken = [];
  for (const file of markdownFiles(ROOT)) {
    for (const target of relativeLinks(readFileSync(file, 'utf8'))) {
      if (!existsSync(resolve(dirname(file), target))) broken.push(`${relative(ROOT, file)} → ${target}`);
    }
  }
  assert.deepEqual(broken, [], `Nefunkční odkazy:\n${broken.join('\n')}`);
});

test('kontrola odkazů pozná rozbitý odkaz a ignoruje kód a webové adresy', () => {
  const sample = [
    '[plán](docs/plan.md) a [web](https://example.com) a [kotva](#cast)',
    '`[ne](v-kodu.md)` a ![obrázek](docs/snimek%20mapy.png)',
    '```text\n[ne](v-bloku.md)\n```',
  ].join('\n');
  assert.deepEqual(relativeLinks(sample), ['docs/plan.md', 'docs/snimek mapy.png']);
});
