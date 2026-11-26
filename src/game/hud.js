import { formatDay, formatTime, WEEKDAYS, weekday } from './clock.js';
// Ukazatele na obrazovce, minimapa a velká mapa.
import { CHUNK, DRIVABLE_MAX, RC, LC, BF } from '../config.js';

const $ = (id) => document.getElementById(id);

const MAP_LAND = {
  [LC.FARMLAND]: '#3a4436', [LC.MEADOW]: '#35483a', [LC.GRASS]: '#35503c', [LC.RESIDENTIAL]: '#343f49',
  [LC.COMMERCIAL]: '#37414a', [LC.INDUSTRIAL]: '#3a4047', [LC.RAILWAY]: '#3b3d42', [LC.ALLOTMENTS]: '#365039',
  [LC.CEMETERY]: '#33493a', [LC.FOREST]: '#274b34', [LC.SCRUB]: '#2e4d38', [LC.PARK]: '#2f5a3c',
  [LC.PITCH]: '#356a44', [LC.PARKING]: '#3c444c', [LC.PLAZA]: '#4a5058', [LC.WATER]: '#2d6394',
  [LC.SAND]: '#6b6650', [LC.CONSTRUCTION]: '#484640', [LC.GARDEN]: '#30553b', [LC.PLAYGROUND]: '#55543f',
};
const MAP_BG = '#2b353e';

/** Kreslí mapové dlaždice (512 m) do mezipaměti; používá je minimapa. */
export class MapTiles {
  constructor(world) {
    this.world = world;
    this.T = 512; this.PX = 384;
    this.tiles = new Map();
    this.budget = 0;
    const L = world.l;
    this.cols = Math.ceil((world.maxX - world.minX) / this.T);
    this.rows = Math.ceil((world.maxZ - world.minZ) / this.T);
    this.land = new Array(this.cols * this.rows);
    for (let i = 0; i < world.lCount; i++) {
      const r0 = L.pRing[i];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let v = L.ringStart[r0], ve = L.ringStart[L.pRing[i + 1]]; v < ve; v++) {
        const x = L.vx[v] * 0.1, z = L.vz[v] * 0.1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const a0 = Math.max(0, Math.floor((x0 - world.minX) / this.T)), a1 = Math.min(this.cols - 1, Math.floor((x1 - world.minX) / this.T));
      const b0 = Math.max(0, Math.floor((z0 - world.minZ) / this.T)), b1 = Math.min(this.rows - 1, Math.floor((z1 - world.minZ) / this.T));
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) (this.land[b * this.cols + a] || (this.land[b * this.cols + a] = [])).push(i);
    }
  }

  landPath(g, i) {
    const L = this.world.l;
    g.beginPath();
    for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
      const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
      for (let v = v0; v < v1; v++) {
        if (v === v0) g.moveTo(L.vx[v] * 0.1, L.vz[v] * 0.1); else g.lineTo(L.vx[v] * 0.1, L.vz[v] * 0.1);
      }
      g.closePath();
    }
  }

  drawRoads(g, ci, major) {
    const w = this.world, pieces = w.rPieces[ci];
    if (!pieces) return;
    const R = w.r, px = w.rpx, pz = w.rpz;
    for (let q = 0; q < pieces.length; q += 3) {
      const i = pieces[q], cls = R.cls[i];
      const isMajor = cls <= RC.TERTIARY_LINK;
      if (isMajor !== major) continue;
      if (cls > RC.PEDESTRIAN) continue;
      g.beginPath();
      g.moveTo(px[pieces[q + 1]], pz[pieces[q + 1]]);
      for (let k = pieces[q + 1] + 1; k <= pieces[q + 2]; k++) g.lineTo(px[k], pz[k]);
      g.lineWidth = Math.max(R.w[i], major ? 7 : 4.5);
      g.strokeStyle = major ? '#c5ccd3' : cls === RC.SERVICE ? '#69757f' : cls === RC.PEDESTRIAN ? '#8e8a80' : '#8d99a3';
      g.stroke();
    }
  }

  build(tx, tz) {
    const w = this.world;
    const cv = document.createElement('canvas');
    cv.width = cv.height = this.PX;
    const g = cv.getContext('2d');
    const s = this.PX / this.T;
    const x0 = w.minX + tx * this.T, z0 = w.minZ + tz * this.T;
    g.fillStyle = MAP_BG; g.fillRect(0, 0, this.PX, this.PX);
    g.setTransform(s, 0, 0, s, -x0 * s, -z0 * s);
    const land = this.land[tz * this.cols + tx];
    const c0x = Math.floor((x0 - w.minX) / CHUNK) - 1, c0z = Math.floor((z0 - w.minZ) / CHUNK) - 1;
    const n = this.T / CHUNK + 2;
    const each = (fn) => {
      for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) {
        const cx = c0x + dx, cz = c0z + dz;
        if (cx < 0 || cz < 0 || cx >= w.cols || cz >= w.rows) continue;
        fn(cz * w.cols + cx);
      }
    };
    this.drawLayers(g, land, each);
    return cv;
  }

  drawLayers(g, land, each) {
    const w = this.world;
    if (land) for (const i of land) { this.landPath(g, i); g.fillStyle = MAP_LAND[w.l.cls[i]] || MAP_BG; g.fill('evenodd'); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    each((ci) => this.drawRoads(g, ci, false));
    each((ci) => this.drawRoads(g, ci, true));
    // koleje tramvají
    g.strokeStyle = '#b08d2e'; g.lineWidth = 1.6;
    each((ci) => {
      const rails = w.railChunks[ci];
      if (!rails) return;
      for (const ri of rails) {
        const r = w.rails[ri];
        if (r.cls !== 0) continue;
        g.beginPath(); g.moveTo(r.pts[0], r.pts[1]);
        for (let k = 2; k < r.pts.length; k += 2) g.lineTo(r.pts[k], r.pts[k + 1]);
        g.stroke();
      }
    });
    g.fillStyle = '#566472';
    const B = w.b;
    each((ci) => {
      const list = w.bChunks[ci];
      if (!list) return;
      g.beginPath();
      for (const i of list) {
        if (B.flags[i] & BF.PART) continue;
        const rg = B.bRing[i];
        const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
        g.moveTo(w.bvx[v0], w.bvz[v0]);
        for (let v = v0 + 1; v < v1; v++) g.lineTo(w.bvx[v], w.bvz[v]);
        g.closePath();
      }
      g.fill();
    });

  }

  get(tx, tz) {
    if (tx < 0 || tz < 0 || tx >= this.cols || tz >= this.rows) return null;
    const key = tz * this.cols + tx;
    let t = this.tiles.get(key);
    if (!t) {
      if (this.budget <= 0) return null;
      this.budget--;
      t = this.build(tx, tz);
      this.tiles.set(key, t);
      if (this.tiles.size > 40) this.tiles.delete(this.tiles.keys().next().value);
    }
    return t;
  }
}

