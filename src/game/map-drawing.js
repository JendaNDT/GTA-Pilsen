import { CHUNK, DRIVABLE_MAX, RC, RF } from '../config.js';
import { insideMap } from './map-view.js';
import { BIKE_COLOR } from './bike-stations.js';
import { ACTIVITY_COLOR } from './activity-sites.js';

function eachChunk(world, near, far, draw) {
  const left = Math.max(0, Math.floor((near.x - world.minX) / CHUNK) - 1);
  const top = Math.max(0, Math.floor((near.z - world.minZ) / CHUNK) - 1);
  const right = Math.min(world.cols - 1, Math.floor((far.x - world.minX) / CHUNK) + 1);
  const bottom = Math.min(world.rows - 1, Math.floor((far.z - world.minZ) / CHUNK) + 1);
  for (let z = top; z <= bottom; z++) for (let x = left; x <= right; x++) draw(z * world.cols + x);
}

function pedestrianSign(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#123d45'; g.strokeStyle = '#a7f2ed'; g.lineWidth = 1;
  g.beginPath(); g.roundRect(-8, -9, 16, 19, 4); g.fill(); g.stroke();
  g.fillStyle = '#effffb'; g.beginPath(); g.arc(1, -5, 1.5, 0, 2 * Math.PI); g.fill();
  g.strokeStyle = g.fillStyle; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-4, 1); g.lineTo(0, -2); g.lineTo(3, 1); g.lineTo(5, 1);
  g.moveTo(0, -2); g.lineTo(-1, 2); g.lineTo(3, 7); g.moveTo(-1, 2); g.lineTo(-4, 7); g.stroke();
  g.restore();
}

function drawBoundary(g, view) {
  const a = view.area;
  const [x, y] = view.screen(a.minX, a.minZ);
  const w = (a.maxX - a.minX) * view.scale, h = (a.maxZ - a.minZ) * view.scale;
  if (x < -2 && y < -2 && x + w > view.width + 2 && y + h > view.height + 2) return;
  g.save(); g.beginPath(); g.rect(0, 0, view.width, view.height); g.rect(x, y, w, h);
  g.clip('evenodd'); g.fillStyle = '#1a252de0'; g.fillRect(0, 0, view.width, view.height);
  g.beginPath();
  for (let i = -view.height; i < view.width; i += 11) {
    g.moveTo(i, view.height); g.lineTo(i + view.height, 0);
  }
  g.lineWidth = 1; g.strokeStyle = '#394751'; g.stroke(); g.restore();
  g.strokeStyle = '#efbb78'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
}

