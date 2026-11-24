import * as THREE from 'three/webgpu';
import { attribute, color, mix, positionLocal, positionWorld, sin, vec2, vec3, vertexColor } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { valueNoise } from './material-noise.js';
import { bridgeRails, easternFeature, roundMask } from './strouha-model.js';
import { easternSites, reedBeds } from './strouha-layout.js';
import { bankPlants } from './strouha-plants.js';
import { civicStatue, gardenFountain, leafArches } from './kopecky-fountains.js';
import { beds, benches, features } from './sady-layout.js';
import { streetFixtures, drawStreetFixture } from './street-furniture.js';
import { SolidBuf } from './solid-buffer.js';
import { attachRoadFurniture } from './road-furniture.js';
import { Octree } from 'three/addons/math/Octree.js';

// Spojení vlastních tvarů do jedné sítě. Druh povrchu rozlišuje kámen, hladinu a proud.
function parts(detail) {
  const items=[];
  function add(geometry,tint,type=0) {
    const geo=geometry.index ? geometry.toNonIndexed() : geometry;
    if(geo!==geometry) geometry.dispose();
    geo.deleteAttribute('uv');
    if (tint===undefined) {items.push(geo);return;}
    const n=geo.attributes.position.count,c=new THREE.Color(tint),rgb=new Float32Array(n*3);
    for(let j=0;j<rgb.length;j+=3){rgb[j]=c.r;rgb[j+1]=c.g;rgb[j+2]=c.b;}
    geo.setAttribute('color',new THREE.BufferAttribute(rgb,3));
    geo.setAttribute('wet',new THREE.Float32BufferAttribute(new Float32Array(n).fill(type),1));
    items.push(geo);
  }
  function box(x,y,z,w,h,d,tint,rotation=0) {
    add(new THREE.BoxGeometry(w,h,d).rotateY(rotation).translate(x,y,z),tint);
  }
  function disk(x,y,z,base,top,h,tint,n=32,type=0) {
    add(new THREE.CylinderGeometry(top,base,h,n).translate(x,y,z),tint,type);
  }
  function oval(x,y,z,rx,ry,rz,tint,angle=0) {
    add(new THREE.SphereGeometry(1,detail ? 10 : 6,detail ? 7 : 4).scale(rx,ry,rz).rotateZ(angle).translate(x,y,z),tint);
  }
  function rod(a,b,r,tint,type=0) {
    const ax=new THREE.Vector3(...a),bx=new THREE.Vector3(...b),dir=bx.clone().sub(ax);
    const g=new THREE.CylinderGeometry(r,r,dir.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
    const mid=ax.add(bx).multiplyScalar(.5);
    add(g.translate(mid.x,mid.y,mid.z),tint,type);
  }
  function finish() {
    const geo=mergeGeometries(items);
    for(const item of items) item.dispose();
    return geo;
  }
  return {add,box,disk,oval,rod,finish};
}

function rusalka(m,detail,flow,collider) {
  const w=9.1,d=9.25,lip=.36, stone=0x817e77;
  // Nádrž má dno i čtyři samostatné obruby. Hladina leží pod jejich horní hranou.
  m.box(0,-.36,0,w,.74,d,stone);
  for(const sign of [-1,1]) {
    m.box(0,.12,sign*(d-lip)/2,w,.24,lip,stone);
    m.box(sign*(w-lip)/2,.12,0,lip,.24,d-2*lip,stone);
  }
  m.add(new THREE.PlaneGeometry(w-2*lip,d-2*lip).rotateX(-Math.PI/2).translate(0,.14,0),0x3b6459,1);
  m.disk(0,.38,0,.62,.54,.60,0x897448);
  // Tři mělké reliéfy se rozevírají kolem trojbokého kamenného jádra.
  m.add(new THREE.CylinderGeometry(1.13,1.02,2.18,3).rotateY(Math.PI/3).translate(0,1.66,0),0x786952);
  for(let i=0;i<3;i++) {
    const a=i*2*Math.PI/3;
    const side=parts(detail);
    side.box(0,1.72,.47,1.69,2.1,.24,0x71634d);
    if(collider) {m.add(side.finish().rotateY(a));continue;}
    if(i<2){
      const k=i===0?1:-1;
      side.oval(.07*k,2.35,.64,.15,.21,.09,0x9b8561);
      const robe=new THREE.Shape();
      robe.moveTo(-.11,2.19);
      robe.bezierCurveTo(-.36,2.05,-.15,1.89,-.19,1.74);
      robe.bezierCurveTo(-.23,1.50,-.43,1.13,-.52,1.0);
      robe.quadraticCurveTo(-.29,.90,-.14,1.0);
      robe.quadraticCurveTo(.01,.94,.17,1.01);
      robe.quadraticCurveTo(.25,.96,.36,1.04);
      robe.bezierCurveTo(.22,1.43,.13,1.64,.12,1.80);
      robe.quadraticCurveTo(.36,2.02,.14,2.19);
      robe.closePath();
      const relief=new THREE.ExtrudeGeometry(robe,{depth:.045,bevelEnabled:true,bevelThickness:.022,bevelSize:.024,bevelSegments:1,curveSegments:5});
      if(k<0) relief.rotateY(Math.PI);
      side.add(relief.translate(0,0,k<0?.71:.64),0x96846c);
      for (const shift of [-.17,.05,.20]) {
        const fold=new THREE.CatmullRomCurve3([[shift*.2,1.84,.715],[shift*.65-.04,1.52,.73],
          [shift*1.55-.03,1.05,.715]].map(([u,h,v])=>new THREE.Vector3(k*u,h,v)));
        side.add(new THREE.TubeGeometry(fold,6,.021,4,false),0xb19b7a);
      }
      side.rod([.15*k,2.09,.68],[.34*k,2.17,.72],.064,0xa39070);
      side.rod([.34*k,2.17,.72],[.46*k,2.39,.70],.052,0xad9978);
      side.rod([-.13*k,2.11,.68],[-.39*k,1.97,.72],.065,0x998462);
      side.rod([-.39*k,1.97,.72],[-.51*k,2.09,.70],.052,0xa39070);
    }
    for(let k=0;k<(detail?4:2);k++) {
      const curve=new THREE.CatmullRomCurve3([[-.62,1.0+k*.13,.63],[-.38,1.55+k*.12,.65],
        [.28,1.63+k*.17,.64],[.62,2.16+k*.12,.63]].map(p=>new THREE.Vector3(...p)));
      side.add(new THREE.TubeGeometry(curve,detail?12:6,.035,4,false),0x998464);
    }
    m.add(side.finish().rotateY(a));
    if(flow) {
      const at=(u,y,v)=>[u*Math.cos(a)+v*Math.sin(a),y,-u*Math.sin(a)+v*Math.cos(a)];
      for(const u of [-.62,.58]) m.rod(at(u,.69,.60),at(u,.14,.61),.019,0xb7d5c9,2);
    }
  }
}

function leknin(m,detail,flow,collider) {
  const n=collider?12:detail?48:24;
  m.disk(0,.08,0,1.14,1.14,.19,0x8e9291,n);
  for(let i=0;!collider && i<12;i++) {
    const a=i*Math.PI/6;
    m.rod([.43*Math.cos(a),.177,.43*Math.sin(a)],[1.12*Math.cos(a),.177,1.12*Math.sin(a)],.008,0x727675);
  }
  m.disk(0,.28,0,.34,.36,.22,0x706a65);
  // Vyseknuté části mramoru po obvodu společné prohlubně připomínají listy leknínu.
  for(const [start,end,peak,tint] of [[.13,2.74,.89,0xaa9691],[2.95,4.27,.97,0xbaaaa2],[4.49,6.18,.82,0x99877f]]) {
    const shape=new THREE.Shape();
    shape.absarc(0,0,.47,start,end,false);
    shape.absarc(0,0,.16,end,start,true);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:collider?3:detail?18:8});
    const pos=geo.attributes.position;
    for(let j=0;j<pos.count;j++) {
      const x=pos.getX(j),z=pos.getY(j);
      const h=.58+(peak-.58)*(Math.hypot(x,z)-.16)/.31+.09*x;
      pos.setXYZ(j,x,pos.getZ(j)>.5?h:.34,-z);
    }
    geo.computeVertexNormals();m.add(geo,tint);
  }
  m.disk(0,.55,0,.19,.19,.035,0x5f7772,24,1);
  if(collider) return;
  m.oval(.06,.64,.04,.047,.064,.047,0x756747);
  if(flow){
    const arc=new THREE.CatmullRomCurve3([[.06,.69,.04],[.025,.77,.01],[-.035,.77,-.025],[-.10,.58,-.07]].map(p=>new THREE.Vector3(...p)));
    m.add(new THREE.TubeGeometry(arc,10,.012,5,false),0xc1ddd9,2);
  }
}

