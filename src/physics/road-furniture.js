import { railingFaces } from './railings.js';
import { layers } from './world.js';

function bodyKey(body) { return body.GetID().GetIndexAndSequenceNumber(); }

function readPose(body) {
  const p = body.GetPosition(), q = body.GetRotation();
  return { x: p.GetX(), y: p.GetY(), z: p.GetZ(), qx: q.GetX(), qy: q.GetY(), qz: q.GetZ(), qw: q.GetW() };
}

export class RoadFurnitureBodies {
  constructor(physics, world, meshBody, debug) {
    this.physics = physics;
    this.world = world;
    this.registry = world.breakables;
    this.meshBody = meshBody;
    this.debug = debug;
    this.tiles = new Set();
    this.rails = new Map();
    this.byBody = new Map();
    this.loose = new Map();
    this.hits = new Map();
    this.dirty = new Set();
    this.closures = new Map();
    this.closureBodies = new Map();
    this.moved = new Map();
    for (const fixtures of world.closureChunks.values()) {
      for (const fixture of fixtures) this.closures.set(fixture.id, fixture);
    }
    this.pending = new Set();
    const { Jolt } = physics;
    this.position = new Jolt.RVec3(0, 0, 0);
    this.vector = new Jolt.Vec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
  }

  destroyBody(body) {
    this.physics.debris?.forget(body);
    this.closureBodies.delete(bodyKey(body));
    const id = body.GetID();
    this.physics.bodies.RemoveBody(id);
    this.physics.bodies.DestroyBody(id);
  }

  removeRailMesh(ci) {
    const rail = this.rails.get(ci);
    if (!rail) return;
    this.byBody.delete(bodyKey(rail.body));
    this.destroyBody(rail.body);
    this.debug?.discard(ci, rail.mesh);
    this.rails.delete(ci);
  }

  buildRailMesh(ci) {
    this.removeRailMesh(ci);
    const edges = this.world.bridgeEdges.get(ci);
    if (!edges || !this.tiles.has(ci)) return;
    const positions = [], ids = [];
    edges.forEach((edge, index) => {
      if (this.registry.state(edge.id) !== 'intact') return;
      railingFaces(edge, (a, b, c, d) => {
        positions.push(...a, ...b, ...c, ...a, ...c, ...d);
        ids.push(index, index);
      });
    });
    if (!ids.length) return;
    const vertices = Float32Array.from(positions);
    const body = this.meshBody(this.physics, vertices, layers.RAILING, ids);
    this.byBody.set(bodyKey(body), edges);
    this.rails.set(ci, { body, mesh: this.debug?.add(ci, vertices) });
  }

  load(ci) {
    this.tiles.add(ci);
    this.buildRailMesh(ci);
    for (const fixture of this.world.closureChunks.get(ci) ?? []) this.pending.add(fixture);
  }

  unload(ci) {
    this.tiles.delete(ci);
    this.removeRailMesh(ci);
    for (const { fixture } of this.loose.values()) if (fixture.tile === ci) this.pending.add(fixture);
    for (const fixture of this.world.closureChunks.get(ci) ?? []) this.pending.add(fixture);
  }

  contact(rail, car, subshape, impulse) {
    const edges = this.byBody.get(bodyKey(rail));
    if (!edges) return false;
    const { Jolt } = this.physics;
    const index = Jolt.castObject(rail.GetShape(), Jolt.MeshShape).GetTriangleUserData(subshape);
    const fixture = edges[index];
    if (!fixture) return false;
    if (this.hits.has(fixture)) return true;
    if (impulse < (fixture.style === 'stone' ? 30000 : 12000)) return false;
    const v = car.GetLinearVelocity();
    this.hits.set(fixture, { impulse, vx: v.GetX(), vz: v.GetZ(), car: bodyKey(car) });
    return true;
  }

  bump(first, second, impulse) {
    const vehicle = first.GetObjectLayer() === layers.VEHICLE ? first : second;
    if (vehicle.GetObjectLayer() !== layers.VEHICLE) return;
    const item = this.closureBodies.get(bodyKey(vehicle === first ? second : first));
    if (item) item.hit = { car: bodyKey(vehicle), impulse };
  }

