import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { Parts } = await import('../src/entities/models.js');
const { ARM_INSET, CHARACTER_SHADING, HAIR_STYLES, ORIGINAL_CHARACTER, characterOcclusion, stylizedPart } = await import('../src/entities/character-shape.js');
const { parts } = await import('../src/physics/ragdoll.js');

const look = {
  skin: [0.8, 0.6, 0.5], hair: [0.1, 0.08, 0.06], shirt: [0.9, 0.6, 0.1], pants: [0.1, 0.12, 0.15],
  shoes: [0.9, 0.9, 0.9], sole: [0.2, 0.2, 0.2], hairStyle: 0, style: 1, shading: false,
};

function build(variant) {
  return parts.map((part) => ({ part, p: stylizedPart(new Parts(), part, { ...look, ...variant }) }));
}

test('stylizovaná postava je výchozí a původní kvádry vrátí jen ?postava=puvodni', () => {
  assert.equal(ORIGINAL_CHARACTER, false);
  assert.equal(HAIR_STYLES.length, 4);
});

test('každý díl má plochy otočené ven a leží v kvádru fyzikální postavy', () => {
  for (const style of [0, 1, 2, 3]) for (let hairStyle = 0; hairStyle < HAIR_STYLES.length; hairStyle++) {
    for (const { part, p } of build({ style, hairStyle })) {
      const P = p.p, N = p.n;
      assert.ok(P.length > 0, part.name);
      for (let i = 0; i < P.length; i += 9) {
        const a = P.slice(i, i + 3), b = P.slice(i + 3, i + 6), c = P.slice(i + 6, i + 9);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (Math.hypot(...n) < 1e-12) continue;
        const avg = [0, 1, 2].map((k) => N[i + k] + N[i + 3 + k] + N[i + 6 + k]);
        assert.ok(n[0] * avg[0] + n[1] * avg[1] + n[2] * avg[2] >= 0, `${part.name}: plocha otočená dovnitř`);
      }
      // vybočení: paže se posouvají k tělu o ARM_INSET, vlasy a boty smějí kvádr mírně přesáhnout
      const [w, h, d] = part.size;
      for (let i = 0; i < P.length; i += 3) {
        assert.ok(Math.abs(P[i]) <= w / 2 + ARM_INSET + 0.02, `${part.name} x ${P[i]}`);
        assert.ok(Math.abs(P[i + 1]) <= h / 2 + 0.09, `${part.name} y ${P[i + 1]}`);
        assert.ok(Math.abs(P[i + 2]) <= d / 2 + 0.12, `${part.name} z ${P[i + 2]}`);
      }
    }
  }
});

test('postava má nejvýš 1 800 trojúhelníků a paže leží u trupu', () => {
  let most = 0;
  for (const style of [0, 1, 2, 3]) for (let hairStyle = 0; hairStyle < HAIR_STYLES.length; hairStyle++) {
    const count = build({ style, hairStyle }).reduce((sum, { p }) => sum + p.p.length / 9, 0);
    most = Math.max(most, count);
  }
  assert.ok(most <= 1800, `${most} trojúhelníků`);
  // vnitřní okraj paže sahá k trupu (trup má v úrovni ramen poloviční šířku 0,212 m)
  const arm = build({ style: 1 }).find(({ part }) => part.name === 'paze1');
  let inner = Infinity;
  for (let i = 0; i < arm.p.p.length; i += 3) inner = Math.min(inner, arm.p.p[i] + arm.part.x);
  assert.ok(inner < 0.215, `vnitřní okraj paže ${inner}`);
});

test('obličej, vlasy a oblečení mají barvy postavy', () => {
  const colors = (variant, name) => {
    const { p } = build(variant).find(({ part }) => part.name === name);
    const set = new Set();
    for (let i = 0; i < p.c.length; i += 3) set.add(p.c.slice(i, i + 3).map((v) => v.toFixed(3)).join(','));
    return set;
  };
  const key = (rgb) => rgb.map((v) => v.toFixed(3)).join(',');
  const head = colors({}, 'hlava');
  assert.ok(head.has(key(look.skin)) && head.has(key(look.hair)), 'pleť a vlasy');
  assert.ok(head.size >= 4, 'oči, rty a obočí mají vlastní barvu');
  assert.ok(colors({}, 'hrudnik').has(key(look.shirt)));
  assert.ok(colors({}, 'lytko1').has(key(look.shoes)) && colors({}, 'lytko1').has(key(look.sole)));
  // krátký rukáv: holé předloktí, dlouhý rukáv: předloktí v barvě trička
  assert.ok(!colors({ style: 0 }, 'predlokti1').has(key(look.shirt)));
  assert.ok(colors({ style: 1 }, 'predlokti1').has(key(look.shirt)));
});

