// Vlastní nízkopolygonové modely. Stejné trojúhelníky používá hra i převod vzdálených pohledů.
import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Quaternion,
  Vector3
} from 'three/webgpu';

export const TREE_TYPES = ['listnaty', 'jehlicnaty', 'ker', 'ovocny'];
export const TREE_PIVOT = 4;
export const TREE_FRAME = 10;
// Podíl oblé normály koruny (0 = ostré plochy jako dřív, 1 = hladká koule).
export const CROWN_SOFTNESS = 0.8;
const colors = [0x689746, 0x406e48, 0x62863e, 0x789442];
const crowns = [
  [
    [0, 4.5, 0, 2.1],
    [1.05, 5.6, 0.35, 1.65],
    [-1, 5.35, -0.6, 1.55],
    [-0.15, 6.35, 0.65, 1.5]
  ],
  [
    [0, 3.5, 0, 1.95],
    [0, 5.2, 0, 1.55],
    [0, 6.8, 0, 1.05]
  ],
  [
    [0, 1, 0, 1.15],
    [0.65, 1.4, 0.15, 0.85],
    [-0.7, 1.15, -0.25, 0.85]
  ],
  [
    [0, 3.3, 0, 1.4],
    [1.15, 3.6, 0.3, 1.25],
    [-1.15, 3.5, -0.25, 1.2],
    [0.2, 4.3, 0.5, 1.1]
  ]
];
const wood = new Color(0x604d3c);
const up = new Vector3(0, 1, 0);

export function treeModel(type) {
  const pos = [],
    nor = [],
    rgb = [],
    leaf = [];
  const tint = new Color(colors[type]);
  const normal = new Vector3(),
    radial = new Vector3();
  // Koruna má měkké stínování: normála míří převážně od středu koule, takže stejný počet
  // trojúhelníků působí oble. Odstín se mění plynule po povrchu, ne skokem po plochách.
  function add(geo, foliage, center = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position,
      n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      const faceShade = foliage ? 0.72 + 0.036 * p.getY(i) + 0.075 * Math.sin(i * 12.9898) : 1;
      const c = foliage ? tint : wood;
      for (let j = i; j < i + 3; j++) {
        const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
        normal.set(n.getX(j), n.getY(j), n.getZ(j));
        let shade = faceShade;
        if (foliage && center) {
          radial.set(x - center[0], y - center[1], z - center[2]).normalize();
          normal.lerp(radial, CROWN_SOFTNESS).normalize();
          shade = 0.72 + 0.036 * y + 0.045 * Math.sin(x * 2.7 + z * 1.9 + y * 1.3);
        }
        pos.push(x, y, z);
        nor.push(normal.x, normal.y, normal.z);
        rgb.push(c.r * shade, c.g * shade, c.b * shade);
        leaf.push(foliage ? 1 : 0);
      }
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  function branch(a, b, r, tip) {
    const start = new Vector3(...a),
      end = new Vector3(...b);
    const dir = end.clone().sub(start);
    const g = new CylinderGeometry(tip, r, dir.length(), 5, 1, true);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(up, dir.normalize()));
    const mid = start.lerp(end, 0.5);
    add(g.translate(mid.x, mid.y, mid.z), false);
  }
  const trunk = [5.8, 7.3, 1.6, 3.7][type];
  branch([0, -0.3, 0], [0, trunk, 0], type === 2 ? 0.11 : 0.23, 0.065);
  if (type !== 1)
    for (const [i, [x, y, z, r]] of crowns[type].entries()) {
      const angle = i * 2.4 + 0.4;
      const tip = [x + r * 0.65 * Math.cos(angle), y + r * 0.55, z + r * 0.65 * Math.sin(angle)];
      const fork = [tip[0] * 0.65, y - 0.3, tip[2] * 0.65];
      branch([0, Math.min(trunk * 0.62, y * 0.54), 0], fork, type === 2 ? 0.055 : 0.105, 0.058);
      branch(fork, tip, 0.06, 0.02);
      branch(fork, [x - r * 0.42 * Math.sin(angle), y + 0.55, z + r * 0.42 * Math.cos(angle)], 0.055, 0.018);
    }
  for (const [x, y, z, r] of crowns[type]) {
    const g = type === 1 ? new ConeGeometry(r, 2.1 + r * 0.72, 7) : new IcosahedronGeometry(r);
    // u jehličnanu leží „střed“ níž, aby normály kužele mířily víc do stran
    add(g.translate(x, y, z), true, type === 1 ? [x, y - (2.1 + r * 0.72) * 0.45, z] : [x, y, z]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(rgb, 3));
  geo.setAttribute('foliage', new Float32BufferAttribute(leaf, 1));
  return geo;
}

export const SEASON_TINT = [
  [1.22, 1.38, 0.87],
  [1, 1, 1],
  [2.5, 0.63, 0.28],
  [1, 1, 1]
];
export function treeSeason(day) {
  const month = new Date(day * 86400000).getUTCMonth();
  return month < 2 || month === 11 ? 3 : Math.floor((month - 2) / 3);
}
export function treeType(leaf, area, variation) {
  if (leaf === 1) return 0;
  if (leaf === 2) return 1;
  if (area === 'garden') return 3;
  if (area === 'scrub') return 2;
  if (area === 'forest') return variation < 0.58 ? 1 : 0;
  return 0;
}
