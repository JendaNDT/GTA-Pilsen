// Vlastní prostorové modely pro východní část sadového okruhu.
import * as THREE from 'three/webgpu';
import { streetCorners } from './street-furniture.js';
import { footbridge } from './strouha-layout.js';

function puppets(m, collider) {
  const bronze = 0x584d3c, highlights = 0x887654;
  m.add(new THREE.CylinderGeometry(1,1,.47,24).scale(1.02,1,.68).translate(0,.17,0),0xc4beb0);
  m.box(0,.21,.65,.48,.17,.03,bronze);
  // Spejblův dlouhý frak, velké uši a ukazovák obrácený k menšímu Hurvínkovi.
  for (const [x,k,side] of [[-.44,1,1],[.52,.67,-1]]) {
    const at=(u,h,v)=>[x+u*k*side,.40+h*k,v*k];
    const oval=(u,h,v,a,b,c,t=bronze)=>m.oval(...at(u,h,v),a*k,b*k,c*k,t);
    const limb=(a,b,r)=>m.rod(at(...a),at(...b),r*k,bronze);
    if (collider) {
      m.disk(x,.40+.70*k,0,.26*k,.21*k,1.40*k,bronze,8);
      continue;
    }
    for(const v of [-.12,.12]) {
      oval(.07,.08,v,.22,.09,.095,highlights);
      limb([0,.15,v],[0,.66,v],.085);
    }
    oval(-.015,.89,0,.22,.41,.24);
    if(k===1) oval(-.13,.65,0,.14,.40,.21);
    oval(.08,1.48,0,.26,.27,.23);
    oval(.29,1.43,0,.14,.105,.09,highlights);
    for(const v of [-.24,.24]) oval(.005,1.47,v,.103,.116,.052,highlights);
    for(const v of [-.11,.11]) oval(.29,1.53,v,.031,.036,.027);
    if(k<1) oval(.04,1.70,0,.21,.074,.19);
    limb([.02,1.10,.19],[.12,.85,.23],.076);
    limb([.12,.85,.23],[k===1?.32:.42,k===1?1.01:.98,.20],.06);
    oval(k===1?.34:.43,k===1?1.02:.99,.20,.074,.059,.058,highlights);
    if(k===1) limb([.35,1.04,.21],[.46,1.09,.20],.025);
    limb([0,1.10,-.19],[-.035,.71,-.24],.074);
  }
}

function havel(m, collider) {
  const wood=0xa68256, iron=0x334539;
  // Kruhová deska s volným středem pro kmen lípy.
  const ring=new THREE.Shape();
  ring.absarc(0,0,.68,0,2*Math.PI,false);
  const hole=new THREE.Path(); hole.absarc(0,0,.22,0,2*Math.PI,true); ring.holes.push(hole);
  m.add(new THREE.ExtrudeGeometry(ring,{depth:.066,bevelEnabled:false,curveSegments:14})
    .rotateX(-Math.PI/2).translate(0,.74,0),wood);
  for(const sign of [-1,1]) {
    const x=sign*1.03;
    m.box(x,.45,0,.52,.09,.57,wood);
    m.box(x+sign*.25,.81,0,.075,.68,.56,wood);
    for(const v of [-.2,.2]) {
      m.box(x+sign*.18,.22,v,.07,.44,.07,iron);
      m.box(x-sign*.18,.22,v,.07,.44,.07,iron);
      m.box(sign*.38,.37,v,.07,.74,.07,iron);
    }
    if(!collider) m.oval(x+sign*.25,1.16,0,.066,.095,.095,sign>0?0xa93632:0x447853);
  }
  m.disk(0,1.65,0,.116,.083,3.3,0x5a513d,9);
  if (!collider) {
    for(const [u,h,v] of [[-.57,3.12,.04],[.52,3.25,-.15],[-.05,3.65,.20]]) {
      m.rod([0,2.0,0],[u,h,v],.047,0x5a513d);
      m.oval(u,h+.3,v,.84,1.03,.8,0x799553);
    }
  }
}

function bust(m, collider) {
  m.box(0,.08,0,1.45,.19,1.24,0xa7a295);
  m.box(0,.93,0,.79,1.55,.71,0xb1a794);
  m.box(0,1.74,0,.9,.12,.8,0x8a8174);
  m.oval(0,1.98,0,.41,.29,.23,0x554f42);
  m.oval(0,2.34,0,.19,.25,.175,0x62594b);
  if (!collider) {
    m.oval(0,2.34,.165,.048,.071,.070,0x756554);
    m.oval(0,2.19,.105,.112,.11,.10,0x504c40);
    m.box(0,1.24,.36,.48,.29,.027,0x615b4d);
  }
}