function monument(m,collider) {
  for(const [y,w,h,c] of [[.08,2.75,.28,0xa19685],[.32,2.28,.25,0xc5bba9],[.53,1.9,.20,0xa59a89],
    [1.42,1.54,1.62,0xb7aa93],[2.29,1.74,.15,0xb3a58e],[2.44,1.88,.16,0xc4b8a2]]) m.box(0,y,0,w,h,w,c);
  const bronze=0x555b50;
  if(collider) {
    m.disk(0,3.23,0,.45,.29,1.44,bronze,8);
    m.disk(0,4.23,0,.29,.15,.83,bronze,8);
    return;
  }
  m.oval(-.16,2.6,.08,.17,.10,.28,bronze);m.oval(.16,2.6,.04,.16,.1,.25,bronze);
  m.add(new THREE.CylinderGeometry(.27,.48,1.08,14).scale(1,1,.68).translate(0,3.15,0),bronze);
  m.oval(0,3.89,0,.35,.44,.24,bronze);
  m.oval(0,4.43,.025,.18,.24,.18,bronze);
  m.rod([-.27,4.07,0],[-.33,3.72,.16],.115,bronze);
  m.rod([-.33,3.72,.16],[-.06,3.77,.31],.09,bronze);
  m.rod([.27,4.07,0],[.34,3.50,.11],.11,bronze);
  m.box(-.09,3.79,.30,.32,.075,.25,0x696b59,-.18);
}

