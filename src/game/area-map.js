import { ACTIVITY_SITES } from './activity-sites.js';
import { POLICE_STATIONS } from './police-stations.js';
import { initMapSearch } from './map-search.js';
import { MapView, insideMap } from './map-view.js';
import { drawAreaMap } from './map-drawing.js';
import { travelBounds } from '../world/travel-bounds.js';

const el = id => document.getElementById(id);
const distanceText = metres => metres < 1000 ? Math.round(metres) + ' m'
  : (metres / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) + ' km';

export class AreaMap {
  constructor(game, onClose) {
    this.onClose = onClose;
    this.game = game;
    this.canvas = el('bigmap-canvas');
    this.pointers = new Map();
    this.frame = 0;
    const { world } = game;
    const priority = { city:0, town:1, village:2, suburb:3 };
    this.places = world.meta.places.filter(place => Object.hasOwn(priority,place[3]))
      .sort((a,b)=>priority[a[3]] - priority[b[3]]);
    this.sites = (world.sady?.solids ?? []).filter(site => !site.wall)
      .map(({ x, z, name, walk }) => ({ x, z, name, walk, exact: true }));
    this.sites.push(...game.bikes.mapSites());
    this.sites.push(...POLICE_STATIONS.map(station => ({ ...station, exact: true, police: true })));
    this.sites.push(...ACTIVITY_SITES.map(site => ({ ...site, exact: true, activity: true })));
    initMapSearch(world, place => this.select(place, true), game.transit.timetable.stops, this.sites);
    this.bindGestures();
    el('map-cancel').onclick = () => {
      game.jobs.waypoint = null;
      game.jobs.walking.clear();
      if (!game.jobs.job) game.jobs.route = null;
      this.clearPreview();
      this.redraw();
    };
    el('map-home').onclick = () => {
      this.view.home(game.focus.x, game.focus.z);
      this.clearPreview();
      this.redraw();
    };
    el('map-overview').onclick = () => { this.view.overview(); this.redraw(); };
    el('map-zoom-in').onclick = () => { this.view.zoom(1.6); this.redraw(); };
    el('map-zoom-out').onclick = () => { this.view.zoom(1/1.6); this.redraw(); };
    el('map-go').onclick = () => {
      const place = this.selected;
      if (!place || !insideMap(this.view.area, place.x, place.z)) return;
      game.jobs.setWaypoint(place.x, place.z, place.name, place.stop || place.exact, place.walk);
      game.toggleMap(false);
    };
    el('bigmap-close').onclick = () => game.toggleMap(false);
    new ResizeObserver(() => {
      if (!game.mapOpen || !this.view) return;
      this.view.resize(this.canvas.clientWidth, this.canvas.clientHeight);
      this.redraw();
    }).observe(this.canvas);
  }

  open() {
    const { world, mode, focus } = this.game;
    this.view = new MapView(travelBounds(world,mode), this.canvas.clientWidth, this.canvas.clientHeight, focus.x, focus.z);
    this.clearPreview();
    el('map-mode').textContent = ({foot:'Pěšky',bike:'Na kole',car:'Autem',heli:'Vrtulníkem',transit:'MHD'})[mode];
    this.render();
  }

  clearPreview() {
    this.selected = null;
    el('map-selection').hidden = true;
  }