export class Hud {
  constructor(world) {
    this.world = world;
    this.tiles = new MapTiles(world);
    this.el = {
      hud: $('hud'), money: $('money'), wanted: $('wanted'), health: $('health').firstElementChild,
      street: $('street'), district: $('district'), mission: $('mission'), toast: $('toast'),
      prompt: $('prompt'), action: $('tb-act'), speedo: $('speedo'), kmh: $('kmh'), speedlimit: $('speedlimit'), vehname: $('vehname'), clock: $('clock'),
      clockTime: $('clock-time'), clockDay: $('clock-day'), mapDate: $('bigmap-date'),
      stopBoard: $('stop-board'), stopName: $('stop-name'), stopDepartures: $('stop-departures'), stopTransfer: $('stop-transfer'),
      minimap: $('minimap'), touch: $('touch'),
    };
    this.el.wanted.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    this.mm = this.el.minimap.getContext('2d');
    this.cache = {};
    this.frame = 0;
    this.big = null;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  _set(key, value, fn) { if (this.cache[key] !== value) { this.cache[key] = value; fn(value); } }

  money(v) { this._set('money', Math.round(v), (x) => { this.el.money.textContent = `${x.toLocaleString('cs-CZ')} Kč`; }); }
  wanted(n) { this._set('wanted', n, (x) => { [...this.el.wanted.children].forEach((c, i) => c.classList.toggle('on', i < x)); }); }
  health(p) { this._set('health', Math.round(p), (x) => { this.el.health.style.width = `${x}%`; this.el.health.style.background = x > 50 ? '#5fd38d' : x > 25 ? '#f2b632' : '#e2483d'; }); }
  place(street, district) {
    this._set('street', street, (x) => { this.el.street.textContent = x; });
    this._set('district', district, (x) => { this.el.district.textContent = x; });
  }
  clock(calendar, visible) {
    this._set('clockVisible', visible, (value) => {
      this.el.clock.classList.toggle('hidden', !value);
      this.el.mapDate.classList.toggle('hidden', !value);
    });
    this._set('clockMinute', Math.floor(calendar.seconds / 60), () => {
      const time = formatTime(calendar.seconds);
      this.el.clockTime.dateTime = time;
      this.el.clockTime.textContent = time;
    });
    this._set('clockDate', calendar.day, (day) => {
      const name = WEEKDAYS[weekday(day)];
      this.el.clockDay.textContent = name;
      const iso = formatDay(day), [year, month, date] = iso.split('-');
      const time = this.el.mapDate.firstElementChild;
      time.dateTime = iso;
      time.textContent = `${name} ${Number(date)}. ${Number(month)}. ${year}`;
    });
  }

  departures(board) {
    const key = board ? JSON.stringify(board) : '';
    this._set('departures', key, () => {
      this.el.stopBoard.classList.toggle('hidden', !board);
      if (!board) return;
      const platform = board.code?.split('/')[1];
      this.el.stopName.textContent = platform ? `${board.stop} · stan. ${platform}` : board.stop;
      const nodes = board.rows.map(({ time, ref, type, destination, lastStop, boarding, delayed }) => {
        const row = document.createElement('li'), departure = document.createElement('time');
        departure.dateTime = formatTime(time);
        departure.textContent = boarding ? 'Nyní' : departure.dateTime;
        departure.classList.toggle('boarding', boarding);
        const line = document.createElement('b');
        line.className = `line-${type}`;
        line.textContent = ref;
        const label = document.createElement('span'), caption = document.createElement('small');
        label.textContent = destination;
        caption.textContent = [!boarding && delayed ? 'Odhad odjezdu' : '', lastStop ? `Na mapě do ${lastStop}` : '']
          .filter(Boolean).join(' · ');
        row.append(departure, line, label);
        if (caption.textContent) row.append(caption);
        return row;
      });
      if (!nodes.length) {
        const empty = document.createElement('li');
        empty.textContent = 'Bez odjezdu v příštích 90 min';
        nodes.push(empty);
      }
      this.el.stopDepartures.replaceChildren(...nodes);
      this.el.stopTransfer.hidden = !board.nearby;
      const transfer = board.nearby;
      if (transfer) this.el.stopTransfer.textContent = `Přestup · ${transfer.name}${transfer.platform ? ` (stan. ${transfer.platform})` : ''} · ${transfer.metres} m`;
    });
  }
  speed(kmh, name) {
    this._set('speedoOn', kmh !== null, (on) => this.el.speedo.classList.toggle('hidden', !on));
    if (kmh === null) return;
    this._set('kmh', Math.round(Math.abs(kmh)), (x) => { this.el.kmh.textContent = x; });
    this._set('vehname', name, (x) => { this.el.vehname.textContent = x; });
  }
  speedLimit(limit) {
    this._set('speedlimit', limit, (value) => {
      this.el.speedlimit.textContent = value || '';
      this.el.speedlimit.classList.toggle('hidden', !value);
    });
  }
  prompt(html, actionLabel = 'Akce (F)') {
    this._set('prompt', html || '', (x) => { this.el.prompt.innerHTML = x; this.el.prompt.classList.toggle('hidden', !x); });
    this._set('actionLabel', actionLabel, (x) => this.el.action.setAttribute('aria-label', x));
  }
  mission(html) {
    this._set('mission', html || '', (x) => { this.el.mission.innerHTML = x; this.el.mission.classList.toggle('hidden', !x); });
  }
  toast(text, cls = '', ms = 3600) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    this.el.toast.appendChild(d);
    while (this.el.toast.children.length > (innerHeight < 520 ? 2 : 3)) this.el.toast.firstElementChild.remove();
    setTimeout(() => d.remove(), ms);
  }

