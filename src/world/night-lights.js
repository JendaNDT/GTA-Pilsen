import { Group, PointLight, SpotLight } from 'three/webgpu';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';

// Pravděpodobnost rozsvíceného okna se mezi celými hodinami mění plynule.
const home = [
  0.15, 0.09, 0.07, 0.06, 0.08, 0.16, 0.28, 0.27, 0.14, 0.1, 0.09, 0.1, 0.12, 0.11, 0.12, 0.16, 0.28, 0.43, 0.6,
  0.72, 0.78, 0.72, 0.56, 0.34
];
export function windowSchedule(hour) {
  const h = ((hour % 24) + 24) % 24,
    i = Math.floor(h),
    frac = h - i;
  const house = home[i] + frac * (home[(i + 1) % 24] - home[i]);
  const office =
    h < 6 ? 0.05 : h < 8 ? 0.05 + (h - 6) * 0.36 : h < 17 ? 0.77 : h < 20 ? 0.77 - (h - 17) * 0.22 : 0.06;
  return [house, office, h >= 7 && h < 20 ? 0.87 : 0];
}

export function nearestLights(entries, point, limit, range = Infinity) {
  const candidates = [];
  for (const item of entries) {
    if (item.intact === false) continue;
    const d = (item.x - point.x) ** 2 + (item.z - point.z) ** 2 + ((item.y ?? 0) - (point.y ?? 0)) ** 2;
    if (d < range * range) candidates.push({ item, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  return candidates.slice(0, limit).map((c) => c.item);
}

export class NightLights {
  constructor(renderer, scene, capacity, headlights) {
    this.renderer = renderer;
    this.standard = renderer.lighting;
    this.group = new Group();
    this.group.visible = false;
    scene.add(this.group);
    // Krátký dosah městských světel dovoluje hrubší členění prostoru.
    this.clustered = new ClusteredLighting(capacity + headlights + 4, 64, 12, 16);
    this.lamps = Array.from({ length: capacity }, () => {
      const light = new PointLight(0xffd49a, 0, 24, 2);
      light.visible = false;
      this.group.add(light);
      return light;
    });
    this.cars = Array.from({ length: headlights }, () => {
      const light = new SpotLight(0xffefcd, 0, 43, 0.43, 0.7, 2);
      light.visible = false;
      this.group.add(light, light.target);
      return light;
    });
    this.playerBeams = Array.from({ length: 2 }, () => {
      const light = new SpotLight(0xfff2d6, 0, 55, 0.4, 0.65, 2);
      light.visible = false;
      this.group.add(light, light.target);
      return light;
    });
    this.last = -Infinity;
    this.selected = [];
    this.lastX = Infinity;
    this.lastZ = Infinity;
  }
  update(camera, chunks, cars, night, playerCar = null) {
    if (night < 0.035) {
      this.group.visible = false;
      this.renderer.lighting = this.standard;
      this.last = -Infinity;
      return;
    }
    this.group.visible = true;
    const point = camera.position,
      now = performance.now();
    if (now - this.last >= 240 || Math.hypot(point.x - this.lastX, point.z - this.lastZ) > 8) {
      const candidates = [];
      for (const ch of chunks.values()) {
        if (ch.lamps && Math.hypot(ch.cx - point.x, ch.cz - point.z) < 600)
          candidates.push(...ch.lamps.entries);
      }
      this.selected = nearestLights(candidates, point, this.lamps.length, 440);
      this.last = now;
      this.lastX = point.x;
      this.lastZ = point.z;
    }
    for (let i = 0; i < this.lamps.length; i++) {
      const light = this.lamps[i],
        lamp = this.selected[i];
      light.visible = !!lamp?.intact;
      if (!light.visible) continue;
      light.position.set(lamp.lightX, lamp.y + lamp.height - 0.15, lamp.lightZ);
      light.intensity = night * (lamp.height > 7 ? 115 : 75);
    }
    const nearest = this.cars.length
      ? nearestLights(
          cars.filter((c) => c !== playerCar && c.mode !== 'parked' && !c.noLights && c.mesh.visible),
          point,
          this.cars.length,
          145
        )
      : [];
    for (let i = 0; i < this.cars.length; i++) {
      const light = this.cars[i],
        car = nearest[i];
      light.visible = !!car;
      if (!car) continue;
      const dx = Math.sin(car.yaw),
        dz = Math.cos(car.yaw),
        nose = car.type.len * 0.48,
        y = car.y + 0.68;
      light.position.set(car.x + dx * nose, y, car.z + dz * nose);
      light.target.position.set(car.x + dx * 23, y - 0.95, car.z + dz * 23);
      light.intensity = night * 170;
    }
    const playerLights = playerCar && !playerCar.noLights;
    for (let i = 0; i < 2; i++) {
      const light = this.playerBeams[i];
      light.visible = Boolean(playerLights);
      if (!playerLights) continue;
      const x = (i ? 1 : -1) * playerCar.type.wid * 0.33;
      const z = playerCar.type.len * 0.5;
      const high = playerCar.highBeam;
      playerCar.mesh.localToWorld(light.position.set(x, 0.7, z));
      playerCar.mesh.localToWorld(light.target.position.set(x, high ? 0.5 : -0.15, z + 18));
      light.distance = high ? 100 : 55;
      light.angle = high ? 0.26 : 0.4;
      light.intensity = night * (high ? 880 : 340);
    }
    this.renderer.lighting = this.selected.length || nearest.length || playerLights ? this.clustered : this.standard;
  }
  dispose() {
    this.renderer.lighting = this.standard;
    this.group.removeFromParent();
    for (const light of [...this.lamps, ...this.cars, ...this.playerBeams]) light.dispose();
    this.clustered.dispose();
  }
}
