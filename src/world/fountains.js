import * as THREE from 'three/webgpu';
import { attribute, color, floor, mix, positionLocal, sin, smoothstep, vec2, vertexColor } from 'three/tsl';
import { hash21, valueNoise } from './material-noise.js';
import { fountainBowl, fountainPoint, fountainSculpture, streamPoint, waterHeight } from './fountain-shapes.js';

const finishes=['gold','bronze','stone','pool','stream','foam'];
const palette=[0xe6ae3c,0x6d491e,0x272824,0x495953,0xadc8cc,0xf2f4ed].map(c=>new THREE.Color(c));

function waterJet(site,m,detail,face) {
  const rings=detail ? 12 : 3, sides=detail ? 10 : 4;
  const sign=Math.sign(m.target-m.u);
  function ring(i) {
    const t=i/rings, center=streamPoint(site,m,t);
    const du=m.target-m.u, dy=2*(waterHeight-m.low-.105)*t, norm=Math.hypot(du,dy);
    const row=[];
    for (let j=0;j<=sides;j++) {
      const a=j*2*Math.PI/sides, ridge=1+.11*Math.sin(3*a+t*5);
      const duNormal=-dy/norm*Math.cos(a)*(.047+.058*t)*ridge;
      const v=Math.sin(a)*site.depth*(.315-.094*t)*ridge;
      row.push([center[0]+site.cos*duNormal-site.sin*v,
        center[1]+du/norm*Math.cos(a)*(.047+.058*t)*ridge, center[2]+site.sin*duNormal+site.cos*v]);
    }
    return row;
  }
  let prev=ring(0);
  for (let i=1;i<=rings;i++) {
    const next=ring(i);
    for (let j=0;j<sides;j++) {
      const p=[prev[j],next[j],next[j+1],prev[j+1]];
      const uv=[[j/sides,(i-1)/rings],[j/sides,i/rings],[(j+1)/sides,i/rings],[(j+1)/sides,(i-1)/rings]];
      face(p,'stream',uv);
    }
    prev=next;
  }
  // Světlé hřebínky v místě dopadu. Vnitřkem korunky je vidět zvlněná hladina.
  const n=detail ? 24 : 5;
  for (let j=0;j<n;j++) {
    const tip=(k,r,h)=>fountainPoint(site,m.target+sign*r*Math.cos(2*Math.PI*k/n),waterHeight+h,r*Math.sin(2*Math.PI*k/n));
    const high=k=>.035+.10*Math.sin(k*3.17+.8)**2;
    face([tip(j,.16,.013),tip(j+1,.16,.013),tip(j+1,.28,high(j+1)),tip(j,.28,high(j))],'foam');
  }
}

export function fountainGeometry(site,detail,flow) {
  const positions=[], colors=[], types=[], waterUV=[];
  const add=(p,finish,uv)=>{
    const type=finishes.indexOf(finish), rgb=palette[type];
    const target=finish==='pool' ? site.mouths.reduce((best,m)=>{
      const d=p[0][0]-site.x, e=p[0][2]-site.z, u=d*site.cos+e*site.sin;
      return Math.abs(m.target-u)<Math.abs(best.target-u) ? m : best;
    }) : null;
    for (let j=1;j<p.length-1;j++) for (const i of [0,j,j+1]) {
      const [x,y,z]=p[i];
      positions.push(x-site.x,y-site.ground,z-site.z);
      colors.push(rgb.r,rgb.g,rgb.b);
      types.push(type);
      if (target) waterUV.push(x-site.x-site.cos*target.target,z-site.z-site.sin*target.target);
      else waterUV.push(...(uv?.[i] ?? [0,0]));
    }
  };
  fountainSculpture(site,detail,add);
  for (const bowl of site.bowls) fountainBowl(site,bowl,detail ? 36 : 9,add,!detail);
  if (flow) for (const mouth of site.mouths) waterJet(site,mouth,detail,add);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('finish',new THREE.Float32BufferAttribute(types,1));
  geo.setAttribute('waterUV',new THREE.Float32BufferAttribute(waterUV,2));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}

