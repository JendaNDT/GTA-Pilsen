export const TUNNEL_HEIGHT = 5.4;
const APPROACH = 34;
const PORTAL_CUT = 32;

export class Tunnel {
  constructor(world, road) {
    this.road = road;
    this.halfWidth = world.r.w[road] / 2 + 0.9;
    const a = world.rOff[road], b = world.rOff[road + 1] - 1;
    const points = [];
    for (let k = a; k <= b; k++) {
      points.push({ x: world.rpx[k], z: world.rpz[k], y: world.rpy[k] });
    }
    this.portals = [this.portal(world, points[0], points[1]),
      this.portal(world, points.at(-1), points.at(-2))];
    this.points = [this.portals[0].outside, ...points, this.portals[1].outside];
    this.minX = Math.min(...this.points.map((p) => p.x)) - this.halfWidth - 5;
    this.maxX = Math.max(...this.points.map((p) => p.x)) + this.halfWidth + 5;
    this.minZ = Math.min(...this.points.map((p) => p.z)) - this.halfWidth - 5;
    this.maxZ = Math.max(...this.points.map((p) => p.z)) + this.halfWidth + 5;
  }

  portal(world, p, inside) {
    const length = Math.hypot(inside.x - p.x, inside.z - p.z);
    const dx = (inside.x - p.x) / length, dz = (inside.z - p.z) / length;
    const x = p.x - dx * APPROACH, z = p.z - dz * APPROACH;
    return {
      ...p, dx, dz, outside: { x, z, y: world.heightAt(x, z) + 0.05 },
      width: this.halfWidth, slope: (inside.y - p.y) / length,
    };
  }

  portalCuts(x, z, size) {
    const reach = APPROACH + this.halfWidth;
    return this.portals.filter((p) => p.x >= x - reach && p.x <= x + size + reach
      && p.z >= z - reach && p.z <= z + size + reach);
  }

  position(x, z, width, result) {
    if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) return null;
    const pts = this.points;
    let best = width * width, found = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      const fraction = ((x - a.x) * dx + (z - a.z) * dz) / (length * length);
      const last = i === pts.length - 2;
      if ((i === 0 && fraction < 0) || (last && fraction > 1)) continue;
      const t = Math.max(0, Math.min(1, fraction));
      const cx = a.x + dx * t, cz = a.z + dz * t;
      const d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 >= best) continue;
      best = d2;
      found = true;
      result.tunnel = this;
      result.x = cx; result.z = cz;
      result.floor = a.y + (b.y - a.y) * t;
      result.inside = i > 0 && !last;
      result.distance = Math.sqrt(d2);
    }
    return found ? result : null;
  }
}

export const TUNNEL_PORTAL_CUT = { approach: APPROACH, depth: PORTAL_CUT };
