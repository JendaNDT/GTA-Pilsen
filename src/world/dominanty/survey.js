// Rozsahy trojúhelníků odpovídají pouze těmto revizím zaměřených listů města.
export const sheets = {
  '640-128.bin': [
    'bc4dbbe4',
    [
      [1536, 2268, 'brewery'],
      [2298, 3015, 'brewery'],
      [3477, 4458, 'gate'],
    ],
  ],
  '896--384.bin': ['d670c93f', [[1227, 1839, 'waterTower']]],
  '-128-384.bin': ['2d86bdd7', [[4245, 5706, 'beseda']]],
  '384--384.bin': ['3a9260cf', [[57, 651, 'stand']]],
  '640--384.bin': ['33c2ddc4', [[0, 2127, 'stand']]],
  '-384-896.bin': ['933c2439', [[4875, 7218, 'church']]],
  '128-128.bin': [
    'a787e843',
    [
      [2169, 2661, 'market'],
      [13185, 15291, 'cloister'],
      [15291, 16401, 'friary'],
    ],
  ],
  '-1152-640.bin': ['d2d5b2e5', [[4257, 7194, 'factory']]],
  '-1152-896.bin': ['c591c67c', [[369, 1587, 'planetarium']]],
  '384-1152.bin': ['7866c0f3', [[4644, 7068, 'depot']]],
  '128-1152.bin': ['c6bb38cd', [[438, 654, 'workshop']]],
};

const styles = {
  brewery: ['brewery', 'tile', 3.4, 4.2, 305],
  beseda: ['beseda', 'metal', 3.3, 4.6, 313],
  church: ['church', 'tile', 6, 12, 329],
  market: ['market', 'tile', 5.5, 7, 307],
  cloister: ['cloister', 'tile', 4, 11, 309],
  friary: ['townchurch', 'tile', 4.4, 13, 309],
  factory: ['factory', 'metal', 6, 13, 326],
  planetarium: ['factory', 'metal', 5.8, 10.5, 326],
  depot: ['depot', 'metal', 6, 10, 306.5],
  workshop: ['factory', 'metal', 5, 9, 306.5],
  stand: ['depot', 'metal', 6, 6, 304],
  waterTower: ['brick', 'spire', 4, 6, 317],
};

// Město ukládá vrcholy každé stěny souvisle. Earcut může zahájit stěnu libovolným uchem.
// Jakmile mají všechny další trojúhelníky vyšší čísla vrcholů, začíná nový stavební líc.
function faceRanges(indices, start, end) {
  const next = new Uint32Array((end - start) / 3 + 1);
  next[next.length - 1] = 0xffffffff;
  for (let i = end - 3; i >= start; i -= 3) {
    const j = (i - start) / 3;
    next[j] = Math.min(indices[i], indices[i + 1], indices[i + 2], next[j + 1]);
  }
  const faces = [];
  let first = start,
    highest = -1;
  for (let i = start; i < end; i += 3) {
    highest = Math.max(highest, indices[i], indices[i + 1], indices[i + 2]);
    if (highest < next[(i - start) / 3 + 1]) {
      faces.push([first, i + 3]);
      first = i + 3;
    }
  }
  return faces;
}