  /** Minimapa: střed = hráč, nahoře = směr pohledu kamery. */
  minimap(px, pz, camYaw, heading, markers, route, walkRoute) {
    this.frame++;
    if (this.frame % 2) return;
    this.tiles.budget = 1;
    const g = this.mm, S = this.el.minimap.width, R = S / 2;
    const radius = 240, k = R / radius;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = MAP_BG; g.fillRect(0, 0, S, S);
    g.save();
    g.translate(R, R);
    const theta = camYaw - Math.PI;
    g.rotate(theta);
    g.scale(k, k);
    g.translate(-px, -pz);
    const T = this.tiles.T, w = this.world;
    const reach = radius * 1.45;
    const tx0 = Math.floor((px - reach - w.minX) / T), tx1 = Math.floor((px + reach - w.minX) / T);
    const tz0 = Math.floor((pz - reach - w.minZ) / T), tz1 = Math.floor((pz + reach - w.minZ) / T);
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.tiles.get(tx, tz);
      if (t) g.drawImage(t, w.minX + tx * T, w.minZ + tz * T, T + 0.5, T + 0.5);
    }
    if (route && route.length >= 4) {
      g.beginPath(); g.moveTo(px, pz);
      for (let i = 0; i < route.length; i += 2) g.lineTo(route[i], route[i + 1]);
      g.strokeStyle = '#f2b632'; g.lineWidth = 9; g.lineJoin = 'round'; g.lineCap = 'round'; g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1;
    }
    this._drawWalk(g, walkRoute, 1 / k);
    this._drawClosures(g, 1 / k);
    g.restore();
    // značky (držené na okraji, když jsou mimo)
    const cos = Math.cos(theta), sin = Math.sin(theta);
    for (const m of markers) {
      let dx = (m.x - px) * k, dz = (m.z - pz) * k;
      let sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
      const d = Math.hypot(sx, sy), lim = R - 9;
      if (d > lim) { if (m.local) continue; sx *= lim / d; sy *= lim / d; }
      g.beginPath();
      g.arc(R + sx, R + sy, m.size || 5, 0, Math.PI * 2);
      g.fillStyle = m.color; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = '#101820'; g.stroke();
    }
    // hráč
    g.save();
    g.translate(R, R);
    g.rotate(Math.PI - (heading - theta));
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#101820'; g.stroke();
    g.restore();
    // sever
    const nx = R + (0 * cos - -1 * sin) * (R - 12), ny = R + (0 * sin + -1 * cos) * (R - 12);
    g.fillStyle = '#e2483d'; g.font = 'bold 13px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('S', nx, ny);
  }

  // ---------------------------------------------------------- velká mapa ----
  _drawWalk(g, route, pixel) {
    if (!route?.length) return;
    g.save();
    g.beginPath(); g.moveTo(route[0], route[1]);
    for (let i = 2; i < route.length; i += 2) g.lineTo(route[i], route[i + 1]);
    g.setLineDash([1, 4].map((n) => n * pixel));
    g.lineWidth = 2.8 * pixel; g.lineCap = 'round'; g.strokeStyle = '#75d9ff'; g.stroke();
    g.restore();
  }

  _drawClosures(g, pixel) {
    g.save();
    g.beginPath();
    for (const [x, z, dx, dz, width] of this.world.roadClosures) {
      const half = Math.max(width / 2 + 1, 3.4 * pixel);
      g.moveTo(x - dz * half, z + dx * half); g.lineTo(x + dz * half, z - dx * half);
    }
    g.lineCap = 'round';
    g.lineWidth = 4.4 * pixel; g.strokeStyle = '#161b20'; g.stroke();
    g.lineWidth = 2.1 * pixel; g.strokeStyle = '#ff625b'; g.stroke();
    g.restore();
  }

  _bigBase(pw, ph) {
    const w = this.world;
    const cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    const g = cv.getContext('2d');
    const s = pw / (w.playMaxX - w.playMinX);
    g.fillStyle = MAP_BG; g.fillRect(0, 0, pw, ph);
    g.setTransform(s, 0, 0, s, -w.playMinX * s, -w.playMinZ * s);
    for (let i = 0; i < w.lCount; i++) {
      const col = MAP_LAND[w.l.cls[i]];
      if (!col) continue;
      this.tiles.landPath(g, i); g.fillStyle = col; g.fill('evenodd');
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const R = w.r, px = w.rpx, pz = w.rpz;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < w.rCount; i++) {
        const cls = R.cls[i];
        if (cls > DRIVABLE_MAX || cls === RC.SERVICE) continue;
        const major = cls <= RC.TERTIARY_LINK;
        if (major !== (pass === 1)) continue;
        g.beginPath();
        const a = w.rOff[i], b = w.rOff[i + 1];
        g.moveTo(px[a], pz[a]);
        for (let k = a + 1; k < b; k++) g.lineTo(px[k], pz[k]);
        g.lineWidth = major ? 2.6 / s : 1.1 / s;
        g.strokeStyle = major ? '#c5ccd3' : '#77838d';
        g.stroke();
      }
    }
    g.strokeStyle = '#b08d2e'; g.lineWidth = 1.2 / s;
    for (const r of w.rails) {
      if (r.cls !== 0) continue;
      g.beginPath(); g.moveTo(r.pts[0], r.pts[1]);
      for (let k = 2; k < r.pts.length; k += 2) g.lineTo(r.pts[k], r.pts[k + 1]);
      g.stroke();
    }
    return { cv, s };
  }

}
