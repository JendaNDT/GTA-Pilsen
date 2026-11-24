// Podélná osa u míří od průčelí k jevišti, osa v doprava při pohledu z ulice.
import * as THREE from 'three/webgpu';
import { Earcut } from 'three/src/extras/Earcut.js';

export const modernTheatreTile = '-384--128.bin';
const east = 1.46 / Math.hypot(1.46, 21.8), south = 21.8 / Math.hypot(1.46, 21.8);
export const theatrePoint = (u, v, h) => [-388.66 + east*u + south*v, h, -121.53 - south*u + east*v];
const local = ([x,h,z]) => [east*(x+388.66)-south*(z+121.53), south*(x+388.66)+east*(z+121.53),h];
const base = 1.52, top = 15.46, half = 10.925;
const screenPoint = ([v,h],depth) => theatrePoint(depth + .174*(top-h),v,h);
const stone = [153,3], graphite = [161,3], pale = [169,3];

// Středy, poloosy a sklon otvorů odečtené z čelního pohledu, v metrech vůči ose vstupu.
const openings = [
  [-9,14,.98,.65,.3],[-6.8,12.85,.98,1.35,-.13],[-4.37,13.77,.72,1.05,.47],[-1.89,13.8,1.02,.81,-.4],
  [.89,13.85,1.03,.77,.25],[3.52,13.83,.69,1.02,.58],[5.62,13.88,.48,.95,-.4],[7.42,12.49,.77,1.38,-.2],[9.48,13.84,.8,.82,.07],
  [-9.02,11.38,.94,1.10,-.13],[-4.83,10.12,.83,1.44,.13],[-2.66,11.36,.78,1.10,-.35],[-.03,11.5,1.02,1.12,.2],
  [2.56,11.64,.62,1.11,-.34],[4.95,10.8,1.08,1.42,-.4],[9.24,11.17,.61,1.04,-.28],
  [-9.24,8.57,.9,.97,-.49],[-6.94,9.21,.66,1.41,.35],[-2.8,8.24,.72,.95,.03],[-.95,9.54,.6,.62,.38],
  [1.59,9.1,1.29,.89,-.19],[5.38,8.02,1.39,.72,.1],[7.88,9.58,.77,.78,-.22],[9.64,8.69,.45,.62,.1],
  [-9.76,5.92,.55,.99,-.02],[-7.44,5.86,1.10,1.31,.28],[-4.58,6.37,.92,1.27,.51],[-1.88,5.44,1.1,.77,.59],
  [-.32,7.39,1.07,.68,.11],[.81,5.41,.6,.77,.28],[2.77,6.35,.89,1.25,.58],[5.69,5.87,1.12,.59,.71],[8.58,6.36,.98,1.42,.3],
  [-9.05,3.01,.96,1.17,.38],[-6.27,2.98,.66,.95,-.5],[6.76,3.22,1.14,.92,.64],[9.54,3.2,.6,1.02,-.46]
];
const doors = [[-3.47,1.13,2.63],[-.16,1.05,2.53],[3.09,1.16,2.56]];

function emitQuad(points, uv, emit) {
  emit([points[0], points[1], points[2]], [uv[0], uv[1], uv[2]]);
  emit([points[0], points[2], points[3]], [uv[0], uv[2], uv[3]]);
}