// Průchozí otvory v malované skořepině zůstávají i v kolizní síti.
function mask(m, site, detail, collider) {
  const bird=site.id==='ptak', fish=site.id==='ryba';
  const width=bird?1.8:fish?1.48:1.65, height=bird?2.48:fish?2.40:2.16;
  const depth=fish?1.75:1.48, count=collider?24:detail?48:32;
  const palette=bird?[0xf0d255,0xf9f2dc,0x2d77b4]:fish?[0x6bafd5,0xe8f0de,0x564594]:[0xeebb28,0xf8efd9,0x29563c];
  // Přední maska má dvě oči a ústa. Zadní část je otevřená pro vstup dovnitř.
  const face=new THREE.Shape();
  face.moveTo(-width,0); face.bezierCurveTo(-width*1.08,height*.62,-width*.86,height,0,height);
  face.bezierCurveTo(width*.91,height,width*1.07,height*.67,width,0); face.closePath();
  const eyeY=height*.62;
  for(const sign of [-1,1]) {
    const eye=new THREE.Path();
    eye.absellipse(sign*width*.44,eyeY,width*.265,height*.156,0,Math.PI*2,true,0);
    face.holes.push(eye);
  }
  const mouth=new THREE.Path();
  mouth.absellipse(0,height*.24,width*.38,height*.073,0,Math.PI*2,true,0);
  face.holes.push(mouth);
  m.add(new THREE.ExtrudeGeometry(face,{depth:.18,curveSegments:collider?5:9,bevelEnabled:false})
    .translate(0,-.055,depth*.46),palette[1]);
  const outer=new THREE.Shape();
  outer.moveTo(-width,0);outer.bezierCurveTo(-width*1.09,height*.66,-width*.83,height,0,height);
  outer.bezierCurveTo(width*.84,height,width*1.08,height*.66,width,0);
  outer.lineTo(width-.17,0);outer.bezierCurveTo(width*.96,height*.62,width*.77,height-.17,0,height-.17);
  outer.bezierCurveTo(-width*.73,height-.17,-width*.94,height*.62,-width+.17,0);outer.closePath();
  m.add(new THREE.ExtrudeGeometry(outer,{depth,curveSegments:collider?5:9,bevelEnabled:false})
    .translate(0,-.055,-depth*.54),palette[2]);
  if(collider) return;
  for(const side of [-1,1]) {
    const brow=new THREE.TorusGeometry(1,.12,5,count,Math.PI*1.04)
      .scale(width*.29,height*.185,.10).translate(side*width*.44,eyeY,depth*.46+.20);
    m.add(brow,palette[0]);
    for(let j=0;j<6;j++) {
      const a=(j+.5)*Math.PI/6;
      m.oval(side*width*.44+width*.32*Math.cos(a),eyeY+height*.21*Math.sin(a),depth*.46+.19,
        .032,.045,.021,palette[2]);
    }
  }
  m.oval(0,height*.48,depth*.46+.16,width*.19,height*.12,.235,palette[1]);
  for(const sign of [-1,1]) m.oval(sign*.10,height*.455,depth*.46+.37,.039,.057,.016,palette[2]);
  const lips=new THREE.TorusGeometry(1,.12,5,count).scale(width*.39,height*.094,.095)
    .translate(0,height*.24,depth*.46+.20);
  m.add(lips,fish?0x76589d:0xb64f41);
  for(const sign of [-1,1]) {
    const cheek=new THREE.Shape();
    cheek.moveTo(sign*width*.88,height*.53);
    cheek.quadraticCurveTo(sign*width*.79,height*.30,sign*width*.47,height*.37);
    cheek.quadraticCurveTo(sign*width*.62,height*.14,sign*width*.87,height*.17);
    cheek.closePath();
    m.add(new THREE.ShapeGeometry(cheek).translate(0,0,depth*.46+.187),palette[0]);
    for(let i=0;i<4;i++) {
      m.oval(sign*width*(.64+.058*i),height*(.30+.035*Math.sin(i*1.5)),
        depth*.46+.193,.030,.045,.018,palette[2]);
    }
  }
  for(let j=0;j<9;j++) {
    const a=(j+.5)*Math.PI/9;
    m.oval(width*.96*Math.cos(a),height*.93*Math.sin(a),-depth*.32,.075,.09,.09,palette[0]);
  }
}

function bridgeDeck(m, collider) {
  const {length,width}=footbridge, thickness=.17;
  // Na obou koncích mostovka plynule klesne k původní pěšině.
  const profile=[[-length/2-1.7,-.14],[-length/2,.36],[length/2,.36],[length/2+1.7,-.15]];
  for(let i=1;i<profile.length;i++) {
    const [a,y0]=profile[i-1], [b,y1]=profile[i], slope=Math.atan2(y1-y0,b-a);
    const geo=new THREE.BoxGeometry(Math.hypot(b-a,y1-y0),thickness,width)
      .rotateZ(slope).translate((a+b)/2,(y0+y1-thickness)/2,0);
    m.add(geo,0x776651);
  }
  if(collider) return;
  for(let i=0;i<Math.ceil(length/.20);i++) {
    const step=length/Math.ceil(length/.20);
    m.box(-length/2+(i+.5)*step,.361,0,step-.013,.014,width, i%4===0?0xab8b66:0x977958);
  }
  for(const sign of [-1,1]) m.box(0,.10,sign*(width/2-.16),length,.25,.17,0x50493f);
}