export function drawAreaMap(canvas, game, view, selected) {
  const { world, hud, jobs, shifts, focus } = game, { width, height, scale } = view;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#27333c'; g.fillRect(0, 0, width, height);
  const near = view.world(0, 0), far = view.world(width, height);
  const screenBounds = { minX: near.x, minZ: near.z, maxX: far.x, maxZ: far.z };
  const tiles = hud.tiles, T = tiles.T;
  const visibleTiles = (width / (T * scale) + 2) * (height / (T * scale) + 2);
  const detailed = scale >= .7 || (scale >= .23 && visibleTiles <= 40);
  const streetLabels = new Map(), signs = [];
  g.save();
  g.scale(scale, scale); g.translate(-near.x, -near.z);
  if (detailed && scale >= .7) {
    // Při přiblížení kreslíme obrysy přímo z vrcholů, aby zůstaly ostré i na telefonu.
    const land = new Set();
    for (let z=Math.max(0,Math.floor((near.z-world.minZ)/T)); z<=Math.min(tiles.rows-1,Math.floor((far.z-world.minZ)/T)); z++) {
      for (let x=Math.max(0,Math.floor((near.x-world.minX)/T)); x<=Math.min(tiles.cols-1,Math.floor((far.x-world.minX)/T)); x++) {
        for (const id of tiles.land[z*tiles.cols+x] ?? []) land.add(id);
      }
    }
    g.fillStyle = '#2b353e'; g.fillRect(near.x,near.z,width/scale,height/scale);
    tiles.drawLayers(g,[...land].sort((a,b)=>a-b), draw=>eachChunk(world,near,far,draw));
  } else if (detailed) {
    tiles.budget = 40;
    for (let tz = Math.floor((near.z - world.minZ) / T); tz <= Math.floor((far.z - world.minZ) / T); tz++) {
      for (let tx = Math.floor((near.x - world.minX) / T); tx <= Math.floor((far.x - world.minX) / T); tx++) {
        const tile = tiles.get(tx, tz);
        if (tile) g.drawImage(tile, world.minX + tx*T, world.minZ + tz*T, T+.4/scale, T+.4/scale);
      }
    }
  } else {
    const w = world.playMaxX - world.playMinX, h = world.playMaxZ - world.playMinZ;
    hud.big ??= hud._bigBase(1800, Math.round(1800 * h / w));
    g.drawImage(hud.big.cv, world.playMinX, world.playMinZ, w, h);
  }
  if (scale > .085) {
    const foot = game.mode === 'foot';
    eachChunk(world, near, far, ci => {
      const pieces = world.rPieces[ci] ?? [];
      for (let j = 0; j < pieces.length; j += 3) {
        const id = pieces[j], start = pieces[j+1], end = pieces[j+2];
        const cls = world.r.cls[id], pedestrian = cls > DRIVABLE_MAX;
        const bridge = Boolean(world.r.flags[id] & RF.BRIDGE);
        if (!detailed && (pedestrian || cls > RC.RESIDENTIAL)) continue;
        const middle = (start + end) >> 1;
        const x = (world.rpx[middle] + world.rpx[end]) / 2, z = (world.rpz[middle] + world.rpz[end]) / 2;
        const name = world.roadNames[world.r.name[id]];
        if (name && insideMap(screenBounds,x,z) && (!pedestrian || foot) && (detailed || cls <= RC.TERTIARY_LINK)) {
          if (!streetLabels.has(name)) streetLabels.set(name, { x, z, name, cls });
        }
        if (detailed && (pedestrian || !foot || bridge)) {
          const publicRoad = !(world.r.flags[id] & RF.PRIVATE);
          g.strokeStyle = pedestrian ? (foot && publicRoad ? '#97ccbc' : '#627672')
            : publicRoad ? (cls <= RC.TERTIARY_LINK ? '#ead5a7' : '#a4afbb') : '#6b7683';
          g.lineWidth = pedestrian ? Math.max(1.4/scale, 1.65) : Math.max(1.1/scale, world.r.w[id] * .65);
          g.setLineDash(pedestrian && !bridge ? [2.5/scale, 2/scale] : []);
          g.beginPath(); g.moveTo(world.rpx[start], world.rpz[start]);
          for (let k = start + 1; k <= end; k++) g.lineTo(world.rpx[k], world.rpz[k]);
          g.stroke(); g.setLineDash([]);
          if (bridge && pedestrian && scale >= .8 && insideMap(screenBounds,x,z)) signs.push([x,z]);
        }
      }
      if (foot && detailed && scale > .8) {
        g.strokeStyle = '#e9eee6'; g.lineWidth = 2 / scale; g.setLineDash([2/scale, 2/scale]);
        for (const c of world.traffic.chunks.get(ci)?.crossings ?? []) {
          g.beginPath(); g.moveTo(...c.a); g.lineTo(...c.b); g.stroke();
        }
        g.setLineDash([]);
      }
    });
    const bridge = world.sady?.solids.find(site => site.id === 'lavka');
    if (detailed && bridge) {
      const dx = Math.cos(bridge.angle)*bridge.length/2, dz = Math.sin(bridge.angle)*bridge.length/2;
      g.strokeStyle = '#a5d1bd'; g.lineWidth = Math.max(2/scale, bridge.width);
      g.beginPath(); g.moveTo(bridge.x-dx,bridge.z-dz); g.lineTo(bridge.x+dx,bridge.z+dz); g.stroke();
      if (scale >= .8) signs.unshift([bridge.x, bridge.z]);
    }
  }
  const route = shifts.active?.path ?? jobs.displayedRoad;
  if (route?.length >= 4) {
    g.beginPath(); g.moveTo(focus.x, focus.z);
    for (let i=0; i<route.length; i+=2) g.lineTo(route[i],route[i+1]);
    g.strokeStyle = '#ffbf48'; g.lineWidth = 3.5/scale; g.lineJoin = 'round'; g.stroke();
  }
  hud._drawWalk(g, jobs.displayedWalk, 1/scale);
  hud._drawClosures(g, 1/scale);
  g.restore();
  drawBoundary(g, view);
  const occupied = [];
  function label(x, z, name, size, color, offset = -8) {
    const [u, v] = view.screen(x,z), baseline = v + offset;
    if (u < 0 || u > width || baseline < size || baseline > height - 6) return;
    g.font = '600 ' + size + 'px system-ui'; g.textAlign = 'center';
    const half = g.measureText(name).width/2 + 4, box = [u-half,baseline-size-2,u+half,baseline+3];
    if (box[0] < 1 || box[2] > width || occupied.some(b => box[0]<b[2] && box[2]>b[0] && box[1]<b[3] && box[3]>b[1])) return;
    occupied.push(box); g.strokeStyle = '#202b32'; g.lineWidth = 3; g.lineJoin = 'round';
    g.strokeText(name,u,baseline); g.fillStyle=color; g.fillText(name,u,baseline);
  }
  function dot(x,z,r,color) {
    const [u,v] = view.screen(x,z);
    g.beginPath(); g.arc(u,v,r,0,Math.PI*2); g.fillStyle=color; g.fill();
    g.lineWidth=1.5; g.strokeStyle='#15242c'; g.stroke();
  }
  for (const m of jobs.landmarks) {
    if (!insideMap(screenBounds,m.x,m.z)) continue;
    dot(m.x,m.z,m.found?4.5:3,m.found?'#edb449':'#98a5ae');
    if (detailed) label(m.x,m.z,m.name,12,'#f3dca6');
  }
  if (scale >= 1.1) for (const site of game.areaMap.sites) {
    if (!insideMap(screenBounds,site.x,site.z) || site.walk || site.activity || site.bike) continue;
    dot(site.x,site.z,site.police ? 3.5 : 2.5,site.police ? '#8ccaff' : '#afc2a7');
    label(site.x,site.z,site.name,11,'#d5e5cf');
  }
  for (const site of game.areaMap.sites) {
    if ((!site.activity && !site.bike) || !insideMap(screenBounds,site.x,site.z)) continue;
    const color = site.bike ? BIKE_COLOR : ACTIVITY_COLOR;
    dot(site.x,site.z,6,color);
    if (scale > .085) label(site.x,site.z,site.name,12,color,-10);
  }
  for (const [x,z,name,type] of game.areaMap.places) {
    if (!insideMap(screenBounds,x,z)) continue;
    if (type === 'city' || type === 'town') label(x,z,name,16,'#fff4df');
    else if (type === 'village' || (scale > .065 && type === 'suburb')) label(x,z,name,13,'#e2ebe8');
  }
  for (const road of [...streetLabels.values()].sort((a,b)=>a.cls-b.cls)) label(road.x,road.z,road.name,11,'#e3e9eb',4);
  const icons = [];
  for (const [x,z] of signs) {
    const [u,v] = view.screen(x,z);
    if (!icons.some(([a,b])=>Math.hypot(a-u,b-v)<20)) { pedestrianSign(g,u,v); icons.push([u,v]); }
  }
  for (const h of game.helis) dot(h.x,h.z,4,'#7fd0ff');
  for (const m of [...jobs.markers(), ...shifts.markers()]) dot(m.x,m.z,5,m.color);
  const [px,pz] = view.screen(focus.x, focus.z);
  g.save(); g.translate(px,pz); g.rotate(Math.PI-(focus.yaw || 0));
  g.beginPath(); g.moveTo(0,-11); g.lineTo(7,8); g.lineTo(0,4); g.lineTo(-7,8); g.closePath();
  g.fillStyle='#fff'; g.fill(); g.lineWidth=2; g.strokeStyle='#17272d'; g.stroke(); g.restore();
  if (selected) {
    const [u,v] = view.screen(selected.x,selected.z);
    g.strokeStyle='#ffcf70'; g.lineWidth=3; g.beginPath(); g.arc(u,v,10,0,2*Math.PI); g.stroke();
    dot(selected.x,selected.z,3,'#ffcf70');
  }
}