test('ramena se svažují ke krku a vršek paže nevyčnívá nad kloub ramene', () => {
  const built = build({ style: 1 });
  const world = (name) => {
    const { part, p } = built.find((entry) => entry.part.name === name);
    const out = [];
    for (let i = 0; i < p.p.length; i += 3) out.push([part.x + p.p[i], part.y + p.p[i + 1], p.p[i + 2]]);
    return { part, points: out };
  };
  // trup: nad 1,44 m (asi 3 cm pod krkem) je užší než 0,12 m od osy, v ramenou široký 0,18 m a víc
  const torso = world('hrudnik').points;
  const widthAbove = Math.max(...torso.filter(([, y]) => y >= 1.44).map(([x]) => Math.abs(x)));
  const widthChest = Math.max(...torso.filter(([, y]) => y > 1.3 && y < 1.36).map(([x]) => Math.abs(x)));
  assert.ok(widthAbove < 0.12, `trup u krku ${widthAbove}`);
  assert.ok(widthChest >= 0.18, `trup v ramenou ${widthChest}`);
  // paže: nejvyšší bod leží pod kloubem ramene a blíž k tělu než osa paže
  const { part: arm, points } = world('paze1');
  const top = points.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.ok(top[1] <= arm.joint[1], `vršek paže ${top[1]} nad kloubem ${arm.joint[1]}`);
  assert.ok(top[0] < arm.x - ARM_INSET, `vršek paže ${top[0]}`);
  // celková šířka ramen (vnější okraje paží) nejvýš 0,6 m
  const outer = Math.max(...points.map(([x]) => x));
  assert.ok(outer * 2 <= 0.6, `šířka ramen ${outer * 2}`);
});

test('stehna navazují na boky bez schodu a ruka má dlaň s prsty', () => {
  const built = build({ style: 1 });
  const extent = (name, pick) => {
    const { part, p } = built.find((entry) => entry.part.name === name);
    let best = -Infinity;
    for (let i = 0; i < p.p.length; i += 3) best = Math.max(best, pick(part.x + p.p[i], part.y + p.p[i + 1]));
    return best;
  };
  const hips = extent('panev', (x, y) => (y < 0.85 ? Math.abs(x) : -Infinity));
  const thigh = extent('stehno1', (x, y) => (y > 0.8 ? Math.abs(x) : -Infinity));
  assert.ok(thigh <= hips + 0.01, `stehno ${thigh} proti bokům ${hips}`);
  // ruka od zápěstí po konečky prstů aspoň 13 cm
  const { part, p } = built.find((entry) => entry.part.name === 'predlokti1');
  let low = Infinity;
  for (let i = 1; i < p.p.length; i += 3) low = Math.min(low, p.p[i]);
  assert.ok(-0.1 - low >= 0.13, `délka ruky ${-0.1 - low}`);
  assert.ok(low >= -part.size[1] / 2 - 0.09);
});

test('zastínění ztmaví podpaží, krk a vnitřní stranu stehen a jde vypnout', () => {
  assert.equal(CHARACTER_SHADING, true);
  // trup vpředu na hrudi skoro plně světlý, bok pod paží tmavší
  const chest = characterOcclusion('hrudnik', 0, 1.25, 0.13, 0, 0, 1);
  const armpit = characterOcclusion('hrudnik', 0.19, 1.3, 0, 1, 0, 0);
  assert.ok(chest > 0.95, `hruď ${chest}`);
  assert.ok(armpit < chest * 0.7, `podpaží ${armpit}`);
  // krk pod bradou, vnitřní strana stehna a paže, rozkrok
  assert.ok(characterOcclusion('hlava', 0, 1.55, -0.05, 0, 0, -1) < 0.75);
  assert.ok(characterOcclusion('stehno1', 0.05, 0.8, 0, -1, 0, 0) < characterOcclusion('stehno1', 0.2, 0.8, 0, 1, 0, 0) * 0.7);
  assert.ok(characterOcclusion('paze1', 0.18, 1.3, 0, -1, 0, 0) < 0.7);
  assert.ok(characterOcclusion('panev', 0, 0.82, 0, 0, -1, 0) < 0.55);
  // nikde příliš tmavé ani přesvětlené
  for (const name of ['hrudnik', 'paze1', 'stehno1', 'panev', 'hlava', 'lytko1']) {
    for (let y = 0; y <= 1.8; y += 0.1) for (const n of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]]) {
      const k = characterOcclusion(name, 0.15, y, 0, ...n);
      assert.ok(k >= 0.4 && k <= 1.1, `${name} ${y} ${k}`);
    }
  }
  // se zastíněním jsou barvy dílu tmavší nebo stejné, bez něj přesně barvy postavy
  for (const name of ['hrudnik', 'stehno1']) {
    const plain = build({ style: 1 }).find((entry) => entry.part.name === name).p.c;
    const shaded = build({ style: 1, shading: true }).find((entry) => entry.part.name === name).p.c;
    assert.equal(plain.length, shaded.length);
    let darker = 0;
    for (let i = 0; i < plain.length; i++) {
      assert.ok(shaded[i] <= Math.min(1, plain[i] * 1.1) + 1e-9);
      if (shaded[i] < plain[i] * 0.85) darker++;
    }
    assert.ok(darker > plain.length * 0.05, `${name}: ztmavených složek ${darker}`);
  }
});
