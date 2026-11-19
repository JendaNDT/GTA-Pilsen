import { HalfFloatType, Matrix4, NodeMaterial, QuadMesh, RenderTarget, Vector2, Vector3 } from 'three/webgpu';
import { Fn, If, Loop, float, positionWorld, getScreenPositionFromClip, getViewPosition, mix, smoothstep, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { valueNoise } from './material-noise.js';
import { cloudCover } from './weather-surfaces.js';
import { env } from './materials.js';

function footprint(xz) {
  return xz.mul(.00094).add(vec2(env.time.mul(.0009), env.time.mul(.00034)));
}
function broadDensity(xz) {
  const p = footprint(xz);
  return valueNoise(p).mul(.72).add(valueNoise(p.mul(2.17).add(17)).mul(.28));
}

export function cloudShadow(shadow) {
  return Fn(() => {
    const direct = shadow.toVar();
    If(cloudCover.greaterThan(.12).and(env.sunDir.y.greaterThan(.025)), () => {
      const p = cloudShadowPosition();
      const mask = smoothstep(.45,.67,broadDensity(p).add(cloudCover.sub(.45).mul(.6)));
      direct.mulAssign(mask.mul(-.35).add(1));
    });
    return direct;
  })();
}
function cloudShadowPosition() {
  return positionWorld.xz.add(env.sunDir.xz.mul(float(880).sub(positionWorld.y).div(env.sunDir.y.max(.11))));
}

export class CloudLayer {
  constructor(renderer) {
    this.renderer = renderer;
    this.targets = [0, 1].map(() => new RenderTarget(1, 1, {type:HalfFloatType, depthBuffer:false}));
    this.targetIndex = 0;
    this.previous = texture(this.targets[1].texture);
    this.image = texture(this.targets[0].texture);
    this.inverse = uniform(new Matrix4());
    this.world = uniform(new Matrix4());
    this.oldClip = uniform(new Matrix4());
    this.previousVP = new Matrix4();
    this.eye = uniform(new Vector3());
    this.weight = uniform(0);
    this.jitter = uniform(0);
    this.size = new Vector2();
    this.frame = 0;
    this.valid = false;
    this.lastTime = 0;
    const mat = new NodeMaterial();
    mat.depthTest = false;
    mat.depthWrite = false;
    // Čtvrtý kanál nese krytí oblaků i u neprůhledného výpočetního průchodu.
    mat.fragmentNode = Fn(() => {
      const ray = this.world.mul(vec4(getViewPosition(uv(), .5, this.inverse).normalize(),0)).xyz.normalize().toVar();
      const result = vec4(0).toVar();
      If(ray.y.greaterThan(.03), () => {
        const rise = ray.y.max(.03);
        const entry = float(680).sub(this.eye.y).div(rise).max(0).toVar();
        const end = float(1120).sub(this.eye.y).div(rise).max(0);
        const stride = end.sub(entry).div(10).toVar();
        const transmittance = float(1).toVar(), brightness = float(0).toVar();
        Loop(10, ({ i }) => {
          const at = this.eye.add(ray.mul(entry.add(stride.mul(float(i).add(this.jitter))))).toVar();
          const level = at.y.sub(680).div(440);
          const profile = smoothstep(0,.2,level).mul(smoothstep(.68,1,level).oneMinus());
          const detail = valueNoise(footprint(at.xz).mul(5).add(at.y.mul(.004)));
          const density = broadDensity(at.xz).add(detail.mul(.19),cloudCover.mul(.59)).sub(.78).max(0).mul(profile);
          const opacity = density.mul(stride,-.017).exp().oneMinus();
          const visible = transmittance.mul(opacity);
          brightness.addAssign(visible.mul(level.mul(.39).add(.56)));
          transmittance.mulAssign(opacity.oneMinus());
        });
        const alpha = transmittance.oneMinus();
        const shade = mix(vec3(.16,.21,.31),vec3(.91,.94,.98),env.night.oneMinus());
        result.assign(vec4(shade.mul(brightness.div(alpha.max(.001))),alpha.mul(smoothstep(.03,.13,rise))));
        const anchor = this.eye.add(ray.mul(entry.add(stride.mul(4))));
        const clip = this.oldClip.mul(vec4(anchor,1));
        const coord = getScreenPositionFromClip(clip);
        If(this.weight.greaterThan(0).and(clip.w.greaterThan(0),coord.x.greaterThan(0),coord.y.greaterThan(0),
          coord.x.lessThan(1),coord.y.lessThan(1)), () => {
          result.assign(mix(result,this.previous.sample(coord).level(0),this.weight));
        });
      });
      return result;
    })();
    this.quad = new QuadMesh(mat);
  }

  render(camera) {
    const r = this.renderer;
    r.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.ceil(this.size.x / 4)), h = Math.max(1, Math.ceil(this.size.y / 4));
    if (this.targets[0].width !== w || this.targets[0].height !== h) {
      for (const target of this.targets) target.setSize(w,h);
      this.valid = false;
    }
    camera.updateMatrixWorld();
    this.weight.value = this.valid && this.eye.value.distanceToSquared(camera.position) < 2500 &&
      Math.abs(env.time.value - this.lastTime) < 3 ? .77 : 0;
    this.lastTime = env.time.value;
    this.jitter.value = (++this.frame * .618034) % 1;
    this.oldClip.value.copy(this.previousVP);
    this.previousVP.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.inverse.value.copy(camera.projectionMatrixInverse);
    this.world.value.copy(camera.matrixWorld);
    this.eye.value.copy(camera.position);
    const target = this.targets[this.targetIndex];
    this.previous.value = this.targets[1 - this.targetIndex].texture;
    const oldTarget = r.getRenderTarget();
    try {
      r.setRenderTarget(target);
      this.quad.render(r);
    } finally { r.setRenderTarget(oldTarget); }
    this.image.value = target.texture;
    this.targetIndex = 1 - this.targetIndex;
    this.valid = true;
  }

  dispose() {
    for (const target of this.targets) target.dispose();
    this.quad.material.dispose();
  }
}