function fountainMaterial(detailed,flow,clock) {
  const kind=attribute('finish','float'), uv=attribute('waterUV','vec2');
  const gold=kind.lessThan(.5), wet=kind.greaterThan(2.5);
  const mat=new THREE.MeshStandardNodeMaterial({side:THREE.DoubleSide});
  mat.metalnessNode=mix(.08,.56,gold);
  mat.roughnessNode=mix(mix(.34,.52,gold),.21,wet);
  let tint=vertexColor().rgb;
  if (detailed) {
    const plane=vec2(positionLocal.x.add(positionLocal.z.mul(.67)),positionLocal.y);
    const leaf=hash21(floor(plane.mul(12.5))).mul(.18).add(.90);
    const patina=valueNoise(plane.mul(2.4)).mul(.19).add(.88);
    tint=mix(tint,tint.mul(leaf).mul(patina),gold);
  }
  if (flow) {
    const ripple=sin(uv.length().mul(32).sub(clock.mul(8))).mul(.5).add(.5);
    const ring=smoothstep(.55,.99,ripple).mul(uv.length().mul(-.55).add(1).clamp()).mul(.65);
    tint=mix(tint,mix(tint,color(0xf1f0db),ring),kind.equal(3));
    const streak=detailed ? valueNoise(vec2(uv.x.mul(24),uv.y.mul(13).sub(clock.mul(5))))
      : sin(uv.y.mul(28).sub(clock.mul(6)).add(uv.x.mul(13))).mul(.5).add(.5);
    tint=mix(tint,mix(color(0x719298),color(0xf7faf3),smoothstep(.23,.77,streak)),kind.equal(4));
  }
  mat.colorNode=tint;
  return mat;
}

// V dálce má celá kašna na displeji jen pár desítek pixelů. Náhledy se kreslí
// ze stejné geometrie jako blízký model, pro osm směrů a také pro pohled z výšky.
function distantFountain(site,geometry,owner) {
  const cell=64, views=8, span=site.id==='velbloud' ? 13 : 10;
  const canvas=document.createElement('canvas');
  canvas.width=cell*views; canvas.height=cell*3;
  const ctx=canvas.getContext('2d');
  const {position,finish}=geometry.attributes;
  const center=geometry.boundingSphere.center;
  for (let row=0;row<3;row++) {
    const pitch=[.08,.56,1.30][row], cp=Math.cos(pitch), sp=Math.sin(pitch);
    for (let col=0;col<views;col++) {
      const a=col*Math.PI*2/views, c=Math.cos(a), s=Math.sin(a);
      const faces=[];
      for (let i=0;i<position.count;i+=3) {
        let depth=0;
        const points=[];
        for (let j=i;j<i+3;j++) {
          const x=position.getX(j)-center.x,y=position.getY(j)-center.y,z=position.getZ(j)-center.z;
          const along=x*s+z*c;
          depth+=along*cp+y*sp;
          points.push([(col+.5+(x*c-z*s)/span)*cell,(row+.5-(y*cp-along*sp)/span)*cell]);
        }
        faces.push({points,depth,type:finish.getX(i)});
      }
      for (const {points,type} of faces.sort((a,b)=>a.depth-b.depth)) {
        ctx.fillStyle=palette[type].getStyle();
        ctx.beginPath(); ctx.moveTo(...points[0]); ctx.lineTo(...points[1]); ctx.lineTo(...points[2]); ctx.closePath();
        ctx.fill(); ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=.48; ctx.stroke();
      }
    }
  }
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.repeat.set(1/views,1/3);
  const mat=new THREE.SpriteMaterial({map,alphaTest:.27,transparent:false});
  const sprite=new THREE.Sprite(mat), eye=new THREE.Vector3();
  sprite.position.copy(center); sprite.scale.setScalar(span);
  sprite.onBeforeRender=(_renderer,_scene,camera)=>{
    sprite.getWorldPosition(eye).sub(camera.position).negate();
    const col=(Math.round(Math.atan2(eye.x,eye.z)*views/(2*Math.PI))+views)%views;
    const pitch=Math.atan2(eye.y,Math.hypot(eye.x,eye.z));
    map.offset.set(col/views,(pitch<.32 ? 2 : pitch<.93 ? 1 : 0)/3);
    map.updateMatrix();
  };
  owner.disposables.push(mat,map);
  return sprite;
}

export function buildFountains(sites,owner,detailed,flow,clock) {
  const material=fountainMaterial(detailed,flow,clock);
  owner.disposables.push(material);
  for (const site of sites) {
    const lod=new THREE.LOD();
    lod.name='Kašna '+site.name;
    lod.position.set(site.x,site.ground,site.z);
    for (const close of [true,false]) {
      const geo=fountainGeometry(site,close,flow);
      const mesh=new THREE.Mesh(geo,material);
      mesh.castShadow=close; mesh.receiveShadow=true;
      lod.addLevel(mesh,close ? 0 : (detailed ? 62 : 27),.08);
      owner.disposables.push(geo);
      if (!close && !detailed) lod.addLevel(distantFountain(site,geo,owner),100,.08);
    }
    owner.group.add(lod);
  }
}
