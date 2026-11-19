import { smoothstep } from 'three/tsl';
const waves = [
  [0.17, 0.22, 0.5],
  [0.36, -0.09, 0.32],
  [0.067, 0.31, 0.18]
];
// Stejné prohlubně se používají pro lesk vozovky i pro odstřik od kol.
export function puddleAt(x, z, wet, grade = 0) {
  if (wet <= 0.3 || grade >= 0.12) return 0;
  const wave = waves.reduce((v, [a, b, w]) => v + w * Math.sin(x * a + z * b), 0);
  const smooth = (a, b, n) => {
    const t = Math.min(1, Math.max(0, (n - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return smooth(0.26, 0.56, wave) * smooth(0.3, 0.85, wet) * (1 - smooth(0.045, 0.12, grade));
}
export function puddleNode(point, wet, up) {
  const wave = waves
    .map(([a, b, w]) => point.x.mul(a).add(point.y.mul(b)).sin().mul(w))
    .reduce((a, b) => a.add(b));
  const grade = up.abs().clamp(0.01, 1).acos().tan();
  return smoothstep(0.26, 0.56, wave).mul(
    smoothstep(0.3, 0.85, wet),
    smoothstep(0.045, 0.12, grade).oneMinus()
  );
}
