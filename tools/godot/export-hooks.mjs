// Háčky Node.js pro převod mapy do Godotu.
// Při načtení src/world/chunks.js zpřístupní jeho interní funkce a místo kreslení pásů silnic
// a přerušovaných čar zapíše jejich parametry. Zdrojový kód původní hry zůstává beze změny.

const EXPORTS = `
export { buildTerrain, buildRoads, buildBuildings, buildTrees, buildLamps, buildTunnel, buildLandIndex,
  buildDensity, styleFor, insetRing, roadColor, roadHex, surfaceContext, pick,
  COL, HEX, LAND_HEX, LAND_GROUP, FIELD_COLORS, MEADOW_COLORS, FOREST_COLORS, ORTHOPHOTO_LAND, LIFT_MARK, LIFT_RAIL };
`;

const REPLACEMENTS = [
  [
    'function ribbon(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center, road) {',
    `function ribbon(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center, road) {
  if (globalThis.__plzRecorder) return globalThis.__plzRecorder.ribbon(buf, D, hw, col, lateral, lift, capStart, capEnd, center);
  return __ribbonDraw(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center, road);
}
function __ribbonDraw(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center, road) {`,
  ],
  [
    'function dashes(world, buf, D, hw, col, dash, gap, lateral, lift) {',
    `function dashes(world, buf, D, hw, col, dash, gap, lateral, lift) {
  if (globalThis.__plzRecorder) return globalThis.__plzRecorder.dashes(buf, D, hw, col, dash, gap, lateral, lift);
  return __dashesDraw(world, buf, D, hw, col, dash, gap, lateral, lift);
}
function __dashesDraw(world, buf, D, hw, col, dash, gap, lateral, lift) {`,
  ],
  [
    'const asphalt = QUALITY.roadDetail ? new RoadBuf() : new DecalBuf(), marks = new DecalBuf(), solid = new SolidBuf();',
    `const asphalt = QUALITY.roadDetail ? new RoadBuf() : new DecalBuf(), marks = new DecalBuf(), solid = new SolidBuf();
  asphalt.__layer = 'asphalt'; marks.__layer = 'marks';`,
  ],
];

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.endsWith('/src/world/chunks.js')) return result;
  let source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
  for (const [from, to] of REPLACEMENTS) {
    if (!source.includes(from)) {
      throw new Error('Převod do Godotu: v src/world/chunks.js chybí očekávaný řádek, upravte tools/godot/export-hooks.mjs:\n' + from);
    }
    source = source.replace(from, to);
  }
  return { ...result, source: source + EXPORTS, shortCircuit: true };
}