  close() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pointers.clear();
    el('bigmap-query').value = '';
    el('bigmap-results').replaceChildren();
    this.onClose?.();
  }

  render() {
    el('map-cancel').hidden = !this.game.jobs.waypoint;
    el('map-route-status').textContent = this.game.jobs.waypoint ? this.game.jobs.roadStatus || this.game.jobs.walking.status || '' : '';
    drawAreaMap(this.canvas, this.game, this.view, this.selected);
    const length = 86 / this.view.scale;
    const magnitude = 10 ** Math.floor(Math.log10(length));
    const metres = ([5,2,1].find(n => n*magnitude <= length) ?? 1) * magnitude;
    const bar = el('map-scale');
    bar.textContent = distanceText(metres);
    bar.style.width = metres * this.view.scale + 'px';
  }

  redraw() {
    if (!this.frame) this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.game.mapOpen) this.render();
    });
  }

  select(place, center = false) {
    const { world, focus } = this.game;
    if (insideMap(this.view.area, place.x, place.z) && !place.name) {
      const range = Math.min(28, 14 / this.view.scale);
      let closest = Infinity, nearest = null;
      for (const site of [...this.sites, ...this.game.jobs.landmarks]) {
        const distance = Math.hypot(site.x-place.x, site.z-place.z);
        const hitRadius = site.activity || site.bike ? 12 / this.view.scale : range;
        if (distance < hitRadius && distance < closest) { closest = distance; nearest = site; }
      }
      if (nearest) place = nearest;
      else {
        const road = world.nearestRoad(place.x, place.z, 18);
        place.name = (road && world.roadNames[world.r.name[road.road]]) || 'Vybrané místo';
      }
    }
    const approach = place.walk ?? (!place.stop && world.meta.walkingApproaches?.[place.name]);
    if (approach) place = { ...place, x: approach.at(-2), z: approach.at(-1), walk: approach };
    const allowed = insideMap(this.view.area, place.x, place.z);
    this.selected = place;
    if (center) this.view.home(place.x,place.z);
    el('map-selection').hidden = false;
    el('map-name').textContent = allowed ? place.title ?? place.name : 'Mimo herní oblast';
    el('map-distance').textContent = distanceText(Math.hypot(place.x-focus.x,place.z-focus.z)) + ' od tebe';
    const access = el('map-access');
    access.textContent = allowed ? place.bike ? this.game.bikes.access(place) : place.access ?? '' : '';
    access.hidden = !access.textContent;
    el('map-go').hidden = !allowed;
    this.redraw();
  }

  bindGestures() {
    const canvas = this.canvas, points = this.pointers;
    const local = event => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };
    const pair = () => {
      const [a,b] = points.values();
      return { u:(a[0]+b[0])/2, v:(a[1]+b[1])/2, span:Math.hypot(a[0]-b[0],a[1]-b[1]) };
    };
    canvas.addEventListener('keydown', event => {
      const arrows = { ArrowLeft:[70,0], ArrowRight:[-70,0], ArrowUp:[0,70], ArrowDown:[0,-70] };
      if (arrows[event.key]) this.view.move(...arrows[event.key]);
      else if (event.key === 'Enter') this.select({ x:this.view.x, z:this.view.z });
      else return;
      event.preventDefault(); event.stopPropagation(); this.redraw();
    });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      this.view.zoom(Math.exp(-Math.max(-600, Math.min(600,event.deltaY*unit)) * .002), ...local(event));
      this.redraw();
    }, {passive:false});
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      const position = local(event);
      if (!points.size) { this.start = position; this.dragged = false; }
      else this.dragged = true;
      points.set(event.pointerId, position);
    });
    canvas.addEventListener('pointermove', event => {
      const previous = points.get(event.pointerId);
      if (!previous) return;
      const pos = local(event);
      if (points.size === 1) {
        if (!this.dragged && Math.hypot(pos[0]-this.start[0],pos[1]-this.start[1]) < 5) return;
        this.dragged = true;
        this.view.move(pos[0]-previous[0], pos[1]-previous[1]);
        points.set(event.pointerId,pos);
      } else {
        const before = pair(); points.set(event.pointerId,pos); const after = pair();
        if (before.span > 1 && after.span > 1) this.view.zoom(after.span/before.span,before.u,before.v);
        this.view.move(after.u-before.u,after.v-before.v);
      }
      this.redraw();
    });
    canvas.addEventListener('pointerup', event => {
      if (!points.delete(event.pointerId)) return;
      if (!this.dragged && points.size === 0) this.select(this.view.world(...local(event)));
    });
    for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, event => {
      if (points.delete(event.pointerId)) this.dragged = true;
    });
  }
}
