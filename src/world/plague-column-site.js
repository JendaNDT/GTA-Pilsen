// Obrys OSM 1103555254, dlouhá strana míří podél severní fronty náměstí.
import { streetCorners } from './street-furniture.js';

export const columnCenter = { x: -23.31, z: -48.98 };
const yaw = Math.atan2(1.80, 8.83);
const cos = Math.cos(yaw), sin = Math.sin(yaw);
export function columnPoint(u, h, v, ground) {
  return [columnCenter.x + u*cos - v*sin, ground + h, columnCenter.z + u*sin + v*cos];
}

export const columnSteps = Array.from({length: 6}, (_, i) => ({
  u: 0, v: 0, w: 4.50 - i*.215, d: 4.33 - i*.215, bottom: i ? i*.165 : -.5, top: (i+1)*.165,
}));
const mass = (w,d,bottom,top,u=0,v=0) => ({w,d,bottom,top,u,v});
const masses = [...columnSteps, mass(1.75,1.75,.99,2.26), mass(1.03,1.03,2.26,3.9),
  mass(.77,.77,3.9,5.4), mass(.32,.32,5.4,12.8), mass(.52,.52,12.8,13.46), mass(.29,.28,13.46,15.36)];
for (const u of [-1.39,1.39]) for (const v of [-1.39,1.39]) masses.push(mass(.48,.48,2.26,3.23,u,v));

export function createColumnSite(world) {
  const {x,z} = columnCenter;
  const building = world.buildingAt(x,z);
  if (world.bNames.get(building)?.toLowerCase() !== 'morový sloup') return null;
  const ground = world.heightAt(x,z), tile = world.chunkIndex(x,z);
  const fixtures = [];
  for (let side=0; side<4; side++) {
    const angle = side*Math.PI/2;
    for (const [kind,half,extent,pieces,bottom,height,depth] of [
      ['columnFence',4.21,4.13,4,.15,.91,.065], ['columnBalustrade',2.98,2.98,2,.99,1.25,.41],
    ]) {
      // Východní balustrádu přerušuje malá kovová branka.
      for (let j=0; j<pieces; j++) {
        const gap = side===3 && kind==='columnBalustrade' ? .48 : 0;
        const start = -extent + j*2*extent/pieces + (j===1 ? gap : 0);
        const end = -extent + (j+1)*2*extent/pieces - (j===0 ? gap : 0);
        const along = (start+end)/2, width = end-start;
        const u = along*Math.cos(angle)-half*Math.sin(angle);
        const v = along*Math.sin(angle)+half*Math.cos(angle);
        const [px,y,pz] = columnPoint(u,bottom,v,ground);
        const dir = yaw+angle;
        fixtures.push({kind, tile, id:'street/'+tile+'/morovy-sloup/'+kind+'/'+side+'/'+j,
          x:px, y, z:pz, yaw:dir, width, height, depth,
          impulse:kind==='columnFence' ? 6800 : 30000, corners:streetCorners(px,y,pz,dir,width,depth)});
      }
    }
  }
  const [gx,gy,gz]=columnPoint(2.98,.99,0,ground), gateYaw=yaw-Math.PI/2;
  fixtures.push({kind:'columnGate',id:'street/'+tile+'/morovy-sloup/branka',tile,
    x:gx,y:gy,z:gz,yaw:gateYaw,width:.96,height:.93,depth:.07,impulse:6800,
    corners:streetCorners(gx,gy,gz,gateYaw,.96,.07)});
  return {building,tile,ground,fixtures};
}

function local(x,z) {
  const dx = x-columnCenter.x, dz = z-columnCenter.z;
  return [dx*cos+dz*sin, dz*cos-dx*sin];
}

export function columnSurface(site,x,z,maxY) {
  const [u,v] = local(x,z);
  let h = -Infinity;
  for (const m of masses) {
    const top = site.ground+m.top;
    if (top<=maxY && Math.abs(u-m.u)<=m.w && Math.abs(v-m.v)<=m.d) h = Math.max(h,top);
  }
  return h;
}

export function columnContact(site,hit,r,low,high) {
  let [u,v] = local(hit.x,hit.z);
  let moved = false;
  for (const m of masses) {
    if (low>=site.ground+m.top-.025 || high<=site.ground+m.bottom) continue;
    const a = u-m.u, b = v-m.v;
    const dx = a-Math.max(-m.w,Math.min(m.w,a)), dz = b-Math.max(-m.d,Math.min(m.d,b));
    const dist = Math.hypot(dx,dz);
    if (dist>=r) continue;
    let nx, nz, depth;
    if (dist>0) { nx=dx/dist; nz=dz/dist; depth=r-dist; }
    else if (m.w-Math.abs(a)<m.d-Math.abs(b)) { nx=Math.sign(a)||1; nz=0; depth=r+m.w-Math.abs(a); }
    else { nx=0; nz=Math.sign(b)||1; depth=r+m.d-Math.abs(b); }
    u+=nx*depth; v+=nz*depth;
    [hit.x,,hit.z] = columnPoint(u,0,v,0);
    hit.nx=nx*cos-nz*sin; hit.nz=nx*sin+nz*cos;
    hit.depth=Math.max(depth,hit.depth); hit.building=site.building;
    moved=true;
  }
  return moved;
}

export function columnRay(site,x0,z0,x1,z1,y) {
  const start=local(x0,z0), end=local(x1,z1);
  let best=1;
  for (const m of masses) {
    if (y<site.ground+m.bottom || y>site.ground+m.top) continue;
    let lo=0, hi=best;
    for (const [i,center,half] of [[0,m.u,m.w],[1,m.v,m.d]]) {
      const delta=end[i]-start[i], position=start[i]-center;
      if (Math.abs(delta)<1e-8) { if (Math.abs(position)>half) hi=-1; continue; }
      const a=(-half-position)/delta, b=(half-position)/delta;
      lo=Math.max(lo,Math.min(a,b)); hi=Math.min(hi,Math.max(a,b));
    }
    if (lo<=hi) best=lo;
  }
  return best;
}

export function columnCollision(site,emit) {
  for (const {u,v,w,d,bottom,top} of masses) {
    const corners = [[u-w,v-d],[u-w,v+d],[u+w,v+d],[u+w,v-d]];
    const upper = corners.map(([a,b])=>columnPoint(a,top,b,site.ground));
    const lower = corners.map(([a,b])=>columnPoint(a,bottom,b,site.ground));
    emit(upper[0],upper[1],upper[2]); emit(upper[0],upper[2],upper[3]);
    for (let i=0;i<4;i++) {
      const j=(i+1)%4;
      emit(lower[i],lower[j],upper[j]); emit(lower[i],upper[j],upper[i]);
    }
  }
}
