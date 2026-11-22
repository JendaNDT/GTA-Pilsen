// Herní model vrtulníku sdílí polohu a otáčky rotoru s tělesem Jolt.
import { makeHeliMesh } from './models.js';

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

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.mesh.userData.rotor.rotation.y = this.spin;
    this.mesh.userData.tail.rotation.x = this.spin * 1.7;
  }
}