export function screenFaces(emit) {
  const outer = [[-half,base]];
  for (const [v,r,h] of doors) {
    for (let i=0;i<=16;i++) {
      const t=Math.PI*(1-i/16);
      outer.push([v+r*Math.cos(t)+.08*Math.sin(t),base+h*Math.sin(t)]);
    }
  }
  outer.push([half,base],[half,top],[-half,top]);
  const rings = [outer,...openings.map(([v,h,rx,ry,angle],k) => Array.from({length:22},(_,i)=>{
    const t=i*2*Math.PI/22, wobble=1+.051*Math.cos(3*t+k)+.023*Math.sin(2*t-k);
    const x=rx*Math.cos(t)*wobble, y=ry*Math.sin(t)*wobble;
    return [v+x*Math.cos(angle)-y*Math.sin(angle),h+x*Math.sin(angle)+y*Math.cos(angle)];
  }))];
  const points=rings.flat(), starts=[];
  let count=outer.length;
  for (const ring of rings.slice(1)) { starts.push(count); count+=ring.length; }
  const indices=Earcut.triangulate(points.flat(),starts,2);
  const ink=([v,h])=>[163+v,49.8-(h-base)];
  for(let k=0;k<indices.length;k+=3) {
    const face=indices.slice(k,k+3).map(i=>points[i]);
    for(const depth of [0,.52]) {
      const side = depth ? [face[2], face[1], face[0]] : face;
      emit(side.map(p=>screenPoint(p,depth)),side.map(ink));
    }
  }
  for(const ring of rings) for(let i=0;i<ring.length;i++) {
    const a=ring[i], b=ring[(i+1)%ring.length];
    const quad=[screenPoint(a,0),screenPoint(b,0),screenPoint(b,.52),screenPoint(a,.52)];
    emitQuad(quad, [stone, stone, stone, stone], emit);
  }
}

function sculpture(height,emit) {
  const center=theatrePoint(4.7,-18.5,0);
  const p=(i,j)=>{
    const a=2*Math.PI*i/28, b=-Math.PI/2+Math.PI*j/16, r=1.43*Math.cos(b);
    return theatrePoint(4.7+r*Math.cos(a),-18.5+r*Math.sin(a),height+1.43+1.43*Math.sin(b));
  };
  for(let j=0;j<16;j++) for(let i=0;i<28;i++) {
    const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);
    if(j>0) emit([a,b,c],[pale,pale,pale]);
    if(j<15) emit([a,c,d],[pale,pale,pale]);
  }
  const seam = ([x,y,z], dy) => [x+(x-center[0])*.003, y+dy, z+(z-center[2])*.003];
  for(let i=0;i<28;i++) {
    const a=p(i,8), b=p(i+1,8);
    const ring=[seam(a,-.018),seam(b,-.018),seam(b,.018),seam(a,.018)];
    emitQuad(ring, [stone, stone, stone, stone], emit);
  }
}

export function modernTheatreSite(world,manifest) {
  if (manifest.sha256 !== '825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac'
      || !manifest.tiles.some(tile => tile[2] === modernTheatreTile)) return null;
  const ci=world.chunkIndex(-384,-128), b=world.b;
  const anchors=[[77892,-4148,-1299],[103129,-3775,-1204],[103130,-4134,-1396],[103133,-4102,-1601],
    [103135,-4115,-1520],[103139,-4019,-2148],[103140,-4008,-2219],[103141,-4019,-2148]];
  if(!b || !anchors.every(([i,x,z])=>b.ax[i]===x && b.az[i]===z)) return null;
  const bridges=anchors.slice(2).map(([i])=>i);
  const [sx,,sz]=theatrePoint(4.7,-18.5,0);
  const ground=world.heightAt(sx,sz);
  return {ci, bridges, ground, hidden:new Set([103129,...bridges]), collisionSkip:new Set([77892,103129,...bridges])};
}

function bridgeFaces(world,id,emit) {
  const ring=world.b.bRing[id], start=world.b.ringStart[ring];
  const floor=world.bGround[id]+(id===103130 ? 3.55 : world.b.hMin[id]*.1);
  const at=(j,h)=>[world.bvx[start+j],floor+h,world.bvz[start+j]];
  for(let j=0;j<4;j++) {
    const k=(j+1)%4, a=at(j,0), b=at(k,0), span=Math.hypot(a[0]-b[0],a[2]-b[2]);
    for(const [low,high,glass] of [[0,.22,false],[.22,2.66,true],[2.66,2.87,false]]) {
      const ink=glass ? [[126,57],[126+span,57],[126+span,53.2],[126,53.2]] : Array(4).fill(graphite);
      emitQuad([at(j,low), at(k,low), at(k,high), at(j,high)], ink, emit);
    }
  }
  for (const h of [0, 2.87]) emitQuad([0,1,2,3].map(i => at(i,h)), Array(4).fill(graphite), emit);
}

