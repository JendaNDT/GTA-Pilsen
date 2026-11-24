import * as THREE from 'three/webgpu';
import { pavilionFaces, pavilionParts, pavilionPoint, terrace } from './pavilion-site.js';
import { SolidBuf } from './solid-buffer.js';
import { attachRoadFurniture } from './road-furniture.js';

const pixel=(x,y)=>[x/1024,1-y/512];
const plaster=pixel(40,435), pale=pixel(120,435), metal=pixel(200,435), lead=pixel(280,435);
const coping=pixel(360,435), render=pixel(440,435);
export function pavilionGeometry(site) {
  const pos=[], uv=[];
  function face(vertices,paint) {
    for (const i of vertices.length===4 ? [0,1,2,0,2,3] : [0,1,2]) {
      pos.push(...pavilionPoint(site,...vertices[i]));
      uv.push(...(typeof paint==='function' ? paint(vertices[i]) : paint));
    }
  }
  function box(u,v,w,d,low,high,ink) {
    const corners=[[u-w,v+d],[u+w,v+d],[u+w,v-d],[u-w,v-d]];
    const upper=corners.map(([x,z])=>[x,high,z]);
    face(upper,ink);
    for (let i=0;i<4;i++) {
      const j=(i+1)%4;
      face([[corners[i][0],low,corners[i][1]],[corners[j][0],low,corners[j][1]],upper[j],upper[i]],ink);
    }
  }
  for (const part of pavilionParts) {
    const {u,v,w,d,eave}=part, hall=part===pavilionParts[0];
    pavilionFaces(part,(vertices,type,side)=>{
      if (type==='roof') {
        // Drážky vedou od hrany střechy vzhůru. Na valbách se plech otáčí o čtvrt otáčky.
        face(vertices,([x,h,z])=>pixel(766+(side%2 ? z-v : x-u)*28,188+(side%2 ? x-u : z-v)*17+h*3));
        return;
      }
      const [a,b]=vertices, dx=b[0]-a[0], dz=b[2]-a[2];
      const bays=side%2 ? (hall ? 3 : 2) : 5;
      for (let i=0;i<bays;i++) {
        const at=(t,h)=>[a[0]+t*dx,h,a[2]+t*dz];
        const start=i/bays,end=(i+1)/bays;
        const column=side%2 && hall ? 3 : hall ? (i===2 ? 1 : 0) : 2;
        face([at(start,-2),at(end,-2),at(end,0),at(start,0)],render);
        face([at(start,0),at(end,0),at(end,eave),at(start,eave)],([x,h,z])=>{
          const fraction=((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)*bays-i;
          return pixel(column*128+1+fraction*126,3+(eave-h)/eave*365);
        });
      }
    });
    for (const sign of [-1,1]) {
      const edge=v+sign*d;
      box(u,edge,w+.10,.14,eave-.28,eave-.17,plaster);
      box(u,edge,w+.16,.18,eave-.17,eave-.08,pale);
      box(u,edge,w+.21,.21,eave-.08,eave+.025,metal);
      if (hall) for (let i=-10;i<=10;i++) {
        box(u+i*.72,edge+sign*.055,.09,.15,eave-.39,eave-.255,plaster);
      }
      // Vystupující pilastry rámují pět os na obou dlouhých fasádách.
      for (let i=0;i<=5;i++) {
        const x=u-w+.12+(2*w-.24)*i/5;
        box(x,edge,.09,.065,.12,eave-.36,plaster);
        box(x,edge,.13,.085,eave-.44,eave-.32,pale);
      }
    }
    for (const sign of [-1,1]) {
      box(u+sign*w,v,.17,d+.17,eave-.12,eave+.015,metal);
    }
  }
  pavilionFaces(terrace,(p,kind,side)=>{
    if (kind==='deck') face(p,coping);
    else face(p,([u,h,v])=>pixel(750+(side%2 ? v : u)*12,414+(.18-h)*35));
  });
  box(0,9.47,19.42,.15,.09,.19,pale);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function buildPavilion(world,woodMaterial,owner) {
  const site=world.pavilion;
  const geometry=pavilionGeometry(site);
  const map=new THREE.TextureLoader().load(new URL('./pavilion.svg',import.meta.url).href);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  const material=new THREE.MeshStandardNodeMaterial({map,roughness:.86,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Lochotínský pavilonek';
  mesh.castShadow=mesh.receiveShadow=true;
  owner.group.add(mesh);
  owner.disposables.push(geometry,material,map);
  const buffer=new SolidBuf(), ranges=[], brown=[.13,.065,.034];
  for (const rail of site.rails) {
    const start=buffer.p.length;
    function timber(u,w,d,low,high) {
      const pt=(a,h,b)=>[rail.x+a*Math.cos(rail.yaw)-b*Math.sin(rail.yaw),rail.y+h,rail.z+a*Math.sin(rail.yaw)+b*Math.cos(rail.yaw)];
      const corners=[[u-w,d],[u+w,d],[u+w,-d],[u-w,-d]];
      const upper=corners.map(([a,b])=>pt(a,high,b));
      buffer.quad(...upper,brown);
      for (let i=0;i<4;i++) {
        const j=(i+1)%4;
        buffer.quad(pt(corners[i][0],low,corners[i][1]),pt(corners[j][0],low,corners[j][1]),upper[j],upper[i],brown);
      }
    }
    timber(-rail.width/2+.07,.062,.08,0,1.03);
    if (rail===site.rails.at(-1)) timber(rail.width/2-.07,.062,.08,0,1.03);
    for (const h of [.19,.45,.71,.96]) timber(0,rail.width/2,.05,h-.045,h+.045);
    ranges.push({fixture:rail,start,end:buffer.p.length});
  }
  const wood=buffer.geometry(), fence=new THREE.Mesh(wood,woodMaterial);
  fence.name='Dřevěné zábradlí terasy';
  fence.castShadow=fence.receiveShadow=true;
  owner.group.add(fence);
  owner.disposables.push(wood);
  owner.pavilionRails=attachRoadFurniture(world.breakables,owner.group,wood,woodMaterial,ranges);
}
