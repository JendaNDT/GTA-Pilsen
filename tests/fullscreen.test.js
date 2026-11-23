import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enterFullscreen, exitFullscreen, fullscreenOnPlay, fullscreenSupported, isFullscreen, toggleFullscreen,
} from '../src/game/fullscreen.js';

/** Falešný dokument: standardní rozhraní, starší Safari (webkit) nebo prohlížeč bez celé obrazovky. */
function fakeDocument({ kind = 'standard', refuse = false } = {}) {
  const calls = [];
  const doc = { calls };
  const root = {};
  doc.documentElement = root;
  if (kind === 'standard') {
    doc.fullscreenEnabled = true;
    doc.fullscreenElement = null;
    root.requestFullscreen = async (options) => {
      calls.push(['request', options]);
      if (refuse) throw new Error('Permissions check failed');
      doc.fullscreenElement = root;
    };
    doc.exitFullscreen = async () => { calls.push(['exit']); doc.fullscreenElement = null; };
  } else if (kind === 'webkit') {
    doc.webkitFullscreenEnabled = true;
    doc.webkitFullscreenElement = null;
    root.webkitRequestFullscreen = async () => { calls.push(['webkit-request']); doc.webkitFullscreenElement = root; };
    doc.webkitExitFullscreen = async () => { calls.push(['webkit-exit']); doc.webkitFullscreenElement = null; };
  } else {
    doc.fullscreenEnabled = false;
  }
  return doc;
}

test('hra pozná, zda prohlížeč celou obrazovku umí', () => {
  assert.equal(fullscreenSupported(fakeDocument()), true);
  assert.equal(fullscreenSupported(fakeDocument({ kind: 'webkit' })), true);
  assert.equal(fullscreenSupported(fakeDocument({ kind: 'none' })), false);
  assert.equal(fullscreenSupported(undefined), false);
});

test('po kliknutí na Hrát se hra přepne na celou obrazovku a skryje lišty prohlížeče', async () => {
  const doc = fakeDocument();
  assert.equal(fullscreenOnPlay(true, doc), true);
  assert.equal(await enterFullscreen(doc), true);
  assert.deepEqual(doc.calls, [['request', { navigationUI: 'hide' }]]);
  assert.equal(isFullscreen(doc), true);
  // podruhé už o celou obrazovku nežádá
  assert.equal(fullscreenOnPlay(true, doc), false);
  assert.equal(await enterFullscreen(doc), false);
  assert.equal(doc.calls.length, 1);
});

test('volba v nastavení a nepodporovaný prohlížeč celou obrazovku nezapnou', () => {
  assert.equal(fullscreenOnPlay(false, fakeDocument()), false);
  assert.equal(fullscreenOnPlay(true, fakeDocument({ kind: 'none' })), false);
  // starší uložená hra bez této volby: výchozí je zapnuto
  assert.equal(fullscreenOnPlay(undefined, fakeDocument()), true);
});

test('odmítnutí prohlížeče hru nezastaví', async () => {
  const doc = fakeDocument({ refuse: true });
  assert.equal(await enterFullscreen(doc), false);
  assert.equal(isFullscreen(doc), false);
});

test('tlačítko ⛶ přepíná celou obrazovku tam i zpět, i ve starším Safari', async () => {
  for (const kind of ['standard', 'webkit']) {
    const doc = fakeDocument({ kind });
    await toggleFullscreen(doc);
    assert.equal(isFullscreen(doc), true, kind);
    await toggleFullscreen(doc);
    assert.equal(isFullscreen(doc), false, kind);
    assert.equal(await exitFullscreen(doc), false, 'mimo celou obrazovku není co ukončit');
  }
});
