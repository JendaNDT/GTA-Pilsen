import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(process.cwd() + '/');
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
const baseline = process.argv.includes('--baseline');
// Výchozí stav auditu jsou původní data bez oprav, tedy i bez vyhlazeného profilu silnic.
globalThis.location = { search: baseline ? '?silnice=puvodni' : '' };
const { assetFingerprint, parsePack } = await import(new URL('src/data.js', root));
const { World, SURF } = await import(new URL('src/world/world.js', root));
const { RC, RF } = await import(new URL('src/config.js', root));
const data = { meta: JSON.parse(fs.readFileSync('public/data/meta.json', 'utf8')) };
const patch = 'public/data/grade-separations.json';
if (!baseline && fs.existsSync(patch)) data.gradeSeparations = JSON.parse(fs.readFileSync(patch, 'utf8'));
if (!baseline && fs.existsSync('public/data/underpasses.json')) data.underpasses = JSON.parse(fs.readFileSync('public/data/underpasses.json', 'utf8'));
for (const name of ['roads', 'rails', 'terrain', 'landscape', 'buildings', 'land', 'trees']) {
  const v = fs.readFileSync('public/data/' + name + '.bin');
  const packed = v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  if (data.gradeSeparations && ['roads', 'rails', 'terrain', 'landscape'].includes(name)) {
    assert.equal(data.gradeSeparations.sources?.[name], assetFingerprint(packed), `Výškové profily a ${name}.bin si neodpovídají`);
  }
  data[name] = parsePack(packed);
}
class GeometryWorld extends World { _initLand() {} }
const w = new GeometryWorld(data);
const segments = [], features = [], cells = new Map();
function add(kind, index, pts, flags, label, className, layer, profile, drivable) {
  const feature = { id: features.length, kind, index, flags, label, className, layer, profile, drivable, pts };
  features.push(feature);
  for (let i = 1; i < pts.length; i++) {
    const [x,z,y] = pts[i-1], [bx,bz,by] = pts[i];
    const dx = bx-x, dz = bz-z, dy = by-y;
    if (Math.hypot(dx,dz) < 0.02) continue;
    const s = { id: segments.length, feature, segment: i - 1, x,z,y,dx,dz,dy };
    segments.push(s);
    for (let u = Math.floor(Math.min(x,bx)/64); u <= Math.floor(Math.max(x,bx)/64); u++) {
      for (let v = Math.floor(Math.min(z,bz)/64); v <= Math.floor(Math.max(z,bz)/64); v++) {
        const k = u*8192+v;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(s);
      }
    }
  }
}
for (let i=0;i<w.rCount;i++) {
  const a=w.rOff[i], b=w.rOff[i+1], flags=w.r.flags[i], cls=w.r.cls[i];
  if (flags & RF.SHARED_DECK) continue;
  const label = w.roadNames[w.r.name[i]] || 'bez názvu';
  const profile = Boolean(flags & RF.BRIDGE) || w.tunnelRoads.has(i) || w.elevatedWidths.has(i);
  const pts = Array.from({length:b-a},(_,k)=>[w.rpx[a+k],w.rpz[a+k],w.rpy[a+k]]);
  add('road',i,pts,flags,label,Object.keys(RC)[cls],w.r.layer[i],profile,cls <= RC.SERVICE && !(flags & RF.PRIVATE));
}
for (const [i,r] of w.rails.entries()) {
  add('rail',i,Array.from({length:r.pts.length/2},(_,k)=>[r.pts[k*2],r.pts[k*2+1],r.y?.[k] ?? w.heightAt(r.pts[k*2],r.pts[k*2+1])+SURF]),
    r.flags,r.cls === 0 ? 'tramvajové koleje' : 'železnice',r.cls===0?'tram':'rail',r.flags & RF.BRIDGE ? 1 : 0,Boolean(r.y),true);
}
function surface(segment, t, x, z) {
  const { feature } = segment;
  if (feature.kind === 'road' && w.upperApproaches.has(feature.index)) {
    return w.roadSurfaceY(feature.index, w.rOff[feature.index] + segment.segment, t, x, z);
  }
  return feature.profile ? segment.y + t * segment.dy : w.heightAt(x, z) + SURF;
}

