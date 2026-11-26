const ASSIST_LIMIT = 25 / 3.6;
export const BIKE_RADIUS = 0.33;

export function pedalSpeed(speed, pedal, brake, grade, dt) {
  if (brake) return Math.max(0, speed - 5.5 * brake * dt);
  const assist = Math.max(0, Math.min(1, (ASSIST_LIMIT - speed) / 1.2));
  const force = pedal * (0.56 + assist * 2.65) - 0.18 - 0.064 * speed - grade * 6.3;
  return Math.max(0, Math.min(10, speed + force * dt));
}

export function bikeTurn(speed, steer) {
  return steer * speed * 0.82 / (1 + speed * speed * 0.115);
}
