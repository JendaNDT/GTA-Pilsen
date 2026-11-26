import { parsePack } from '../data.js';
import { CycleNetwork } from '../world/cycle-network.js';
import { canJoin } from '../world/walking-map.js';
import { BIKE_STATIONS } from './bike-stations.js';

const OUTSIDE = 'Cyklistická navigace pokrývá Plzeň a nejbližší okolí.';
const NO_ROUTE = 'Průjezdnou trasu pro kolo se nepodařilo najít.';
// U muzea vede výjezd kolem vybavení před veřejným vstupem do Kopeckého sadů.
const MUSEUM_ID = '43';
const MUSEUM_ACCESS = [[78, 300], [78, 314], [79, 322.5]];
const museumStation = BIKE_STATIONS.find(station => station.id === MUSEUM_ID);

export class BikeGuide {
  constructor(world) {
    this.world = world;
    this.museum = world.gpsToWorld(museumStation.lat, museumStation.lon);
    this.clear();
  }

  clear() {
    this.target = this.start = this.search = this.path = null;
    this.status = '';
  }

  load() {
    const base = import.meta.env?.BASE_URL || '/';
    this.loading = fetch(base + 'data/cycle-network.bin', { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Chybí cyklistická síť.');
        return response.arrayBuffer();
      }).then(buffer => {
        const pack = parsePack(buffer);
        if (pack.header.osmTimestamp !== this.world.meta.osmTimestamp) throw new Error('Cyklistická síť patří k jiné mapě.');
        this.network = new CycleNetwork(pack);
        this.preparation = this.network.prepare();
      }).catch(() => {
        if (this.target) this.status = 'Cyklistickou síť se nepodařilo načíst.';
      })
      .finally(() => { this.loading = null; });
  }

  connect(point, candidate, level) {
    const { world } = this, { x, z, distance } = candidate;
    const ground = world.heightAt(x, z);
    const y = level > 0 ? world.deckAt(x, z, point.y + 2) :
      level < 0 ? world.tunnelAt(x, z, point.y, 0, true)?.floor :
      world.groundY(x, z, Math.min(ground + 1, point.y + 1));
    return Number.isFinite(y) && Math.abs(point.y - y) <= Math.max(1.6, distance * .20) &&
      canJoin(world, point, { x, z, y });
  }

  *route(from, to, toMuseum) {
    const fromMuseum = Math.hypot(from.x - this.museum.x, from.z - this.museum.z) < 3.4;
    if (fromMuseum && toMuseum) return [from.x, from.z, to.x, to.z];
    const join = (a, b, level) => this.connect(a, b, level);
    if (!fromMuseum && !toMuseum) return yield* this.network.route(from, to, join);
    const [x, z] = MUSEUM_ACCESS.at(-1);
    const access = { x, z, y: this.world.groundY(x, z) };
    const path = yield* this.network.route(fromMuseum ? access : from, toMuseum ? access : to, join);
    if (!path) return null;
    if (fromMuseum) path.unshift(from.x, from.z, ...MUSEUM_ACCESS.slice(0, -1).flat());
    if (toMuseum) path.push(...MUSEUM_ACCESS.slice(0, -1).reverse().flat(), to.x, to.z);
    return path;
  }

  update(target, focus) {
    if (!target) {
      if (this.target) this.clear();
      return;
    }
    if (this.target !== target) {
      this.clear();
      this.target = target;
      if (!this.network && !this.loading) this.load();
      this.status = 'Hledám cyklistickou trasu…';
    }
    if (!this.network) return;

    const until = performance.now() + 1.2;
    while (this.preparation && performance.now() < until) {
      if (this.preparation.next().done) this.preparation = null;
    }
    if (this.preparation) return;

    const moved = !this.start || Math.hypot(this.start.x - focus.x, this.start.z - focus.z, this.start.y - focus.y) > 22;
    if (!this.search && moved) {
      const { x, y, z } = focus;
      this.start = { x, y, z };
      const [minX, minZ, maxX, maxZ] = this.network.pack.header.bounds;
      const covered = p => p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
      if (!covered(focus) || !covered(target)) {
        this.path = null;
        this.status = OUTSIDE;
        return;
      }
      const destination = { x: target.x, z: target.z, y: target.y ?? this.world.groundY(target.x, target.z) };
      this.search = this.route(this.start, destination, target.bikeStation === MUSEUM_ID);
      if (!this.path) this.status = 'Hledám cyklistickou trasu…';
    }
    if (!this.search) return;
    do {
      const next = this.search.next();
      if (!next.done) continue;
      this.search = null;
      this.path = next.value;
      this.status = this.path ? 'Cyklistická trasa' : NO_ROUTE;
      return;
    } while (performance.now() < until);
  }
}