  createLoose(fixture, hit) {
    const { Jolt, bodies } = this.physics;
    const { x, y, z } = fixture;
    let corners = fixture.corners;
    let height = fixture.height;
    if (fixture.closure) {
      const [, , dx, dz, width] = fixture.closure;
      corners = [[-1,-1], [-1,1], [1,1], [1,-1]].map(([side, end]) => {
        const px = x - dz * side * (width + 0.5) / 2 + dx * end * 0.24;
        const pz = z + dx * side * (width + 0.5) / 2 + dz * end * 0.24;
        return [px, this.world.heightAt(px, pz), pz];
      });
      height = 0.88;
    }
    const hull = new Jolt.ConvexHullShapeSettings();
    hull.mHullTolerance = 0.0001;
    hull.mMaxConvexRadius = 0.005;
    for (const [px, py, pz] of corners) for (const h of [0, height]) {
      this.vector.Set(px - x, py + h - y, pz - z);
      hull.mPoints.push_back(this.vector);
    }
    const shape = hull.Create();
    try {
      const pose = this.registry.damaged.get(fixture.id)?.pose;
      this.position.Set(pose?.x ?? x, pose?.y ?? y, pose?.z ?? z);
      this.rotation.Set(pose?.qx ?? 0, pose?.qy ?? 0, pose?.qz ?? 0, pose?.qw ?? 1);
      // U velmi krátkého ořezu na styku mostovek může být obal degenerovaný.
      this.vector.Set(0.04, height / 2, 0.04);
      const settings = new Jolt.BodyCreationSettings(shape.HasError() ? new Jolt.BoxShape(this.vector, 0.005) : shape.Get(),
        this.position, this.rotation, Jolt.EMotionType_Dynamic, layers.DEBRIS);
      settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      settings.mMassPropertiesOverride.mMass = fixture.closure ? 20 : fixture.style === 'stone' ? 180 : 28;
      const body = bodies.CreateBody(settings);
      Jolt.destroy(settings);
      bodies.AddBody(body.GetID(), hit ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
      const item = { body, fixture, active: !!hit };
      this.loose.set(fixture.id, item);
      if (fixture.closure) this.closureBodies.set(bodyKey(body), item);
      else this.physics.debris?.add(body, () => {
        this.destroyBody(body);
        this.loose.delete(fixture.id);
        this.registry.setPose(fixture.id, null);
      });
      if (hit) {
        this.vector.Set(hit.vx * 0.7, 1, hit.vz * 0.7);
        bodies.SetLinearVelocity(body.GetID(), this.vector);
        this.vector.Set(hit.vz * 0.4, 0, -hit.vx * 0.4);
        bodies.SetAngularVelocity(body.GetID(), this.vector);
      }
    } finally {
      shape.Clear();
      Jolt.destroy(hull);
    }
  }

  repair(ids) {
    for (const id of ids) {
      const closure = this.closures.get(id);
      if (closure) {
        this.pending.add(closure);
        this.updateObstacles(closure, null);
      } else if (id.startsWith('railing/')) {
        const ci = Number(id.split('/')[1]);
        if (this.tiles.has(ci)) this.dirty.add(ci);
        const piece = this.loose.get(id);
        if (piece) this.pending.add(piece.fixture);
      }
    }
  }

  updateObstacles(fixture, pose) {
    const was = this.moved.get(fixture.id);
    if (!pose && !was) return;
    this.world.removeObstacles(was ?? fixture.obstacles);
    if (!pose) {
      this.moved.delete(fixture.id);
      this.world.addObstacles(fixture.obstacles);
      return;
    }
    const list = [];
    for (let i = 0; i < fixture.obstacles.length; i += 3) {
      const dx = fixture.obstacles[i] - fixture.x, dz = fixture.obstacles[i + 1] - fixture.z;
      const { qx, qy, qz, qw } = pose;
      list.push(pose.x + dx * (1 - 2 * (qy*qy + qz*qz)) + dz * 2 * (qx*qz + qw*qy),
        pose.z + dx * 2 * (qx*qz - qw*qy) + dz * (1 - 2 * (qx*qx + qy*qy)), fixture.obstacles[i + 2]);
    }
    this.world.addObstacles(list);
    this.moved.set(fixture.id, list);
  }

  step(now, budget = 20) {
    for (const [fixture, hit] of this.hits) {
      // Jedno pohyblivé těleso a nejvýše dvě operace na společné síti dlaždice.
      if (budget < 3 + this.dirty.size * 2 || this.physics.debris?.room(1) === false) break;
      this.hits.delete(fixture);
      if (!this.tiles.has(fixture.tile) || !this.registry.damage(fixture.id, 'broken', now)) continue;
      this.createLoose(fixture, hit);
      this.physics.onFurnitureDamage?.(fixture, hit, fixture.style === 'stone' ? 'stone' : 'metal');
      this.dirty.add(fixture.tile);
      budget--;
    }
    for (const ci of this.dirty) {
      if (budget < 2) break;
      this.buildRailMesh(ci);
      this.dirty.delete(ci);
      budget -= 2;
    }
    for (const fixture of this.pending) {
      if (budget < 2) break;
      this.pending.delete(fixture);
      const old = this.loose.get(fixture.id);
      if (old) {
        this.destroyBody(old.body);
        this.loose.delete(fixture.id);
        if (!fixture.closure) this.registry.setPose(fixture.id, null);
        budget--;
      }
      if (fixture.closure && this.tiles.has(fixture.tile)) {
        this.createLoose(fixture);
        budget--;
      }
    }
    for (const item of this.loose.values()) {
      const { fixture, body } = item;
      if (!body.IsActive() && !item.active) continue;
      item.active = body.IsActive();
      const pose = readPose(body);
      if (fixture.closure) {
        if (this.registry.state(fixture.id) === 'intact') {
          if (Math.hypot(pose.x-fixture.x, pose.y-fixture.y, pose.z-fixture.z) < 0.015 && Math.abs(pose.qw) > 0.9999) continue;
          this.registry.damage(fixture.id, 'moved', now);
          if (item.hit) this.physics.onFurnitureDamage?.(fixture, item.hit, 'metal');
        }
        this.updateObstacles(fixture, pose);
      }
      this.registry.setPose(fixture.id, pose);
    }
    return budget;
  }
}