function dressFace(buf, w, pack, pos, normals, roofs, kind, start, end) {
  const first = pack.i[start],
    nx = normals.getX(first),
    nz = normals.getZ(first);
  let left = Infinity,
    right = -Infinity,
    bottom = Infinity,
    top = -Infinity;
  const ids = pack.i.subarray(start, end);
  for (const id of ids) {
    const axis = pos.getX(id) * nz - pos.getZ(id) * nx,
      y = pos.getY(id);
    left = Math.min(left, axis);
    right = Math.max(right, axis);
    bottom = Math.min(bottom, y);
    top = Math.max(top, y);
  }
  const width = right - left,
    height = top - bottom;
  const [wall, roof, bay, floor, base] = styles[kind];
  const onRoof = roofs.has(first),
    highest = top + w.baseElevation;
  const maxFloors = kind === 'church' || kind === 'friary' ? 1 : 6;
  const bays = Math.max(1, Math.round(width / bay));
  const floors = Math.min(maxFloors, Math.max(1, Math.round(height / floor)));
  let surface = onRoof ? roof : wall,
    tint = 0xffffff;
  if (!onRoof && (width < bay * 0.48 || height < floor * 0.55)) {
    surface = 'plain';
    tint =
      {
        church: 0xe2cba3,
        beseda: 0xc8c48e,
        cloister: 0xcbb79a,
        friary: 0xf2e8ce,
        market: 0xf2ead6,
        factory: 0xbcb9ae,
        planetarium: 0xbcb9ae,
        depot: 0x989b92,
        brewery: 0xdcc59b,
        stand: 0x848990,
        workshop: 0xbcb9ae,
      }[kind] ?? 0xdad2c1;
  }
  let project = onRoof
    ? ([x, y, z]) => [x / 4, (z + y * 0.45) / 5]
    : ([x, y, z]) => [
        0.002 + (0.996 * bays * (x * nz - z * nx - left)) / Math.max(0.01, width),
        0.002 + (0.996 * floors * (y - bottom)) / Math.max(0.01, height),
      ];
  const x = pos.getX(first),
    z = pos.getZ(first);
  if (kind === 'church') {
    // Obě celé zvonice dostanou vlastní čtyři štíty a lomenou stanovou střechu.
    // Hřeben měřené lodi končí pod úrovní všech stěn zvonic.
    if (highest > 360) return;
    if (!onRoof) {
      surface = 'plain';
      tint = 0xe6d2ae;
    }
  }
  if (!onRoof && kind === 'friary' && x < 70 && Math.abs(nx) > 0.55) {
    surface = 'friary-front';
    tint = 0xffffff;
    project = ([px, y, pz]) => [
      Math.max(0.002, Math.min(0.998, ((pz - 214.2) * 0.99 + (px - 67) * 0.13) / 10.8 + 0.5)),
      Math.max(0.002, Math.min(0.998, (y + w.baseElevation - 309.7) / 23.2)),
    ];
  }
  // Hrot a šikmé plochy náhradní pyramidy překrývá otevřená lucerna Besedy.
  if (kind === 'beseda' && onRoof && highest > 340 && Math.hypot(x + 69.22, z - 335.15) < 6) return;
  if (kind === 'friary' && highest > 335 && onRoof) surface = 'spire';
  if (kind === 'factory' && onRoof && nx > 0.34) surface = 'depot';
  for (let i = start; i < end; i += 3) {
    const points = Array.from(pack.i.subarray(i, i + 3), (id) => [pos.getX(id), pos.getY(id), pos.getZ(id)]);
    buf.tri(points, surface, points.map(project), tint);
  }
}

export function dressSurvey(buf, world, pack, shell, name) {
  const spec = sheets[name];
  if (!spec || spec[0] !== pack.fileHash) return false;
  const covered = new Set(),
    roofs = new Set(pack.roof),
    pos = shell.attributes.position,
    normals = shell.attributes.normal;
  for (const [start, end, kind] of spec[1]) {
    for (const id of pack.i.subarray(start, end)) covered.add(id);
    if (kind === 'gate' || kind === 'waterTower') continue;
    for (const [a, b] of faceRanges(pack.i, start, end)) dressFace(buf, world, pack, pos, normals, roofs, kind, a, b);
  }
  const keep = [],
    distant = [],
    old = shell.index.array;
  for (let i = 0; i < old.length; i += 3) {
    const group = covered.has(old[i]) ? distant : keep;
    group.push(old[i], old[i + 1], old[i + 2]);
  }
  shell.setIndex(keep.concat(distant));
  shell.setDrawRange(0, keep.length);
  return true;
}
