// Střed je v metrech světa, měřítko v obrazových bodech na metr.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function insideMap(area, x, z) {
  return x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ;
}

export class MapView {
  constructor(area, width, height, x, z) {
    this.area = area;
    this.resize(width, height);
    this.home(x, z);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.fit = .9 * Math.min(this.width / (this.area.maxX - this.area.minX),
      this.height / (this.area.maxZ - this.area.minZ));
    if (this.scale) this.scale = clamp(this.scale, this.fit, 6);
  }

  home(x, z) {
    this.x = x;
    this.z = z;
    this.scale = clamp(Math.min(this.width, this.height) / 650, .55, 1.35);
  }

  overview() {
    this.x = (this.area.minX + this.area.maxX) / 2;
    this.z = (this.area.minZ + this.area.maxZ) / 2;
    this.scale = this.fit;
  }

  world(u, v) {
    return { x: this.x + (u - this.width / 2) / this.scale,
      z: this.z + (v - this.height / 2) / this.scale };
  }

  screen(x, z) {
    return [(x - this.x) * this.scale + this.width / 2,
      (z - this.z) * this.scale + this.height / 2];
  }

  move(dx, dy) {
    this.x = clamp(this.x - dx / this.scale, this.area.minX, this.area.maxX);
    this.z = clamp(this.z - dy / this.scale, this.area.minZ, this.area.maxZ);
  }

  zoom(factor, u = this.width / 2, v = this.height / 2) {
    const anchor = this.world(u, v);
    this.scale = clamp(this.scale * factor, this.fit, 6);
    const [ax, ay] = this.screen(anchor.x, anchor.z);
    this.move(u - ax, v - ay);
  }
}
