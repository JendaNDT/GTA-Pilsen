// Vlastní výtvarný model historických budov na Borech. Půdorysy patří základní mapě.
import * as THREE from 'three/webgpu';
import { HeritageRoofs } from './heritage-geometry.js';

const origin=[-1215,2771];
const angle=Math.atan2(.52,.854), cs=Math.cos(angle), sn=Math.sin(angle);
function point(u,y,v) { return [origin[0]+u*sn+v*cs,y,origin[1]-u*cs+v*sn]; }
function local(x,z) { return [(x-origin[0])*sn-(z-origin[1])*cs,(x-origin[0])*cs+(z-origin[1])*sn]; }
const ink={
  gate:[1,1,599,149], sign:[622,1,858,99], blind:[876,1,1199,149], hall:[1,171,1199,339],
  arches:[1,346,603,430], drum:[632,351,766,429], lantern:[783,351,859,429],
  green:[2,446,428,598], slate:[432,446,778,598], copper:[791,446,1009,598],
  skylight:[622,113,857,156], wing:[871,346,944,437], portal:[957,346,1195,437],
  trim:[1082,451,1198,497], stone:[1082,502,1198,548], dark:[1082,553,1198,598],
};

export function createBorySite(w) {
  const at=(u,v)=>{const [x,,z]=point(u,0,v);return w.buildingAt(x,z);};
  const gate=at(-3,3), left=at(-22,2), right=at(16,2), hall=at(-3,-26);
  const drum=at(-3,-124), chapel=at(-3,-70);
  const ids=[gate,left,right,hall,drum,chapel];
  if (ids.includes(-1) || new Set(ids).size!==ids.length) return null;
  const cx=(w.bMinX[drum]+w.bMaxX[drum])/2, cz=(w.bMinZ[drum]+w.bMaxZ[drum])/2;
  if (Math.abs(w.bMaxX[drum]-w.bMinX[drum]-27)>3 || w.b.hTop[gate]<55 || w.b.hTop[gate]>90) return null;
  const historic=new Set(ids), wings=new Set();
  // Paprskům starého hvězdicového domu stačí výrazné valby a souvislé okrové stěny.
  for(let i=0;i<8;i++){
    const a=angle+i*Math.PI/4;
    const id=w.buildingAt(cx+47*Math.cos(a),cz+47*Math.sin(a));
    if(id<0 || ids.includes(id) || w.b.hWall[id]<=90) continue;
    wings.add(id);
    historic.add(id);
  }
  const site={gate,left,right,hall,drum,chapel,cx,cz,historic,wings,tile:w.chunkIndex(cx,cz)};
  site.roofs=new HeritageRoofs();
  site.collision=new Map();
  const low=boryGeometry(w,site,false);
  const positions=low.getAttribute('position'), indices=[];
  for(let i=0;i<positions.count;i+=3) {
    const points=[i,i+1,i+2].map(j=>[positions.getX(j),positions.getY(j),positions.getZ(j)]);
    const [a,b,c]=points;
    const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(Math.abs(up)<.001) continue;
    indices.push(i,i+1,i+2);
    const tile=w.chunkIndex((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3);
    if(!site.collision.has(tile)) site.collision.set(tile,[]);
    site.collision.get(tile).push(up>0 ? points : [a,c,b]);
  }
  site.roofs.add({p:positions.array,indices},0);
  low.dispose();
  return site;
}

function outline(w,id) {
  const r=w.b.bRing[id], points=[];
  for(let v=w.b.ringStart[r];v<w.b.ringStart[r+1];v++)
    points.push(local(w.bvx[v],w.bvz[v]));
  return points;
}

export function boryGeometry(w,site,detailed) {
  const positions=[],uvs=[];
  function triangle(a,b,c,rect,coords) {
    const [x,y,x1,y1]=rect;
    for(const [i,p] of [a,b,c].entries()) {
      positions.push(...p);
      const [s,t]=coords[i];
      uvs.push((x+(x1-x)*s)/1200,1-(y+(y1-y)*t)/600);
    }
  }
  const ll=[0,1],lr=[1,1],ur=[1,0],ul=[0,0];
  function quad(a,b,c,d,rect) {
    triangle(a,b,c,rect,[ll,lr,ur]); triangle(a,c,d,rect,[ll,ur,ul]);
  }
  function box(u,v,width,depth,bottom,top,front,other=ink.stone) {
    const corners=[[u-width/2,v+depth/2],[u+width/2,v+depth/2],[u+width/2,v-depth/2],[u-width/2,v-depth/2]];
    const ring=y=>corners.map(([s,t])=>point(s,y,t));
    const lo=ring(bottom),hi=ring(top);
    for(let i=0;i<4;i++) { const j=(i+1)%4;quad(lo[i],lo[j],hi[j],hi[i],i===0?front:other); }
    quad(...hi,other);
  }
  function hip(u,v,width,depth,eave,rise,rect) {
    const a=point(u-width/2,eave,v+depth/2),b=point(u+width/2,eave,v+depth/2);
    const c=point(u+width/2,eave,v-depth/2),d=point(u-width/2,eave,v-depth/2);
    const ridge=Math.max(.1,width-depth)/2;
    const l=point(u-ridge,eave+rise,v),r=point(u+ridge,eave+rise,v);
    quad(a,b,r,l,rect); triangle(b,c,r,rect,[ll,lr,[.5,0]]);
    quad(c,d,l,r,rect); triangle(d,a,l,rect,[ll,lr,[.5,0]]);
  }

  // Stejná okenní osa se skládá podél každé strany křídla, včetně čelních štítů.
  for (const id of site.wings) {
    const ring=outline(w,id), eave=w.bWall[id],ground=w.bBase[id],top=w.bTop[id];
    let longest=0, axisU=0, axisV=1;
    for(let i=0;i<ring.length;i++) {
      const [a,b]=ring[i],[c,d]=ring[(i+1)%ring.length];
      const length=Math.hypot(c-a,d-b);
      if(length<.5) continue;
      if(length>longest) {longest=length;axisU=(c-a)/length;axisV=(d-b)/length;}
      const du=(d-b)/length*.045, dv=-(c-a)/length*.045;
      const bays=Math.max(1,Math.round(length/3.7));
      for(let j=0;j<bays;j++){
        const at=(f,y)=>point(a+(c-a)*f+du,y,b+(d-b)*f+dv);
        quad(at(j/bays,ground),at((j+1)/bays,ground),at((j+1)/bays,eave),at(j/bays,eave),ink.wing);
      }
    }
    // Světlíky v pravidelném výtvarném rytmu člení velké plochy při přeletu.
    if(!detailed || longest<22 || top-eave<1) continue;
    const axis=ring.map(([u,v])=>u*axisU+v*axisV);
    const cross=ring.map(([u,v])=>-u*axisV+v*axisU);
    const start=Math.min(...axis),end=Math.max(...axis),mid=(Math.min(...cross)+Math.max(...cross))/2;
    const span=(Math.max(...cross)-Math.min(...cross))/2;
    const at=(s,t,y)=>point(s*axisU-(mid+t)*axisV,y,s*axisV+(mid+t)*axisU);
    for(const f of [.25,.5,.75]) {
      const s=start+(end-start)*f;
      for(const side of [-1,1]) {
        const y=top-(top-eave)*2.4/span+.16;
        quad(at(s-1.45,0,top+.32),at(s+1.45,0,top+.32),at(s+1.45,side*2.4,y),at(s-1.45,side*2.4,y),ink.skylight);
      }
    }
  }
  // Kresba navazuje i přes mělké výstupky uličních průčelí.
  for(const [id,material,threshold] of [[site.left,ink.blind,7],[site.right,ink.blind,7],
    [site.gate,ink.gate,7],[site.hall,ink.hall,-26]]){
    const ring=outline(w,id), along=ring.map(p=>p[0]),min=Math.min(...along),max=Math.max(...along);
    const [x,y,x1,y1]=material;
    const top=w.bWall[id]+.02,bottom=w.bBase[id]-.04;
    for(let i=0;i<ring.length;i++) {
      const [a,v]=ring[i],[b,t]=ring[(i+1)%ring.length];
      if (v<threshold || t<threshold || Math.abs(a-b)<.08) continue;
      const left=x+(x1-x)*(a-min)/(max-min),right=x+(x1-x)*(b-min)/(max-min);
      quad(point(a,bottom,v+.075),point(b,bottom,t+.075),point(b,top,t+.075),point(a,top,v+.075),[left,y,right,y1]);
    }
  }

  box(-3,-22.15,6.2,.9,w.bBase[site.hall],w.bGround[site.hall]+6.3,ink.portal);
  const g=w.bTop[site.gate], h=w.bWall[site.hall];
  hip(-3.3,2.2,30.4,11.9,g+.04,2.35,ink.green);
  box(-3.25,7.84,8.5,1.0,g-1.25,g+1.85,ink.sign);
  if(detailed)box(-3.25,7.84,8.85,1.13,g+1.83,g+2.04,ink.trim);
  box(-3,-28.9,20.9,13.8,h-.12,h+4.2,ink.arches,ink.arches);
  hip(-3,-28.9,21.7,14.5,h+4.2,2.6,ink.slate);

  const chapelTop=w.bTop[site.chapel];
  // Podélná střecha historické kaple doplňuje původní plochý strop.
  const chapelRing=outline(w,site.chapel);
  const us=chapelRing.map(p=>p[0]),vs=chapelRing.map(p=>p[1]);
  const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
  const mid=(minU+maxU)/2;
  const near=minV+6,far=maxV-6,rise=3.3;
  const ridgeA=point(mid,chapelTop+rise,near),ridgeB=point(mid,chapelTop+rise,far);
  const a=point(minU,chapelTop+.03,minV),b=point(maxU,chapelTop+.03,minV);
  const c=point(maxU,chapelTop+.03,maxV),d=point(minU,chapelTop+.03,maxV);
  triangle(a,b,ridgeA,ink.green,[ll,lr,[.5,0]]);quad(b,c,ridgeB,ridgeA,ink.green);
  triangle(c,d,ridgeB,ink.green,[ll,lr,[.5,0]]);quad(d,a,ridgeA,ridgeB,ink.green);
  const lampV=far-4, foot=chapelTop+rise;
  box(mid,lampV,1.4,1.4,foot-.25,foot+2.1,ink.lantern,ink.lantern);
  hip(mid,lampV,2.0,2.0,foot+2.1,2.3,ink.slate);

  // Osmiboký tambur a vypouklá žebrovaná kopule mají siluetu ze všech směrů.
  const [du,dv]=local(site.cx,site.cz), eave=w.bWall[site.drum], peak=w.bTop[site.drum]+1;
  const radius=(w.bMaxX[site.drum]-w.bMinX[site.drum])/2;
  const circle=(a,r,y)=>point(du+r*Math.cos(a),y,dv+r*Math.sin(a));
  const drumRadius=radius*.96;
  const baseRing=outline(w,site.drum);
  for(let i=0;i<baseRing.length;i++){
    const [u,v]=baseRing[i],[s,t]=baseRing[(i+1)%baseRing.length];
    const length=Math.hypot(s-u,t-v);
    if(length<.1) continue;
    const ou=(t-v)*.08/length,ov=(u-s)*.08/length;
    const a=point(u+ou,eave+.15,v+ov),b=point(s+ou,eave+.15,t+ov);
    quad(point(u+ou,eave-5.3,v+ov),point(s+ou,eave-5.3,t+ov),b,a,length>3?ink.drum:ink.trim);
    triangle(a,b,point(du,eave+.1,dv),ink.stone,[ll,lr,ur]);
  }
  const facets=detailed?48:24, rings=detailed?9:5;
  function dome(i,f) {
    const angle=i/facets*2*Math.PI, phi=f*Math.PI/2;
    return circle(angle,drumRadius*Math.cos(phi),eave+.14+(peak-eave)*Math.sin(phi));
  }
  for(let j=0;j<rings;j++)for(let i=0;i<facets;i++){
    const p=dome(i,j/rings),q=dome(i+1,j/rings);
    const rect=j===rings-1?ink.trim:ink.copper;
    if(j===rings-1) triangle(p,q,dome(i,1),rect,[ll,lr,[.5,0]]);
    else {
      const u=(i%4)/4,v=((i%4)+1)/4,lower=1-j/rings,upper=1-(j+1)/rings;
      const highQ=dome(i+1,(j+1)/rings),highP=dome(i,(j+1)/rings);
      triangle(p,q,highQ,rect,[[u,lower],[v,lower],[v,upper]]);
      triangle(p,highQ,highP,rect,[[u,lower],[v,upper],[u,upper]]);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  return geo;
}

export function buildBory(world,owner,detailed) {
  const geo=boryGeometry(world,world.bory,detailed);
  const map=new THREE.TextureLoader().load(new URL('./bory.svg',import.meta.url).href);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=detailed?4:2;
  const material=new THREE.MeshStandardNodeMaterial({map,roughness:.84,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,material);
  mesh.name='Historická věznice Bory';
  mesh.castShadow=mesh.receiveShadow=true;
  owner.group.add(mesh);owner.disposables.push(geo,material,map);
}
