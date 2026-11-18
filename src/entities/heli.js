// Vrtulník: jednoduchý letový model, přistávat jde na zemi i na střechách.
import { makeHeliMesh } from './models.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Heli {
  constructor(scene, world, x, z, yaw = 0) {
    this.world = world;
    this.mesh = makeHeliMesh();
    scene.add(this.mesh);
    this.x = x; this.z = z; this.yaw = yaw;
    this.y = world.surfaceAt(x, z, 1e9);
    this.speed = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.rotor = 0; this.spin = 0; this.pitch = 0; this.roll = 0;
    this.occupied = false; this.landed = true;
    this.radius = 2.2; this.halfLen = 3;
    this.sync();
  }

  spinRotor(dt) {
    const target = this.occupied ? 30 : 0;
    this.rotor += (target - this.rotor) * Math.min(1, dt * (this.occupied ? 1.2 : 0.5));
    this.spin += this.rotor * dt;
  }

  /** fwd, turn ∈ ⟨-1, 1⟩; lift: 1 nahoru, -1 dolů. */
  update(dt, fwd, turn, lift) {
    const w = this.world;
    this.spinRotor(dt);
    const power = clamp((this.rotor - 12) / 14, 0, 1);
    if (!this.occupied) { fwd = 0; turn = 0; lift = this.landed ? 0 : -0.6; }
    const surface = w.surfaceAt(this.x, this.z, this.y + 0.7);
    this.landed = this.y <= surface + 0.05;
    this.yaw -= turn * 1.5 * dt * power;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (!this.landed) {
      this.vx += fx * fwd * 11 * dt * power; this.vz += fz * fwd * 11 * dt * power;
    }
    const drag = this.landed ? 4 : 0.45;
    this.vx *= Math.exp(-drag * dt); this.vz *= Math.exp(-drag * dt);
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 46) { this.vx *= 46 / sp; this.vz *= 46 / sp; }
    this.vy += (lift * 8 * power - this.vy) * Math.min(1, dt * 2.2);
    this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
    // budovy v cestě
    if (w.collideCircle(this.x, this.z, this.radius, this.y + 0.2, this.y + 2.8)) {
      const h = w.hit;
      this.x = h.x; this.z = h.z;
      const vn = this.vx * h.nx + this.vz * h.nz;
      if (vn < 0) { this.vx -= 1.3 * vn * h.nx; this.vz -= 1.3 * vn * h.nz; }
    }
    const m = 40;
    this.x = clamp(this.x, w.playMinX + m, w.playMaxX - m);
    this.z = clamp(this.z, w.playMinZ + m, w.playMaxZ - m);
    const s2 = w.surfaceAt(this.x, this.z, this.y + 0.7);
    let impact = 0;
    if (this.y < s2) { if (this.vy < -5) impact = -this.vy; this.y = s2; if (this.vy < 0) this.vy = 0; }
    const ceil = w.heightAt(this.x, this.z) + 600;
    if (this.y > ceil) { this.y = ceil; if (this.vy > 0) this.vy = 0; }
    const vF = this.vx * fx + this.vz * fz;
    this.pitch += (clamp(vF * 0.012 + fwd * 0.12, -0.3, 0.35) * (this.landed ? 0 : 1) - this.pitch) * Math.min(1, dt * 3);
    this.roll += (clamp(turn * 0.22 * Math.min(1, sp / 12), -0.3, 0.3) * (this.landed ? 0 : 1) - this.roll) * Math.min(1, dt * 3);
    this.speed = sp;
    this.sync();
    return impact;
  }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.mesh.userData.rotor.rotation.y = this.spin;
    this.mesh.userData.tail.rotation.x = this.spin * 1.7;
  }
}
