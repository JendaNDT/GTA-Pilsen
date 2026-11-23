import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const {
  decalOrder, detailFadeRange, FADE_END, FADE_START, groundAnisotropy, profilePixelRatio, temporalSharpness,
} = await import('../src/world/image-quality.js');
const { STONE_FADE, COARSE_FADE, SLOT_FADE } = await import('../src/world/asphalt.js');
const { GROUND_FINE_FADE, GROUND_MID_FADE, PAVING_FADE } = await import('../src/world/materials.js');
const {
  BRUSH_FADE, GRAIN_FADE, BLOCK_FADE, SEAM_FADE, PLANK_SEAM_FADE, SEAM_WIDTH, PLANK_SEAM_WIDTH,
} = await import('../src/world/building-nodes.js');
const { PROFILES } = await import('../src/game/graphics-quality.js');

test('jemný vzor zmizí dřív, než jeho buňka zabere méně než dva pixely', () => {
  assert.ok(FADE_START < FADE_END && FADE_END <= 0.5);
  for (const cell of [1 / 32, 0.14, 1, 3]) {
    const [start, end] = detailFadeRange(cell);
    assert.ok(start > 0 && start < end);
    assert.ok(end <= cell / 2 + 1e-12, `buňka ${cell} m musí zmizet nejpozději u pixelu ${cell / 2} m`);
  }
  // zrno asfaltu, šum země, dlažba a fasády (rozměr buňky v metrech nebo v jednotkách bloku)
  const layers = [
    ['jemné zrno asfaltu', STONE_FADE, 1 / 32], ['hrubé zrno asfaltu', COARSE_FADE, 1 / 8],
    ['mříže vpustí', SLOT_FADE, 1 / 13], ['jemný šum země', GROUND_FINE_FADE, 1 / 2.6],
    ['střední šum země', GROUND_MID_FADE, 1 / 0.33], ['dlažba náměstí', PAVING_FADE([4.8, 7]), 1 / 7],
    ['dlažba v Dobřívě', PAVING_FADE([3.6, 5.3]), 1 / 5.3], ['tahy štětce na omítce', BRUSH_FADE, 1 / 1.71],
    ['zrno omítky', GRAIN_FADE, 1 / 7.1], ['barva cihel a tašek', BLOCK_FADE, 1],
    ['spáry cihel a tašek', SEAM_FADE, SEAM_WIDTH], ['spáry prken', PLANK_SEAM_FADE, PLANK_SEAM_WIDTH],
  ];
  for (const [name, [start, end], cell] of layers) {
    assert.ok(start < end, name);
    assert.ok(end <= cell + 1e-12, `${name}: vzor zmizí nejpozději, když pixel dosáhne jeho šířky`);
  }
  // dřívější mizení asfaltového zrna (0,018 až 0,10 m) bylo pro buňku 3 cm pozdě
  assert.ok(0.10 > (1 / 32) / 2);
});

test('původní obraz pro porovnání vrátí dřívější mizení, filtrování a rozlišení', () => {
  assert.deepEqual(detailFadeRange(1 / 32, [0.018, 0.10], true), [0.018, 0.10]);
  assert.deepEqual(detailFadeRange(1 / 32, null, true), detailFadeRange(1 / 32, null, false));
  assert.equal(groundAnisotropy('ultra', 16, true), 4);
  assert.equal(profilePixelRatio(PROFILES.low.pixelRatio, false, true), 0.75);
  assert.equal(temporalSharpness(true), null);
});

test('textury země jsou v dálce ostřejší podle předvolby a nepřekročí možnosti grafiky', () => {
  assert.equal(groundAnisotropy('low', 16, false), 4);
  assert.equal(groundAnisotropy('medium', 16, false), 8);
  assert.equal(groundAnisotropy('high', 16, false), 16);
  assert.equal(groundAnisotropy('ultra', 16, false), 16);
  assert.equal(groundAnisotropy('ultra', 8, false), 8);
  assert.equal(groundAnisotropy('high', 0, false), 1);
});

test('nízká předvolba kreslí na počítači v plném rozlišení, na telefonu zůstává úsporná', () => {
  assert.equal(profilePixelRatio(PROFILES.low.pixelRatio, false, false), 1);
  assert.equal(profilePixelRatio(PROFILES.low.pixelRatio, true, false), PROFILES.low.pixelRatio);
  for (const name of ['medium', 'high', 'ultra']) {
    assert.equal(profilePixelRatio(PROFILES[name].pixelRatio, false, false), PROFILES[name].pixelRatio);
    assert.equal(profilePixelRatio(PROFILES[name].pixelRatio, true, false), PROFILES[name].pixelRatio);
  }
});

test('doostření po časovém vyhlazení je mírné', () => {
  const sharpness = temporalSharpness(false);
  // SharpenNode: 0 = nejostřejší, 2 = bez doostření
  assert.ok(sharpness > 0.2 && sharpness < 1);
});

test('sousední dlaždice mají pevné pořadí plochých povrchů a druhy povrchů se nepromíchají', () => {
  const cols = 7;
  for (let ci = 0; ci < cols * 5; ci++) {
    const right = ci % cols < cols - 1 ? ci + 1 : null, below = ci + cols;
    for (const other of [right, below]) {
      if (other === null) continue;
      assert.equal(Math.abs(decalOrder(14, ci, cols) - decalOrder(14, other, cols)), 0.5);
    }
    // asfalt vždy pod značením
    assert.ok(decalOrder(14, ci, cols) >= 14 && decalOrder(14, ci, cols) < 15);
    assert.ok(decalOrder(16, ci, cols) >= 16 && decalOrder(16, ci, cols) < 17);
  }
});
