// Místní osa u vede od vchodu k jevišti, záporná strana v míří do parku.
import * as THREE from 'three/webgpu';
import { Earcut } from 'three/src/extras/Earcut.js';
import { streetCorners } from './street-furniture.js';

export const theatreTile = '-384-128.bin';
const ax = 117/Math.hypot(117,50), az = -50/Math.hypot(117,50);
const world = (u,v,y) => [-326+ax*u-az*v,y,237+az*u+ax*v];
const atlasWidth = 176, atlasHeight = 48;
const stone = [140,2], light = [140,4], copper = [140,6], iron = [140,8];

// Obrys terasy souhlasí se společnou hranou městského měření ve výšce 7,10 m.
export function alignTheatreTerrace(city) {
  const id=city.buildingAt(-316.25,208.91);
  if(id<0) return;
  const b=city.b, ring=b.bRing[id];
  if(b.bRing[id+1]!==ring+1 || b.ringStart[ring+1]-b.ringStart[ring]!==19) return;
  city.bTop[id]=7.10;
  city.bWall[id]=7.10;
  return id;
}

export function theatreSurfaces(pack,shell,city,terraceBuilding) {
  if (pack.fileHash !== 'f495308f') return null;
  const p = shell.getAttribute('position'), painted = [], uv = [], fixtures = [];
  const replaced = new Set();
  const vertex = (point,ink) => { painted.push(...point); uv.push(ink[0]/atlasWidth,ink[1]/atlasHeight); };
  const face = (a,b,c,d,ink) => {
    for (const point of [a,b,c,a,c,d]) vertex(world(...point),ink);
  };
  const prism = (u0,u1,v0,v1,h0,h1,ink) => {
    const a=[u0,v0,h0], b=[u1,v0,h0], c=[u1,v1,h0], d=[u0,v1,h0];
    const upper = [a,b,c,d].map(([u,v])=>[u,v,h1]);
    const lower=[a,b,c,d];
    for (let i=0;i<4;i++) {
      const j=(i+1)%4;
      face(lower[i],lower[j],upper[j],upper[i],ink);
    }
    face(...upper,ink);
    face(d,c,b,a,ink);
  };
  const turned = (u,v,profile,ink,sides=10) => {
    const point = ([h,r],i) => [u+r*Math.cos(i*2*Math.PI/sides),v+r*Math.sin(i*2*Math.PI/sides),h];
    for (let k=1;k<profile.length;k++) for (let i=0;i<sides;i++) {
      face(point(profile[k-1],i),point(profile[k-1],i+1),point(profile[k],i+1),point(profile[k],i),ink);
    }
  };
  function coping(a,b,height,width,ink) {
    const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    const ox=-dz/len*width/2, oz=dx/len*width/2;
    const ends=[[a[0]+ox,a[1]+oz,a[2]],[a[0]-ox,a[1]-oz,a[2]],
      [b[0]-ox,b[1]-oz,b[2]],[b[0]+ox,b[1]+oz,b[2]]];
    const top=ends.map(([u,v,y])=>[u,v,y+height]);
    for(let i=0;i<4;i++) face(ends[i],ends[(i+1)%4],top[(i+1)%4],top[i],ink);
    face(...top,ink);
  }
  const edgeKeys = new Set();
  function rail(a,b,glass) {
    const length=Math.hypot(a[0]-b[0],a[1]-b[1]);
    if(length<.25) return;
    const key=[a,b].map(pt=>pt.map(x=>x.toFixed(2)).join('/')).sort().join('|');
    if(edgeKeys.has(key)) return;
    edgeKeys.add(key);
    const count=Math.ceil(length/(glass ? 2.1 : 2.8));
    const start=world(...a), end=world(...b);
    const yaw=Math.atan2(end[2]-start[2],end[0]-start[0]),width=length/count;
    for(let i=0;i<count;i++) {
      const t=(i+.5)/count, x=start[0]+(end[0]-start[0])*t, z=start[2]+(end[2]-start[2])*t;
      const y=start[1]+(end[1]-start[1])*t, tile=city.chunkIndex(x,z);
      const depth=glass ? .085 : .36;
      fixtures.push({id:'street/'+tile+'/divadlo-'+key+'/'+i,kind:glass ? 'theatreGlass' : 'balustrade',
        piece:glass ? 'sklo' : 'kamen',style:glass ? 'glass' : 'stone',tile,x,y,z,yaw,width,depth,
        height:glass ? 1.12 : 1.0,
        impulse:glass ? 700 : 30000,corners:streetCorners(x,y,z,yaw,width,depth)});
    }
  }
  // Tyto souvislé části ověřeného městského listu mají vlastní vrcholy.
  for (const [start,end] of [[705,2790],[17700,18414]]) for(let j=start;j<end;j+=3) {
    const ids=pack.i.subarray(j,j+3), first=ids[0]*3;
    const local=Array.from(ids,i=>{
      const x=p.getX(i)+326,z=p.getZ(i)-237;
      return [ax*x+az*z,-az*x+ax*z,p.getY(i)];
    });
    for(const i of ids) replaced.add(i);
    const facing=Math.abs(pack.n[first]*ax+pack.n[first+2]*az)/127;
    const horizontal=Math.abs(pack.n[first+1])>90;
    const uMid=(local[0][0]+local[1][0]+local[2][0])/3;
    const stageEnd=facing>.7 && uMid>31 && Math.max(...local.map(pt=>pt[2]))>25;
    const terrace=j>=2490 && j<2790;
    if(terrace && Math.abs(pack.n[first+1])<8) {
      const top=local.filter(pt=>pt[2]>7.05 && pt[2]<7.18);
      if(top.length===2) {
        const [a,b]=top, midU=(a[0]+b[0])/2, midV=(a[1]+b[1])/2;
        if(midU>33.6 || midV< -27.4) rail(a,b,true);
      }
    }
    // Malá střešní věžička dostane vlastní osmibokou lucernu.
    if ((j>=1995 && j<=2154) || (j>=2193 && j<=2244)) continue;
    for(let k=0;k<3;k++) {
      const [u,v,y]=local[k];
      let ink;
      if(j>=17700) ink = y<7.45 ? stone : light;
      else if(terrace) ink = horizontal ? [140,10] : [160+(facing>.65 ? v+38 : u-35)*.46,y];
      else if(j<885) ink = horizontal ? [140,10] : [148+(facing>.65 ? v+14 : u-54)*.73,12+y];
      else if(j>=1995 && j<2247) {
        ink=[82+(facing>.62 ? v+13 : u-7),31+(y-25)*.86];
      } else if(horizontal) ink = stone;
      else if(facing>.7 && uMid<10) ink=[21+v,y];
      else if(stageEnd) ink=[110+(v+13)*.80,y];
      else if(facing>.7 && uMid>52) ink=[21+v,Math.min(y,21.1)];
      else ink=[45+u,y];
      vertex([p.getX(ids[k]),y,p.getZ(ids[k])],ink);
    }
  }
  // Použij již zúžený index, aby současně zůstala viditelná úprava synagogy.
  shell.setIndex(Array.from(shell.index.array).filter(i=>!replaced.has(i)));

  // Druhá část terasy je v OSM. Převezmeme přesný půdorys i výšku herní střechy.
  if(terraceBuilding!==undefined) {
    const b=city.b, ring=b.bRing[terraceBuilding], start=b.ringStart[ring], end=b.ringStart[ring+1];
    const top=city.bTop[terraceBuilding], bottom=city.bBase[terraceBuilding], outline=[];
    for(let i=start;i<end;i++) {
      const x=city.bvx[i]+326,z=city.bvz[i]-237;
      outline.push([ax*x+az*z,-az*x+ax*z,top]);
    }
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length];
      for(const [pt,y] of [[a,bottom],[b,bottom],[b,top],[a,bottom],[b,top],[a,top]]) {
        vertex(world(pt[0],pt[1],y),[151+(pt[0]-8)*.69,1+(y-bottom)/(top-bottom)*6.65]);
      }
      if((a[1]+b[1])/2 < -21 && (a[0]+b[0])/2 < 27) rail(a,b,true);
    }
    const triangles=Earcut.triangulate(outline.flatMap(([u,v])=>[u,v]),null,2);
    for(const i of triangles) vertex(world(...outline[i]),[140,10]);
  }

  // Zábradlí sleduje zakřivenou hranu původní desky balkonu.
  const balcony=[[.0,-5.96],[-1.55,-5.68],[-2.55,-5.15],[-4.9,-2.28],[-5.02,2.99],[-3.02,5.50],[-2.22,6.09],[-1.1,6.55],[.05,6.75]];
  for(let j=1;j<balcony.length;j++){
    rail([...balcony[j-1],13.74],[...balcony[j],13.74],false);
  }
  for(const v of [-5.65,6.45]) prism(-.38,.18,v-.42,v+.42,13.7,14.83,stone);
  for(const v of [-11.18,11.96]) {
    prism(-.35,.65,v-.42,v+.42,8.1,21.58,stone);
    prism(-.52,.73,v-.59,v+.59,20.9,21.48,light);
  }
  coping([-.2,-11.5,21.60],[-.2,12.23,21.60],.37,.83,light);
  coping([7.8,-11.6,25.03],[7.8,.36,29.53],.28,.52,light);
  coping([7.8,.36,29.53],[7.8,12.5,25.03],.28,.52,light);

  // Nízké sokly, skládané drapérie a hlavy naznačují siluety soch na atice.
  function figure(u,v,h,size) {
    prism(u-.50*size,u+.50*size,v-.62*size,v+.62*size,h,h+.26*size,stone);
    turned(u,v,[[.26,.39],[.48,.35],[1.03,.21],[1.38,.34],[1.57,.20],
      [1.67,.13],[1.78,.205],[1.97,.18],[2.04,.03]].map(([y,r])=>[h+y*size,r*size]),light,8);
  }
  for(const [u,v,h] of [[.6,-10.1,23.4],[.6,11,23.4],[9.3,-17.4,23.4],[9.3,18,23.4]]) figure(u,v,h,.94);
  for(const [v,h,s] of [[-.28,29.63,.82],[.5,29.83,1.16],[1.34,29.5,.78]]) figure(7.94,v,h,s);
  turned(20.95,.4,[[28.85,1.84],[33.37,1.78],[33.56,1.97],[33.78,1.74],
    [34.35,1.62],[34.96,1.29],[35.38,.7],[35.58,.15],[36.12,.06]],copper,16);
  // Zakřivená plechová střecha jeviště dosedá do zaměřené římsy.
  const roofRings=[[30.42,8.43,12.68],[30.92,8.36,12.61],[32.8,8.23,12.48],
    [34.48,7.82,12.02],[36.0,7.18,11.4],[37.30,6.36,10.56],
    [38.46,5.29,9.52],[39.48,3.73,7.88]];
  function roofEdge([y,a,b]) {
    const cut=.64;
    return [[-a,-b+cut],[-a+cut,-b],[a-cut,-b],[a,-b+cut],
      [a,b-cut],[a-cut,b],[-a+cut,b],[-a,b-cut]].map(([u,v])=>[40.65+u,.34+v,y]);
  }
  for(let k=1;k<roofRings.length;k++) {
    const bottom=roofEdge(roofRings[k-1]),top=roofEdge(roofRings[k]);
    for(let i=0;i<8;i++) {
      const j=(i+1)%8;
      for(const pt of [bottom[i],bottom[j],top[j],bottom[i],top[j],top[i]]) {
        const along = i===1 || i===5 ? pt[0]-32 : pt[1]+13;
        vertex(world(...pt),[85+along,32+(pt[2]-30)*.9]);
      }
    }
  }
  const cap=roofEdge(roofRings.at(-1));
  for(let i=1;i<cap.length-1;i++) {
    for(const pt of [cap[0],cap[i],cap[i+1]]) vertex(world(...pt),copper);
  }
  for(const [u,v] of [[32.8,-12.0],[32.8,12.7],[48.46,-12.0],[48.46,12.7]]) {
    turned(u,v,[[30.43,.35],[30.77,.30],[31.06,.18],[31.3,.24],[31.66,.16],[31.82,.025]],light);
  }
  for(const [u,v] of [[-3.8,4.0],[-4.9,2.9],[-4.9,2],[-5,-1.3],[-5,-2.15],[-3.85,-3.25]]) {
    turned(u,v,[[7.02,.33],[7.26,.35],[7.46,.255],[7.52,.205]],stone);
    turned(u,v,[[12.5,.21],[12.64,.28],[12.87,.34],[13.03,.37]],light);
  }
  prism(37.18,44.1,-7.23,8.1,39.35,40.5,copper);
  prism(36.96,44.32,-7.45,8.32,40.48,40.75,iron);
  turned(40.6,.43,[[40.74,.21],[41.1,.13],[41.4,.2],[41.58,.08],[42.3,.025]],iron);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(painted,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return {geometry,fixtures};
}

export function theatreMaterial() {
  const map = new THREE.TextureLoader().load(new URL('./theatre-front.svg',import.meta.url).href);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  return new THREE.MeshStandardNodeMaterial({map,side:THREE.DoubleSide,roughness:.84});
}
