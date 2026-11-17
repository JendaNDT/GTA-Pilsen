import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const local = realpathSync(require.resolve('../vendor/picomatch'));

test('Vite i jeho vyhledávání souborů načítají místně opravený picomatch', () => {
  const vite = createRequire(require.resolve('vite'));
  const tinyglobby = createRequire(vite.resolve('tinyglobby'));
  const fdir = createRequire(tinyglobby.resolve('fdir'));
  for (const loader of [require, vite, tinyglobby, fdir]) {
    assert.equal(realpathSync(loader.resolve('picomatch')), local);
  }
});

test('opravené hledání souborů zvládne rizikové opakované skupiny bez zaseknutí', () => {
  // Samostatný proces omezí dobu běhu i v případě návratu zranitelné závislosti.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const pm = require(process.argv[1]);
    for (const group of ['+(*)', '*(*)', '+(*a)', '*(*a)', '+(a*b)', '+([ab]*)']) {
      for (const pattern of [group + 'z', 'prefix' + group + 'z']) {
        const match = pm(pattern);
        assert.equal(match('prefix' + 'a'.repeat(128) + '!'), false);
      }
    }
  `, local], { timeout: 5000, stdio: 'pipe' });
});

test('běžné cesty, přípony, escapování a bezpečné skupiny zachovávají význam', () => {
  const pm = require('picomatch');
  const examples = [
    ['src/world/world.js', 'src/**/*.js', true],
    ['src/world/world.css', 'src/**/*.js', false],
    ['foo.js', '*.{js,css}', true],
    ['a.js', '*.@(js|css)', true],
    ['abab', '+(ab)', true],
    ['aaabbb', '+(*(a)|*(b))', true],
    ['a*a*', '+(a\\*)', true],
    ['***', '+([*])', true],
    ['a*b', '+("a*b")', true],
    ['abc', '+(*)c', true],
    ['my/folder (Work, Accts)', '*/*(W*, *)*', true],
    ['aaaz', '+(*a)z', true],
    ['.abc', '+(*)', true],
    ['x.abc', 'x+(*)', true],
    ['z', '*(a*b)z', true],
    ['abc', '+(*)', true],
  ];
  for (const [path, pattern, expected] of examples) {
    assert.equal(pm.isMatch(path, pattern), expected, `${path} · ${pattern}`);
  }
});
