const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Vzorek trasy leží před středem auta. Úhel kol počítáme od zadní nápravy.
export function driveRoute(car, pointAt, speedLimit, stopGap, previous, dt) {
  const speed = Math.max(0, car.speed);
  const look = 2.5 + Math.min(7, speed * 0.45);
  const point = pointAt(look);
  const dx = point.x - car.x, dz = point.z - car.z;
  const sin = Math.sin(car.yaw), cos = Math.cos(car.yaw);
  const across = dx * cos - dz * sin;
  const wheelbase = car.type.len * 0.64;
  const along = dx * sin + dz * cos + wheelbase / 2;
  const curvature = 2 * across / Math.max(0.1, along * along + across * across);
  const steer = clamp(-Math.atan(wheelbase * curvature) / 0.62, -1, 1);

  const room = Math.max(0, stopGap - 0.55);
  const targetSpeed = Math.max(0, Math.min(speedLimit, Math.sqrt(3.4 / Math.max(0.001, Math.abs(curvature))),
    Math.sqrt(6 * room), 1.8 * room));
  const error = targetSpeed - car.speed;
  const derivative = previous && dt > 0 ? (error - previous.error) / dt : 0;
  const integral = targetSpeed < 0.12 ? 0 : clamp((previous?.integral ?? 0) + error * dt, -1, 1);
  const stopping = Number.isFinite(room) && targetSpeed < speedLimit;
  const deceleration = stopping ? Math.min(3, 1.8 * speed) : 0;
  const effort = -deceleration + 1.6 * error + 0.45 * integral + 0.12 * clamp(derivative, -10, 10);
  const hold = targetSpeed < 0.12 && speed < 0.18;
  return { targetSpeed, steer, throttle: hold ? 0 : clamp(effort / 3.5, 0, 1),
    brake: hold ? 1 : clamp(-effort / 8, 0, 1),
    integral, error };
}