export function bridgeRails(ground,world) {
  const rails=[], {x,z,angle,width,length}=footbridge;
  const dx=Math.cos(angle), dz=Math.sin(angle);
  for(const side of [-1,1]) for(let j=0;j<6;j++) {
    const u=((j+.5)/6-.5)*length, v=side*(width/2-.055);
    const px=x+u*dx-v*dz, pz=z+u*dz+v*dx, w=length/6, y=ground+.368;
    rails.push({kind:'strouhaRail',id:'street/strouha/lavka/'+side+'/'+j,x:px,y,z:pz,yaw:angle,
      width:w,depth:.095,height:1.04,impulse:5000,tile:world.chunkIndex(px,pz),
      corners:streetCorners(px,y,pz,angle,w,.095)});
  }
  return rails;
}

function terrace(m, collider) {
  const stages=[[-.88,.37,19.3], [.04,.24,18.9], [.96,.12,18.5]];
  for(const [v,top,length] of stages) {
    m.box(0,top-.23,v,length,.46,.93,0x846e59);
    if(!collider) for(let i=0;i<5;i++) {
      m.box(0,top+.011,v+(i-2)*.182,length,.026,.174,i%3===0?0xab9174:0x987d60);
    }
  }
}

function pragueArch(m, collider) {
  const shape=new THREE.Shape(),r=4.4,base=-1.12,top=2.0,span=10.9;
  shape.moveTo(-span,base);shape.lineTo(-r,base);
  shape.absellipse(0,base,r,2.48,Math.PI,0,true,0);
  shape.lineTo(span,base);shape.lineTo(span,top);shape.lineTo(-span,top);shape.closePath();
  m.add(new THREE.ExtrudeGeometry(shape,{depth:1.35,bevelEnabled:false,curveSegments:12})
    .translate(0,0,-.675),0xa7977c);
  m.box(0,top+.10,0,span*2+.18,.20,1.55,0xc1af8d);
  if(collider) return;
  for(let i=0;i<19;i++) {
    const a=Math.PI*i/19+.006,b=Math.PI*(i+1)/19-.006;
    const stone=new THREE.Shape();
    stone.moveTo(r*Math.cos(a),base+2.48*Math.sin(a));
    stone.lineTo((r+.37)*Math.cos(a),base+2.91*Math.sin(a));
    stone.lineTo((r+.37)*Math.cos(b),base+2.91*Math.sin(b));
    stone.lineTo(r*Math.cos(b),base+2.48*Math.sin(b));stone.closePath();
    m.add(new THREE.ExtrudeGeometry(stone,{depth:1.45,bevelEnabled:false}).translate(0,0,-.725),
      i%3===0?0xc4b498:0xb4a28a);
  }
}

function retainingWall(m,site,detail,collider) {
  for(let i=1;i<site.wall.length;i++) {
    const [ax,az]=site.wall[i-1], [bx,bz]=site.wall[i];
    const h0=site.levels?.[i-1]??0,h1=site.levels?.[i]??0;
    const length=Math.hypot(bx-ax,bz-az), yaw=-Math.atan2(bz-az,bx-ax);
    const blocks=Math.ceil(length/(detail && !collider ? 1.38 : 3.8));
    for(let k=0;k<blocks;k++) {
      const t=(k+.5)/blocks, h=h0+(h1-h0)*t, x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      const w=length/blocks, palette=[0xab997c,0xae9c82,0xb2a088,0xa18c74];
      // Šikmá pata sahá do terénu i na příčně svažitém břehu.
      const y=site.height;
      m.box(x,h+y*.5-.45,z,w+.018,y+.90,.64,palette[(k+i)%4],yaw);
      m.box(x,h+y+.04,z,w+.026,.13,.78,0xc1b398,yaw);
      if(detail && !collider) for(const j of [1,2,3]) {
        m.box(x,h+y*j/4,z,w,.024,.651,0x8b7a68,yaw);
      }
    }
  }
}

export function easternFeature(m,site,detail,collider) {
  if(site.wall) return retainingWall(m,site,detail,collider);
  switch(site.id) {
    case 'loutky': return puppets(m,collider);
    case 'havel': return havel(m,collider);
    case 'krizik': return bust(m,collider);
    case 'arch': return pragueArch(m,collider);
    case 'terasa': return terrace(m,collider);
    case 'lavka': return bridgeDeck(m,collider);
    default: return mask(m,site,detail,collider);
  }
}

// Zaoblený čelní povrch plynule přechází do kratší, vzadu otevřené skořepiny.
export function roundMask(geometry) {
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const front=Math.max(0,Math.min(1,(z+.65)/1.25));
    const crown=Math.max(0,1-(x/1.83)**2-((y-1.12)/1.6)**2);
    pos.setXYZ(i,x*(.93+.07*front),y*(.92+.08*front),z+.49*front*crown);
  }
  geometry.computeVertexNormals();
  return geometry;
}
