import { layers } from './world.js';

const CENTER_HEIGHT = 0.9;
const RADIUS = 0.35;

export class WalkingCharacter {
  constructor(physics, player) {
    const { Jolt, engine, system } = physics;
    this.physics = physics;
    this.position = new Jolt.RVec3(player.x, player.y + CENTER_HEIGHT, player.z);
    this.velocity = new Jolt.Vec3(0, 0, 0);
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const shape = new Jolt.CapsuleShape(CENTER_HEIGHT - RADIUS, RADIUS);
    const settings = new Jolt.CharacterVirtualSettings();
    settings.mMaxSlopeAngle = Math.PI / 4;
    settings.mMaxStrength = 85;
    // Oporu tvoří spodní polokoule kapsle. Kontakt boku se zdí není došlap.
    settings.mSupportingVolume.SetConstant(CENTER_HEIGHT - RADIUS);
    settings.mShape = shape;
    settings.mInnerBodyShape = shape;
    settings.mInnerBodyLayer = layers.CHARACTER;
    settings.mEnhancedInternalEdgeRemoval = true;
    this.character = new Jolt.CharacterVirtual(settings, this.position, rotation, system);
    Jolt.destroy(settings);
    Jolt.destroy(rotation);
    this.settings = new Jolt.ExtendedUpdateSettings();
    this.settings.mWalkStairsStepUp.Set(0, 0.35, 0);
    this.settings.mStickToFloorStepDown.Set(0, -0.35, 0);
    this.filters = [
      new Jolt.DefaultBroadPhaseLayerFilter(engine.GetObjectVsBroadPhaseLayerFilter(), layers.CHARACTER),
      new Jolt.DefaultObjectLayerFilter(engine.GetObjectLayerPairFilter(), layers.CHARACTER),
      new Jolt.BodyFilter(), new Jolt.ShapeFilter(),
    ];
    this.allocator = engine.GetTempAllocator();
  }

  place(x, y, z) {
    this.position.Set(x, y + CENTER_HEIGHT, z);
    this.character.SetPosition(this.position);
    this.velocity.Set(0, 0, 0);
    this.character.SetLinearVelocity(this.velocity);
    this.character.RefreshContacts(...this.filters, this.allocator);
  }

  move(dt, player, jump) {
    const { character, velocity, physics } = this;
    const grounded = player.grounded;
    const previousY = player.y;
    let vy = grounded ? 0 : player.vy;
    const takingOff = grounded && jump && !player.swimming;
    if (takingOff) vy = 5;
    let vertical = vy - 18 * dt;
    if (grounded && vy === 0 && character.GetGroundState() === physics.Jolt.EGroundState_OnGround) {
      const normal = character.GetGroundNormal();
      if (normal.GetY() >= Math.SQRT1_2) {
        vertical = -(normal.GetX() * player.vx + normal.GetZ() * player.vz) / normal.GetY();
      }
    }
    if (player.swimming) {
      vertical = Math.max(-2, Math.min(2, (player.world.heightAt(player.x, player.z) - player.y) * 8));
    }
    this.settings.mStickToFloorStepDown.Set(0, player.swimming ? 0 : -0.35, 0);
    velocity.Set(player.vx, vertical, player.vz);
    character.SetLinearVelocity(velocity);
    const contacts = character.GetActiveContacts();
    let stepHeight = 0.35;
    for (let i = 0; i < contacts.size(); i++) {
      const hit = contacts.at(i);
      if (hit.mUserData === layers.RAILING) { stepHeight = 0; break; }
    }
    this.settings.mWalkStairsStepUp.Set(0, stepHeight, 0);
    character.ExtendedUpdate(dt, physics.system.GetGravity(), this.settings, ...this.filters, this.allocator);
    const pos = character.GetPosition();
    player.x = pos.GetX();
    player.y = pos.GetY() - CENTER_HEIGHT;
    player.z = pos.GetZ();
    player.grounded = character.GetGroundState() === physics.Jolt.EGroundState_OnGround && !takingOff;
    // Vysunutí kapsle z hrany či pomocný krok na schod jí nesmějí udělit rychlost skoku.
    player.vy = player.grounded ? 0 : Math.min(vy - 18 * dt, (player.y - previousY) / dt);
    if (player.swimming) {
      player.vy = vertical;
      player.fallStart = player.y;
      return 0;
    }
    if (grounded) player.fallStart = previousY;
    player.fallStart = Math.max(player.fallStart, player.y);
    return !grounded && player.grounded ? Math.max(0, player.fallStart - player.y - 5) * 6 : 0;
  }

  dispose() {
    const { Jolt } = this.physics;
    for (const object of [this.character, this.settings, ...this.filters, this.velocity, this.position]) {
      Jolt.destroy(object);
    }
  }
}
