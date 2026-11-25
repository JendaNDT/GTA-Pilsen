// Čáry sledují přímo trojúhelníky terénu i na hranici mezi dlaždicemi.
export function paintStadium(g) {
  g.save();
  g.translate(545, -278);
  g.rotate(Math.atan2(0.97, 0.242));
  for (let i = 0; i < 18; i++) {
    g.fillStyle = i % 2 ? '#548845' : '#659650';
    g.fillRect(-54 + i * 6, -35, 6, 70);
  }
  g.strokeStyle = '#f2efdb';
  g.lineWidth = 0.42;
  g.strokeRect(-52.5, -34, 105, 68);
  g.beginPath();
  g.moveTo(0, -34);
  g.lineTo(0, 34);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 9.15, 0, 2 * Math.PI);
  g.stroke();
  for (const sign of [-1, 1]) {
    for (const [depth, radius] of [
      [16.5, 20.16],
      [5.5, 9.16],
    ]) {
      g.strokeRect(sign * 52.5, -radius, -sign * depth, 2 * radius);
    }
    g.fillStyle = '#f2efdb';
    g.beginPath();
    g.arc(sign * 41.5, 0, 0.34, 0, 2 * Math.PI);
    g.fill();
  }
  g.restore();
}