function intersection(a,b) {
  const cross = a.dx*b.dz - a.dz*b.dx;
  if (Math.abs(cross) < Math.hypot(a.dx,a.dz)*Math.hypot(b.dx,b.dz)*0.28) return null;
  const t = ((b.x-a.x)*b.dz-(b.z-a.z)*b.dx)/cross;
  const u = ((b.x-a.x)*a.dz-(b.z-a.z)*a.dx)/cross;
  if (t < -1e-7 || t > 1+1e-7 || u < -1e-7 || u > 1+1e-7) return null;
  const x=a.x+t*a.dx,z=a.z+t*a.dz;
  if (a.feature.pts.some(([px,pz])=>Math.hypot(px-x,pz-z)<0.15) &&
    b.feature.pts.some(([px,pz])=>Math.hypot(px-x,pz-z)<0.15)) return null;
  const ya = surface(a, t, x, z);
  const yb = surface(b, u, x, z);
  const aAbove = (a.feature.flags & RF.BRIDGE) || (!(a.feature.flags & RF.TUNNEL) && (b.feature.flags & RF.TUNNEL));
  let [top, bottom] = aAbove ? [a, b] : [b, a];
  if (top.feature.flags & RF.BRIDGE && bottom.feature.flags & RF.BRIDGE) {
    if (top.feature.layer === bottom.feature.layer) return null;
    if (top.feature.layer < bottom.feature.layer) [top, bottom] = [bottom, top];
  }
  return {
    x:+x.toFixed(2), z:+z.toFixed(2), ...w.worldToGps(x,z),
    a:top.feature.id,b:bottom.feature.id,
    top:+((top===a?ya:yb)+w.baseElevation).toFixed(2),
    bottom:+((top===a?yb:ya)+w.baseElevation).toFixed(2),
    delta:+(top===a?ya-yb:yb-ya).toFixed(2),
  };
}
const pairs = new Set(), crossings = new Map();
for (const s of segments) {
  if (!(s.feature.flags & (RF.BRIDGE | RF.TUNNEL))) continue;
  for (let u = Math.floor(Math.min(s.x,s.x+s.dx)/64); u <= Math.floor(Math.max(s.x,s.x+s.dx)/64); u++) {
    for (let v = Math.floor(Math.min(s.z,s.z+s.dz)/64); v <= Math.floor(Math.max(s.z,s.z+s.dz)/64); v++) {
      for (const q of cells.get(u*8192+v) ?? []) {
        if (q.feature.id === s.feature.id || !s.feature.drivable && !q.feature.drivable) continue;
        const key = Math.min(s.id,q.id)*segments.length+Math.max(s.id,q.id);
        if (pairs.has(key)) continue;
        pairs.add(key);
        const i=intersection(s,q);
        if (i) crossings.set([i.a,i.b,i.x,i.z].join(':'),i);
      }
    }
  }
}
const count = (p) => features.filter(p).length;
const sorted = [...crossings.values()].sort((a,b)=>a.delta-b.delta);
const bridgeOnly=sorted.filter(({a,b})=>features[a].flags & RF.BRIDGE && !(features[b].flags & RF.TUNNEL));
const within = (items,limit) => items.filter(({delta})=>delta<limit);
const summary = {
  roadParts:w.rCount, railParts:w.rails.length, segments:segments.length,
  roadBridgeParts:count(f=>f.kind==='road'&&f.flags&RF.BRIDGE),
  railBridgeParts:count(f=>f.kind==='rail'&&f.flags&RF.BRIDGE),
  markedRoadTunnels:count(f=>f.kind==='road'&&f.flags&RF.TUNNEL), explicitRoadTunnels:w.tunnels.length,
  allCrossings:sorted.length, bridgeCrossings:bridgeOnly.length, lowBridge:within(bridgeOnly,3).length,
  lowBridgeThreshold45:within(bridgeOnly,4.5).length,
  roadRoadOrRail:bridgeOnly.filter(({a,b})=>features[a].drivable&&features[b].drivable).length,
  severeRoadRoadOrRail:within(bridgeOnly,3).filter(({a,b})=>features[a].drivable&&features[b].drivable).length,
};
const used = new Set(sorted.flatMap(i => [i.a, i.b]));
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, crossings: sorted,
    features: Object.fromEntries(features.filter(f => used.has(f.id)).map(f => [f.id, f])) }));
} else console.log(JSON.stringify(summary, null, 2));
