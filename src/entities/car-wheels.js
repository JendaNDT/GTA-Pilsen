// Lokální osa x je náprava, z míří k přídi. Všechna kola vozu sdílejí jednu geometrii.
import { DynamicDrawUsage, InstancedMesh, Object3D, Sphere, Vector3 } from 'three/webgpu';

const pose = new Object3D();

export function makeCarWheels(geometry, material, chassis, animated) {
  const wheels = new InstancedMesh(geometry, material, 4);
  wheels.instanceMatrix.setUsage(DynamicDrawUsage);
  wheels.castShadow = true;
  const { wheelX, wheelZ, wheelR } = chassis;
  wheels.userData = { wheelX, wheelZ, wheelR, animated, roll: 0 };
  wheels.boundingSphere = new Sphere(new Vector3(0, wheelR, 0), Math.hypot(wheelX, wheelZ) + wheelR + 0.12);
  setWheelMatrices(wheels, 0, 0);
  return wheels;
}

function setWheelMatrices(wheels, steer, roll, physical, lag = 0) {
  const { wheelX, wheelZ, wheelR } = wheels.userData;
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? -1 : 1;
    const front = i < 2;
    const wheel = physical?.[i];
    const yaw = wheel ? wheel.GetSteerAngle() : front ? steer : 0;
    const spin = wheel ? wheel.GetRotationAngle() - wheel.GetAngularVelocity() * lag : roll;
    pose.position.set(side * wheelX, wheelR, front ? wheelZ : -wheelZ);
    pose.rotation.set(side * spin, yaw + (side < 0 ? Math.PI : 0), 0, 'YXZ');
    pose.updateMatrix();
    wheels.setMatrixAt(i, pose.matrix);
  }
  wheels.instanceMatrix.needsUpdate = true;
}

export function updateCarWheels(car, dt, physical, lag) {
  const wheels = car.mesh.userData.wheels;
  if (!wheels.userData.animated) return;
  const state = wheels.userData;
  if (physical) {
    state.roll = physical[0].GetRotationAngle();
  } else {
    if (car.mode === 'parked' && !state.wasMoving) return;
    state.roll = (state.roll + car.speed * dt / state.wheelR) % (2 * Math.PI);
  }
  state.wasMoving = car.mode !== 'parked';
  setWheelMatrices(wheels, -car.steer, state.roll, physical, lag);
}
