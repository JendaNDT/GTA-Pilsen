// Všechny čtyři efekty používají společné místo v jedné instancované geometrii.
import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, MeshBasicNodeMaterial, OctahedronGeometry } from 'three/webgpu';
import { Fn, attribute, instanceIndex, instancedArray, positionGeometry, uniform, vec3, vec4 } from 'three/tsl';

const effects = {
  sparks: { color: 0xffbc43, gravity: -10, size: 0.055, time: 0.45, spread: 4.0 },
  glass: { color: 0x9bdde9, gravity: -9.8, size: 0.09, time: 0.75, spread: 3.0 },
  dust: { color: 0xbaaa91, gravity: 0.2, size: 0.23, time: 0.9, spread: 1.4 },
  smoke: { color: 0x5d6063, gravity: 0.5, size: 0.21, time: 1.55, spread: 0.55 },
};
const colors = Object.fromEntries(Object.entries(effects).map(([k, v]) => [k, new Color(v.color)]));

export class Particles {
  constructor(scene, renderer, limit, capacity = 512) {
    this.renderer = renderer;
    this.limit = limit;
    this.capacity = capacity;
    this.enabled = true;
    this.cursor = 0;
    this.time = 0;
    this.last = -Infinity;
    this.nextSmoke = 0;
    const geom = new InstancedBufferGeometry();
    const shard = new OctahedronGeometry(1);
    geom.index = shard.index;
    geom.setAttribute('position', shard.attributes.position);
    this.tint = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
    geom.setAttribute('particleColor', this.tint);
    const material = new MeshBasicNodeMaterial();
    material.colorNode = attribute('particleColor', 'vec3');
    this.origin = new Float32Array(capacity * 4);
    this.velocity = new Float32Array(capacity * 4);
    this.shape = new Float32Array(capacity * 4);
    if (renderer.backend.isWebGPUBackend) {
      const start = instancedArray(this.origin, 'vec4').toReadOnly();
      const speed = instancedArray(this.velocity, 'vec4').toReadOnly();
      const shape = instancedArray(this.shape, 'vec4').toReadOnly();
      this.inputs = [start, speed, shape];
      this.output = instancedArray(capacity, 'vec4');
      this.clock = uniform(0);
      this.compute = Fn(() => {
        const s = start.element(instanceIndex), v = speed.element(instanceIndex), p = shape.element(instanceIndex);
        const age = this.clock.sub(s.w).max(0);
        const radius = p.x.mul(p.y.sub(age).div(p.y.max(0.001)).clamp(0, 1));
        const center = s.xyz.add(v.xyz.mul(age)).add(vec3(0, v.w.mul(0.5).mul(age).mul(age), 0));
        this.output.element(instanceIndex).assign(vec4(center, radius));
      })().compute(capacity);
      const state = this.output.toAttribute();
      material.positionNode = positionGeometry.mul(state.w).add(state.xyz);
    } else {
      this.state = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
      geom.setAttribute('particleState', this.state);
      const state = attribute('particleState', 'vec4');
      material.positionNode = positionGeometry.mul(state.w).add(state.xyz);
    }
    this.mesh = new Mesh(geom, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  emit(kind, x, y, z, count) {
    if (!this.enabled) return;
    const limit = Math.min(this.capacity, this.limit()), effect = effects[kind], color = colors[kind];
    if (!limit || !effect) return;
    for (let n = 0; n < Math.min(count, limit); n++) {
      const index = this.cursor++ % limit, i = index * 4;
      const life = effect.time * (0.75 + Math.random() * 0.5);
      this.origin.set([x, y, z, this.time], i);
      this.velocity.set([(Math.random() - 0.5) * effect.spread * 2,
        (0.3 + Math.random()) * effect.spread, (Math.random() - 0.5) * effect.spread * 2, effect.gravity], i);
      this.shape.set([effect.size * (0.7 + Math.random() * 0.6), life, 0, 0], i);
      this.tint.setXYZ(index, color.r, color.g, color.b);
      this.last = Math.max(this.last, this.time + life);
    }
    this.tint.needsUpdate = true;
    for (const input of this.inputs ?? []) input.value.needsUpdate = true;
  }

  update(dt, cars, focus) {
    this.time += dt;
    if (this.enabled && this.time >= this.nextSmoke) {
      this.nextSmoke = this.time + 0.15;
      for (const car of cars) {
        if (car.health >= 20 || Math.hypot(car.x - focus.x, car.z - focus.z) > 90) continue;
        const hood = car.type.len * 0.32;
        this.emit('smoke', car.x + Math.sin(car.yaw) * hood, car.y + car.type.h * 0.72,
          car.z + Math.cos(car.yaw) * hood, 2);
      }
    }
    this.mesh.visible = this.enabled && this.time < this.last;
    if (!this.mesh.visible) return;
    const count = Math.min(this.limit(), this.capacity);
    this.mesh.geometry.instanceCount = count;
    if (this.compute) {
      this.clock.value = this.time;
      this.renderer.compute(this.compute);
      return;
    }
    for (let i = 0; i < count; i++) {
      const j = i * 4, age = this.time - this.origin[j + 3], life = this.shape[j + 1];
      const radius = life > age ? this.shape[j] * (1 - age / life) : 0;
      this.state.setXYZW(i, this.origin[j] + this.velocity[j] * age,
        this.origin[j + 1] + this.velocity[j + 1] * age + 0.5 * this.velocity[j + 3] * age * age,
        this.origin[j + 2] + this.velocity[j + 2] * age, radius);
    }
    this.state.needsUpdate = true;
  }
}