const easternIds = new Set(easternSites.map(site => site.id));

export function featureGeometry(spec,detail,flow,collider=false) {
  const model=parts(detail);
  if(easternIds.has(spec.id)) easternFeature(model,spec,detail,collider);
  else if(spec.id==='rusalka') rusalka(model,detail,flow,collider);
  else if(spec.id==='leknin') leknin(model,detail,flow,collider);
  else if(spec.id==='smetana') monument(model,collider);
  else if(spec.id==='bedrich' || spec.id==='kopecky') civicStatue(model,spec.id,collider);
  else if(spec.id==='loubi') {
    if(collider) {
      for(let i=0;i<8;i++) model.box((i-3.5)*3.2,.80,0,.16,1.6,.16,0x405342);
      model.box(0,2.82,0,22.4,.19,.15,0x405342);
    } else leafArches(model,detail);
  } else gardenFountain(model,spec,detail,flow,collider);
  const geometry=model.finish();
  if (['kouzelnice','ptak','ryba'].includes(spec.id)) roundMask(geometry);
  return geometry.rotateY(-spec.angle);
}

function flowerBed(world,bed,detail) {
  const [x,z,rx,rz,yaw]=bed, cs=Math.cos(yaw),sn=Math.sin(yaw);
  const buf=new SolidBuf();
  const at=(u,v,h)=>{
    const px=x+u*cs-v*sn,pz=z+u*sn+v*cs;
    return [px,world.heightAt(px,pz)+h,pz];
  };
  const leaf=[.095,.205,.064], edging=[.19,.225,.095];
  const palette=[[.72,.25,.13],[.92,.68,.28],[.81,.72,.63],[.46,.25,.52]];
  const slices=30, center=at(0,0,.12);
  for(let i=0;i<slices;i++){
    const a=i*2*Math.PI/slices,b=(i+1)*2*Math.PI/slices;
    const rim=(t,s,h)=>at(rx*s*Math.cos(t),rz*s*Math.sin(t),h);
    buf.quad(center,rim(b,.93,.14),rim(a,.93,.14),center,leaf);
    buf.quad(rim(a,.93,.14),rim(b,.93,.14),rim(b,1,.035),rim(a,1,.035),edging);
  }
  const step=detail?.47:.72;
  for(let row=0;row*step<rz*2;row++) for(let col=0;col*step<rx*2;col++) {
    const noise=Math.sin(row*37+col*19+x);
    const u=-rx+(col+.4+noise*.17)*step,v=-rz+(row+.5+.22*Math.cos(col*19))*step;
    if((u/rx)**2+(v/rz)**2>.82) continue;
    const tint=palette[(Math.floor((v/rz+1)*2.4 + .52*Math.sin(u/rx*4)) + 4)%4];
    const h=.25+.11*(1+noise), width=step*.45, apex=at(u,v,h+.055);
    for(let j=0;j<3;j++) {
      const a=j*Math.PI*2/3+noise*2,cu=u+width*.46*Math.cos(a),cv=v+width*.46*Math.sin(a);
      const leafTip=at(cu+width*.6*Math.cos(a),cv+width*.6*Math.sin(a),h-.045);
      buf.quad(at(cu-width*.38*Math.sin(a),cv+width*.38*Math.cos(a),h-.035),apex,
        at(cu+width*.38*Math.sin(a),cv-width*.38*Math.cos(a),h-.035),leafTip,tint,.79+.09*j);
    }
    if(detail) buf.quad(at(u-.13,v,.13),at(u+.17,v+.08,.17),at(u+.04,v,h),at(u-.04,v,h),leaf,1.3);
  }
  return buf.geometry();
}

