// Jedna dávka kapek či vloček. Vrcholy obíhají s kamerou v pevném světovém poli.
import { BufferAttribute, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, cameraPosition, cameraViewMatrix, mix, positionGeometry, uniform, uv, vec3 } from 'three/tsl';
import { env } from '../world/materials.js';

export class Precipitation {
  constructor(scene) {
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array([0,0, 1,0, 0,1, 1,1]), 2));
    geo.setIndex([0,1,2,2,1,3]);
    const seeds = new Float32Array(768 * 3);
    let seed = 6487;
    for (let i = 0; i < seeds.length; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      seeds[i] = seed / 4294967296;
    }
    geo.setAttribute('dropSeed', new InstancedBufferAttribute(seeds, 3));
    this.flakes = uniform(0);
    const source = attribute('dropSeed', 'vec3');
    const drift = env.time.mul(mix(18, 1.8, this.flakes));
    const span = vec3(27, 18, 27);
    const wind = vec3(drift.mul(.095), drift.negate(), drift.mul(.035));
    const offset = source.mul(span).add(wind).sub(cameraPosition).div(span).fract().sub(.5).mul(span);
    const center = cameraPosition.add(offset);
    const right = vec3(cameraViewMatrix.element(0).x, cameraViewMatrix.element(1).x, cameraViewMatrix.element(2).x);
    const across = right.mul(positionGeometry.x, mix(.012, .055, this.flakes));
    const length = positionGeometry.y.mul(mix(.30, .048, this.flakes));
    const pos = center.add(across, vec3(length.mul(-.095), length, length.mul(-.035)));
    const edge = uv().sub(.5).length().mul(2).oneMinus().saturate();
    const material = new MeshBasicNodeMaterial({
      positionNode: pos, colorNode: mix(vec3(.54,.66,.79), vec3(.93,.96,1), this.flakes),
      opacityNode: edge.mul(mix(.48,.94,this.flakes)), transparent: true,
      depthWrite: false, side: DoubleSide, forceSinglePass: true
    });
    this.mesh = new Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(weather, quality, sheltered) {
    const total = weather.rain + weather.flakes;
    this.mesh.visible = !sheltered && total > .015;
    if (!this.mesh.visible) return;
    this.flakes.value = weather.flakes / total;
    this.mesh.geometry.instanceCount = Math.min(768, Math.ceil(total * quality * 1.5));
  }
}