// Na straně sálu uzavírá prostor za předsazenou stěnou červený panel.
function entranceSide(emit) {
  const corners=[screenPoint([half,base],.52),theatrePoint(4.98,10.87,base),
    theatrePoint(4.98,10.87,top),screenPoint([half,top],.52)];
  const uv = corners.map(point => {
    const [u,,h] = local(point);
    return [u, 30-h];
  });
  emitQuad(corners, uv, emit);
}

export function modernTheatreCollision(world,site,emit) {
  const both = ([a,b,c]) => {
    emit(a, b, c);
    emit(c, b, a);
  };
  entranceSide(both);
  screenFaces(both);
  sculpture(site.ground,both);
  for(const id of site.bridges) bridgeFaces(world,id,both);
}

export function modernTheatreGeometry(pack,shell,world,site) {
  if(pack.fileHash!=='691b6e4e' || !site) return null;
  const positions = [], tex = [];
  const pos = shell.getAttribute('position');
  const triangle=(points,uv)=>{
    for (let i = 0; i < 3; i++) {
      positions.push(...points[i]);
      tex.push(uv[i][0]/176, 1-uv[i][1]/64);
    }
  };
  // Rozsahy trojúhelníků patří k výše ověřenému městskému listu.
  for (let j = 8091; j < 8826; j += 3) {
    const points=Array.from(pack.i.subarray(j,j+3),i=>[pos.getX(i),pos.getY(i),pos.getZ(i)]);
    const roof=(j>=8115 && j<8121)||(j>=8259 && j<8298)||(j>=8322 && j<8328)||(j>=8394 && j<8415)||j>=8745;
    const wing=j<8298, foyer=j>=8421 && j<=8427;
    const coordinates = points.map(local);
    const span = axis => {
      const values = coordinates.map(point => point[axis]);
      return Math.max(...values) - Math.min(...values);
    };
    const across = span(0) < span(1);
    if(j<8115) for(const p of points) p[1]=Math.max(p[1],world.bBase[103127]);
    triangle(points,points.map(p=>{
      const [u,v,h]=local(p);
      // Na přední střeše má městský model zaměřený i nízký plášť vzduchotechniky.
      if (j >= 8715 && j < 8745) return j < 8721 ? [154+v, 56+u-21.7] : graphite;
      if (j >= 8466 && j < 8490) return [163+v, 32.4-h];
      if (j >= 8490 && j < 8562 && across) return [46+v*.8, 30-h];
      if(roof) return [136+v*.19,2+u*.23];
      if(foyer) return [136.5+v,49.7-h+base];
      if(wing) return [across ? 38+v*.91 : Math.max(1,u),59.6-h];
      return [across ? 74+v*.86 : Math.max(.1,u),30-h];
    }));
    if(j===8115 || j===8118) triangle(points.map(([x,,z])=>[x,world.bBase[103127],z]),Array(3).fill(graphite));
  }
  entranceSide(triangle);
  screenFaces(triangle);
  sculpture(site.ground,triangle);
  for(const id of site.bridges) bridgeFaces(world,id,triangle);
  shell.setIndex([...pack.i.subarray(0,8091),...pack.i.subarray(8826)]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function modernTheatreMaterial() {
  const map=new THREE.TextureLoader().load(new URL('./modern-theatre.svg',import.meta.url).href);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  return new THREE.MeshStandardNodeMaterial({map,roughness:.82,side:THREE.DoubleSide});
}