export function createSady(world) {
  if (features.every(site=>world.chunkIndex(site.x,site.z)<0)) return null;
  const tiles=new Map(),solids=[];
  const tileAt=(x,z)=>{
    const ci=world.chunkIndex(x,z);
    if(!tiles.has(ci)) tiles.set(ci,{sites:[],beds:[],benches:[],rails:[],reeds:[],collision:[]});
    return tiles.get(ci);
  };
  for(const spec of features) {
    if(world.chunkIndex(spec.x,spec.z)<0) continue;
    let ground=world.heightAt(spec.x,spec.z);
    // Vodorovná nádrž stojí ve svahu. Obruba musí vystoupit i na jeho vyšší straně.
    if (spec.id==='rusalka' || spec.rx) {
      const c=Math.cos(spec.angle),s=Math.sin(spec.angle);
      const rim=spec.rx ? Array.from({length:16},(_,i)=>[spec.rx*Math.cos(i*Math.PI/8),spec.rz*Math.sin(i*Math.PI/8)])
        : [[-4.55,-4.63],[4.55,-4.63],[-4.55,4.63],[4.55,4.63]];
      for(const [u,v] of rim) ground=Math.max(ground,world.heightAt(spec.x+c*u-s*v,spec.z+s*u+c*v));
    }
    const site={...spec,ground,tree:new Octree()};
    if (spec.wall) site.levels=spec.wall.map(([u,v]) => world.heightAt(spec.x+u,spec.z+v)-ground);
    if (spec.id==='lavka') {
      for (const rail of bridgeRails(ground,world)) tileAt(rail.x,rail.z).rails.push(rail);
    }
    const geo=featureGeometry(site,false,false,true);
    geo.translate(site.x,ground,site.z);
    const {position,wet}=geo.attributes;
    for(let i=0;i<position.count;i+=3) {
      if(wet.getX(i)) continue;
      const vertices=[i,i+1,i+2].map(j=>new THREE.Vector3().fromBufferAttribute(position,j));
      const tri=new THREE.Triangle(...vertices);
      if(tri.getArea()<.000001) continue;
      const center=tri.getMidpoint(new THREE.Vector3());
      const {collision}=tileAt(center.x,center.z);
      for(const v of vertices) collision.push(v.x,v.y,v.z);
      site.tree.addTriangle(tri);
    }
    site.tree.build();geo.dispose();
    tileAt(site.x,site.z).sites.push(site);
    solids.push(site);
  }
  for(const patch of reedBeds) {
    const [x,z]=patch[0];
    if (world.chunkIndex(x,z)>=0) tileAt(x,z).reeds.push(patch);
  }
  for(const bed of beds) if (world.chunkIndex(bed[0],bed[1])>=0) tileAt(bed[0],bed[1]).beds.push(bed);
  for(const [i,[x,z,yaw]] of benches.entries()) {
    if (world.chunkIndex(x,z)<0) continue;
    const fixtures=streetFixtures({id:'sady-lavicka-'+i,kind:'bench',x,z,yaw},world);
    tileAt(x,z).benches.push(...fixtures);
  }
  // Při rozšiřování okruhu určí dosah kolizí samotné modely, včetně přesahů mezi dlaždicemi.
  const bounds=new THREE.Box3();
  const groups=new Map();
  for(const site of solids) {
    bounds.union(site.tree.bounds);
    const tile=world.chunkIndex(site.x,site.z);
    if (!groups.has(tile)) groups.set(tile,{bounds:new THREE.Box3(),sites:[]});
    const group=groups.get(tile);
    group.bounds.union(site.tree.bounds);
    group.sites.push(site);
  }
  return {tiles,solids,bounds,groups:[...groups.values()]};
}

