import { QUALITY } from '../config.js';
import { makeFallenMesh } from '../entities/models.js';
import { Quaternion, Vector3 } from 'three/webgpu';
import { Ragdoll, parts } from '../physics/ragdoll.js';

export class Falls {
  constructor(game) {
    this.game = game;
    this.active = new Map();
    this.enabled = true;
    this.target = new Vector3();
  }

  limit(count) {
    while (this.active.size > count) this.finish(this.active.keys().next().value);
  }

  start(actor, vx, vy, vz) {
    if (!this.enabled || this.active.has(actor)) return;
    this.limit(QUALITY.ragdolls - 1);
    const g = this.game;
    if (actor === g.player) actor.setWalking(false);
    g.colliders.update(actor.x, actor.z);
    const floor = (x, z) => g.world.surfaceAt(x, z, actor.y + 0.35);
    const doll = new Ragdoll(g.physics, actor, vx, vy, vz, floor);
    const mesh = makeFallenMesh(actor.mesh);
    g.scene.add(mesh);
    this.active.set(actor, { doll, mesh });
    actor.mesh.visible = false;
    this.sync(actor, doll, mesh);
  }

  sync(actor, doll, mesh) {
    for (let i = 0; i < doll.links.length; i++) {
      const body = doll.links[i], pos = body.GetPosition(), q = body.GetRotation();
      const limb = mesh.children[i];
      limb.position.set(pos.GetX(), pos.GetY(), pos.GetZ());
      limb.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
    }
    const root = mesh.children[0].position;
    actor.x = root.x; actor.y = root.y; actor.z = root.z;
  }

  step(dt) {
    for (const [actor, entry] of this.active) {
      const { doll, mesh } = entry;
      if (entry.rise) {
        const rise = entry.rise;
        rise.time += dt;
        const t = Math.min(1, rise.time / 0.35);
        const blend = t * t * (3 - 2 * t);
        for (const [i, limb] of mesh.children.entries()) {
          const part = parts[i];
          this.target.set(actor.x + rise.cos * part.x, rise.floor + part.y, actor.z - rise.sin * part.x);
          limb.position.lerpVectors(rise.from[i].position, this.target, blend);
          limb.quaternion.slerpQuaternions(rise.from[i].rotation, rise.rotation, blend);
        }
        if (t === 1) this.finish(actor);
        continue;
      }
      doll.update(dt);
      this.sync(actor, doll, mesh);
      const ready = actor === this.game.player
        ? doll.age >= 3.6 || (doll.age >= 2 && doll.rest > 0.25) : doll.rest >= 3;
      if (ready) {
        const floor = this.game.colliders.exitHeight(actor.x, actor.z, actor.y);
        entry.rise = { time: 0, floor, cos: Math.cos(actor.yaw), sin: Math.sin(actor.yaw),
          rotation: new Quaternion(0, Math.sin(actor.yaw / 2), 0, Math.cos(actor.yaw / 2)),
          from: mesh.children.map(limb => ({ position: limb.position.clone(), rotation: limb.quaternion.clone() })) };
        doll.dispose();
      }
    }
  }

  finish(actor) {
    const entry = this.active.get(actor);
    if (!entry) return;
    this.active.delete(actor);
    const { game } = this;
    if (!entry.rise) entry.doll.dispose();
    game.scene.remove(entry.mesh);
    actor.mesh.visible = true;
    const y = entry.rise?.floor ?? game.colliders.exitHeight(actor.x, actor.z, actor.y);
    if (actor === game.player) {
      actor.place(actor.x, actor.z, y);
      actor.stun = Math.max(0, 2 - entry.doll.age);
      actor.setWalking(game.mode === 'foot');
    } else {
      // Při uvolnění limitu může být nejstarší chodec ještě ve vzduchu.
      actor.y = game.world.surfaceAt(actor.x, actor.z, y + 0.35);
      actor.state = 'flee'; actor.timer = 4;
      actor.fx = Math.sin(actor.yaw); actor.fz = Math.cos(actor.yaw);
      actor.mesh.position.set(actor.x, actor.y, actor.z);
      actor.mesh.rotation.set(0, actor.yaw, 0);
    }
  }
}
