// Obrys OSM 109759707. Osa u sleduje dlouhé průčelí, kladné v míří na terasu.
import { streetCorners } from './street-furniture.js';

const cx = -800.1, cz = -1533.25;
const yaw = Math.atan2(-1.6,15.5), cs = Math.cos(yaw), sn = Math.sin(yaw);
export const pavilionParts = [
  {u:0,v:0,w:7.8,d:5.52,eave:5.2,top:7.95},
  {u:-13.4,v:0,w:5.6,d:3.4,eave:3.15,top:4.68},
  {u:13.4,v:-.94,w:5.6,d:4.39,eave:3.15,top:4.9},
];
export const terrace = {u:0,v:6.38,w:19.4,d:3.18,eave:.18,top:.18};
const solids = [...pavilionParts,terrace];
const bottom = -2;

export function pavilionPoint(site,u,h,v) {
  return [cx+u*cs-v*sn, site.ground+h, cz+u*sn+v*cs];
}
function local(x,z) {
  return [(x-cx)*cs+(z-cz)*sn,(z-cz)*cs-(x-cx)*sn];
}
export function nearPavilion(x,z,r=0) {
  return Math.abs(x-cx)<=21+r && Math.abs(z-cz)<=12+r;
}
export function createPavilionSite(world) {
  const building = world.buildingAt(cx,cz);
  if (world.bNames.get(building)!=='Lochotínský pavilonek') return null;
  const site = {building,tile:world.chunkIndex(cx,cz),ground:world.bGround[building],rails:[]};
  for (let i=0;i<14;i++) {
    const width=2.75;
    const [x,y,z]=pavilionPoint(site,(i-6.5)*width,terrace.top,9.36);
    site.rails.push({kind:'pavilionRail',id:'street/lochotinsky-pavilonek/'+i,
      tile:world.chunkIndex(x,z),x,y,z,yaw,width,height:1.03,depth:.14,impulse:6500,
      corners:streetCorners(x,y,z,yaw,width,.14)});
  }
  return site;
}

// Stejné roviny valby používá kresba střechy, pěší postava i síť pro vozidla.
export function pavilionFaces(part,face) {
  const {u,v,w,d,eave,top} = part;
  const corners = [[u-w,v+d],[u+w,v+d],[u+w,v-d],[u-w,v-d]];
  const upper = corners.map(([x,z])=>[x,eave,z]);
  for (let i=0;i<4;i++) {
    const j=(i+1)%4;
    face([[corners[i][0],bottom,corners[i][1]],[corners[j][0],bottom,corners[j][1]],upper[j],upper[i]],'wall',i);
  }
  if (top===eave) { face(upper,'deck'); return; }
  const a=[u-w+d,top,v], b=[u+w-d,top,v];
  face([upper[0],upper[1],b,a],'roof',0);
  face([upper[1],upper[2],b],'roof',1);
  face([upper[2],upper[3],a,b],'roof',2);
  face([upper[3],upper[0],a],'roof',3);
}

export function pavilionCollision(site,emit) {
  for (const part of solids) pavilionFaces(part,points=>{
    const p=points.map(([u,h,v])=>pavilionPoint(site,u,h,v));
    emit(p[0],p[1],p[2]);
    if (p.length===4) emit(p[0],p[2],p[3]);
  });
}
export function pavilionSurface(site,x,z,maxY) {
  const [u,v]=local(x,z);
  let height=-Infinity;
  for (const p of solids) {
    const inset=Math.min(p.w-Math.abs(u-p.u),p.d-Math.abs(v-p.v));
    if (inset<0) continue;
    const y=site.ground+p.eave+inset/p.d*(p.top-p.eave);
    if (y<=maxY) height=Math.max(height,y);
  }
  return height;
}

function insetAt(part,h) {
  return h<=part.eave ? 0 : (h-part.eave)*part.d/(part.top-part.eave);
}
export function pavilionContact(site,hit,r,low,high) {
  if (high<=site.ground+bottom) return false;
  let [u,v]=local(hit.x,hit.z), moved=false;
  for (const p of solids) {
    const h=low-site.ground+.025;
    if (h>=p.top) continue;
    const inset=insetAt(p,h), w=p.w-inset, d=p.d-inset;
    const x=u-p.u, z=v-p.v;
    const dx=x-Math.max(-w,Math.min(w,x)), dz=z-Math.max(-d,Math.min(d,z));
    const dist=Math.hypot(dx,dz);
    if (dist>=r) continue;
    let nx,nz,push;
    if (dist>0) { nx=dx/dist; nz=dz/dist; push=r-dist; }
    else if (w-Math.abs(x)<d-Math.abs(z)) { nx=Math.sign(x)||1; nz=0; push=r+w-Math.abs(x); }
    else { nx=0; nz=Math.sign(z)||1; push=r+d-Math.abs(z); }
    u+=nx*push; v+=nz*push;
    [hit.x,,hit.z]=pavilionPoint(site,u,0,v);
    hit.nx=nx*cs-nz*sn; hit.nz=nx*sn+nz*cs;
    hit.depth=Math.max(push,hit.depth); hit.building=site.building; moved=true;
  }
  return moved;
}
export function pavilionRay(site,x0,z0,x1,z1,y) {
  const a=local(x0,z0), b=local(x1,z1), h=y-site.ground;
  let best=1;
  for (const p of solids) {
    if (h>=p.top || h<bottom) continue;
    const inset=insetAt(p,h);
    let lo=0,hi=best;
    for (const [axis,center,half] of [[0,p.u,p.w-inset],[1,p.v,p.d-inset]]) {
      const delta=b[axis]-a[axis], off=center-a[axis];
      if (Math.abs(delta)<1e-8) { if (Math.abs(off)>half) hi=-1; continue; }
      const t=(off-half)/delta, s=(off+half)/delta;
      lo=Math.max(lo,Math.min(t,s)); hi=Math.min(hi,Math.max(t,s));
    }
    if (lo<=hi) best=lo;
  }
  return best;
}
