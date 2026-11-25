import { WalkingMap } from '../world/walking-map.js';

export class WalkingGuide {
  constructor(world) {
    this.world = world;
  }

  clear() {
    this.map = this.search = this.start = this.target = this.path = null;
    this.status = '';
  }

  update(waypoint, mode, focus, arrivalRoad) {
    const driving = mode === 'car';
    const start = driving ? arrivalRoad : focus;
    if (!waypoint || !start || (mode !== 'foot' && !driving) ||
        (driving && (waypoint.walk || Math.hypot(start.x-waypoint.x,start.z-waypoint.z) < 8))) {
      if (this.target) this.clear();
      return;
    }
    const target = { x: waypoint.x, z: waypoint.z, y: this.world.groundY(waypoint.x,waypoint.z) };
    const from = { x: start.x, z: start.z, y: start.y ?? this.world.groundY(start.x,start.z) };
    if (this.target !== waypoint || this.mode !== mode || (!this.search && Math.hypot(from.x-this.start.x,from.z-this.start.z,from.y-this.start.y) > 8)) {
      if (!this.map || !this.map.contains(from) || !this.map.contains(target)) this.map = new WalkingMap(this.world,from,target);
      this.start = from;
      this.target = waypoint;
      this.mode = mode;
      this.path = null;
      this.status = 'Hledám pěší cestu…';
      this.search = this.map.directions(from,target);
    }
    if (!this.search) return;
    const until = performance.now()+1.2;
    do {
      const next = this.search.next();
      if (next.done) {
        this.search = null;
        this.path = next.value;
        this.status = this.path ? (driving ? 'Od konce příjezdu pokračuj pěšky.' : 'Pěší trasa') : 'Pěší cestu k cíli se nepodařilo najít.';
        return;
      }
    } while (performance.now() < until);
  }
}