function parkMaterial(clock,flow,detail) {
  const mat=new THREE.MeshStandardNodeMaterial({roughness:.72,side:THREE.DoubleSide});
  const wet=attribute('wet','float');
  let tint=vertexColor().rgb;
  if(detail) {
    const grain=vec2(positionLocal.x.add(positionLocal.z.mul(.58)),positionLocal.y.add(positionLocal.z.mul(.37)));
    const tone=valueNoise(grain.mul(6.4)).mul(.20).add(.88);
    tint=mix(tint.mul(tone),tint,wet.greaterThan(0));
  }
  if(flow) {
    // Všechny vrcholy jednoho proudu dostanou stejnou fázi, výtok zůstává u hladiny.
    const pulse=sin(clock.mul(1.35).add(wet.mul(1.67))).mul(.22).add(.78);
    const height=positionLocal.y.sub(.16).mul(pulse).add(.16);
    mat.positionNode=vec3(positionLocal.x,mix(positionLocal.y,height,wet.greaterThan(2)),positionLocal.z);
    const phase=positionWorld.x.mul(4.3).add(positionWorld.z.mul(2.1)).sub(clock.mul(2.4));
    const radius=positionLocal.xz.length();
    const circle=sin(radius.mul(18).add(sin(phase).mul(.6)).sub(clock.mul(4.3)));
    const lace=circle.smoothstep(.63,.99).mul(radius.mul(-.22).add(1).clamp()).mul(.085);
    const wave=detail
      ? sin(phase).add(sin(positionWorld.z.mul(6).add(clock.mul(1.9)))).mul(.045).add(.10).add(lace)
      : sin(phase).mul(.045).add(.10);
    tint=mix(tint,mix(tint,color(0xc5e2cf),wave),wet.greaterThan(0));
  }
  mat.colorNode=tint;
  mat.roughnessNode=mix(.85,.22,wet.greaterThan(0));
  return mat;
}

export function buildSady(world,tile,owner,solidMaterial,detail,flow,clock) {
  function attach(geo,mat,name) {
    const mesh=new THREE.Mesh(geo,mat);
    mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=true;
    owner.group.add(mesh);owner.disposables.push(geo);
    return mesh;
  }
  // Drobné vybavení za hranicí čitelnosti nezatěžuje ani stínovou mapu.
  function limitDistance(mesh, distance) {
    const geo=mesh.geometry;
    geo.computeBoundingSphere();
    const lod=new THREE.LOD();
    lod.position.copy(geo.boundingSphere.center).add(mesh.position);
    mesh.position.sub(lod.position);
    lod.addLevel(mesh,0);
    lod.addLevel(new THREE.Object3D(),distance,.08);
    owner.group.add(lod);
  }
  if(tile.sites.length) {
    const mat=tile.sites.some(site => !easternIds.has(site.id)) ? parkMaterial(clock,flow,detail) : null;
    if (mat) owner.disposables.push(mat);
    for(const site of tile.sites) {
      const dry = !site.rx && ['smetana','bedrich','kopecky','loubi'].includes(site.id);
      const mesh=attach(featureGeometry(site,detail,flow),easternIds.has(site.id) || (!detail && dry) ? solidMaterial : mat,site.name);
      mesh.position.set(site.x,site.ground,site.z);
      if (easternIds.has(site.id)) {
        const large=site.wall || ['lavka','terasa','arch'].includes(site.id);
        const distance=large ? 430 : 145;
        limitDistance(mesh,detail ? distance : distance*.55);
      }
    }
  }
  if(tile.beds.length) {
    const geometries=tile.beds.map(b=>flowerBed(world,b,detail));
    const mesh=attach(mergeGeometries(geometries),solidMaterial,'Záhony Smetanových sadů');
    mesh.castShadow=false;
    limitDistance(mesh,detail ? 215 : 140);
    for(const g of geometries) g.dispose();
  }
  if(tile.reeds.length) {
    const geo=bankPlants(world,tile.reeds,detail);
    if (geo) {
      const plants=attach(geo,solidMaterial,'Pobřežní porost Mlýnské strouhy');
      plants.castShadow=false;
      limitDistance(plants,detail ? 230 : 155);
    }
  }
  if(tile.benches.length || tile.rails.length) {
    const buf=new SolidBuf(),ranges=[];
    for(const fixture of [...tile.benches,...tile.rails]) {
      const start=buf.p.length;
      drawStreetFixture(buf,fixture,detail);
      ranges.push({fixture,start,end:buf.p.length});
    }
    const mesh=attach(buf.geometry(),solidMaterial,'Lavičky ve Smetanových sadech');
    limitDistance(mesh,detail ? 155 : 115);
    owner.sadyBenches=attachRoadFurniture(world.breakables,owner.group,mesh.geometry,solidMaterial,ranges);
  }
}
