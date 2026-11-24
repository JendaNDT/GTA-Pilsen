// Tři kašny navazující promenády mají společný profil kamenné obruby.
import * as THREE from 'three/webgpu';

function column(m,x,z,bottom,h,r,group=2) {
  m.add(new THREE.CylinderGeometry(r*.73,r,h,7).translate(x,bottom+h/2,z),0xb9d5da,group);
  m.add(new THREE.SphereGeometry(r*.76,7,4).translate(x,bottom+h,z),0xdde8e6,group);
}

function arc(m,a,b,height,r,detail,group) {
  const mid=new THREE.Vector3((a[0]+b[0])/2,height,(a[2]+b[2])/2);
  const path=new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a),mid,new THREE.Vector3(...b));
  m.add(new THREE.TubeGeometry(path,detail?10:5,r,detail?5:3,false),0xb5d6db,group);
}

function motherAndChild(m,collider) {
  const bronze=0x484f4d;
  m.disk(0,.54,0,.59,.52,.87,0xa3a095);
  m.disk(0,1.03,0,.52,.52,.13,bronze);
  if(collider) {
    m.disk(0,2,0,.40,.29,1.81,bronze,8);return;
  }
  const limb=(a,b,r)=>m.rod(a,b,r,bronze);
  for(const z of [-.14,.14]){
    m.oval(.19,1.15,z,.17,.062,.09,bronze);
    limb([.29,1.19,z],[.28,1.63,z],.080);limb([.28,1.63,z],[.30,2.0,z],.105);
    limb([.03,2.52,z],[.015,2.24,z*1.4],.079);limb([.015,2.24,z*1.4],[-.20,2.04,z*1.3],.060);
    limb([-.32,1.18,z*1.7],[-.24,1.45,z*1.05],.049);
    limb([-.24,1.45,z*1.05],[-.32,1.57,z],.065);
    limb([-.39,1.84,z*.6],[-.28,1.94,z*1.27],.047);
    limb([-.28,1.94,z*1.27],[-.20,2.04,z*1.3],.043);
  }
  m.oval(.26,2.06,0,.20,.26,.23,bronze);
  m.oval(.13,2.34,0,.22,.39,.22,bronze,.40);
  m.oval(-.08,2.73,0,.149,.184,.147,bronze,.30);
  m.oval(-.34,1.65,0,.106,.24,.116,bronze,.36);
  m.oval(-.47,1.91,0,.131,.134,.128,bronze,-.3);
}

export function gardenFountain(m,spec,detail,flow,collider) {
  const {rx,rz,id}=spec, n=collider?20:detail?64:32, museum=id==='muzeum', matka=id==='matka';
  const lip=museum?.54:.31, top=matka?.20:.37;
  const profile=[[rx,-.85],[rx,.09],[rx-.10,top-.08],[rx-.16,top],[rx-lip,top],[rx-lip-.05,.12]];
  const ring=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),n);
  m.add(ring.scale(1,1,rz/rx),museum?0xbab7a8:matka?0x9b978d:0xaaa19b);
  m.add(new THREE.CylinderGeometry(rx-lip,rx-lip,.16,n).scale(1,1,rz/rx).translate(0,.035,0),0x8d8c80);
  m.add(new THREE.CylinderGeometry(rx-lip,rx-lip,.035,n).scale(1,1,rz/rx).translate(0,.145,0),0x507f76,1);
  if(matka) motherAndChild(m,collider);
  if(id==='corso'){
    for(const x of [-5.2,5.2]){
      m.box(x,.49,-.5,.26,1.04,.29,0x646764);
      if(!collider) m.box(x,.81,-.34,.20,.28,.015,0x393d3b);
    }
  }
  if(!flow || collider) return;
  if(museum) {
    // Čtyři sektory tvoří různě vysoké vějíře směrem ke středu oválu.
    const count=detail?96:40;
    for(let j=0;j<count;j++) {
      const a=j*2*Math.PI/count, x=(rx-.85)*Math.cos(a),z=(rz-.62)*Math.sin(a);
      const h=1.35+.70*Math.cos(2*a-.8);
      arc(m,[x,.17,z],[x*.37,.17,z*.37],h*2,detail?.029:.038,detail,3+Math.floor(j*4/count));
    }
  } else if(matka) {
    for(let j=0;j<12;j++) {
      const a=j*Math.PI/6;
      column(m,1.2*Math.cos(a),1.2*Math.sin(a),.15,.78+.35*Math.cos(a),.055);
    }
  } else {
    for(const [count,r,height] of [[6,1.70,1.12],[3,.78,1.72],[1,0,2.45]])
      for(let j=0;j<count;j++) column(m,r*Math.cos(j*2*Math.PI/count),r*Math.sin(j*2*Math.PI/count),.14,height,.068,count===6?3:count===3?4:5);
  }
}

export function civicStatue(m,id,collider) {
  const mayor=id==='kopecky', foot=mayor?2.18:1.58, tint=mayor?0x978f7f:0x484f49;
  m.box(0,.055,0,mayor?2.55:3.05,.19,mayor?2.45:2.55,0xb1a79b);
  m.box(0,foot/2+.08,0,1.12,foot-.10,1.05,mayor?0xb7aa96:0x838680);
  if(mayor) {
    m.box(0,foot-.21,0,1.34,.33,1.21,0xb5aa94);
    m.box(0,foot+.015,0,1.45,.12,1.30,0x8d8273);
    m.box(0,foot*.54,.533,.75,.47,.027,0x56584f);
  }
  if(collider) {m.disk(0,foot+1.0,0,.39,.24,2.03,tint,8);return;}
  const limb=(a,b,r)=>m.rod(a,b,r,tint);
  for(const side of [-1,1]) {
    const x=side*.16;
    m.oval(x,foot+.10,.047,.12,.085,.20,tint);
    limb([x,foot+.16,0],[x,foot+.67,.006],.104);
    limb([x,foot+.67,.006],[x*.85,foot+1,0],.13);
  }
  m.oval(0,foot+1.25,0,.29,.45,.20,tint);
  m.oval(0,foot+1.82,0,.16,.205,.145,tint);
  m.oval(0,foot+1.94,-.035,.16,.11,.14,tint);
  if(mayor) {
    m.box(-.44,foot+.69,0,.25,1.30,.27,tint);
    limb([-.24,foot+1.55,0],[-.43,foot+1.26,.06],.095);
    limb([.24,foot+1.55,0],[.43,foot+1.28,.01],.092);
    limb([.43,foot+1.28,.01],[.22,foot+1.16,.11],.081);
  } else {
    m.add(new THREE.CylinderGeometry(.29,.39,1.02,12).scale(1,1,.68).translate(.05,foot+1,-.035),tint);
    limb([-.22,foot+1.57,0],[-.30,foot+1.22,.13],.103);
    limb([-.30,foot+1.22,.13],[-.16,foot+1.46,.26],.082);
    limb([.21,foot+1.56,0],[.28,foot+1.20,.11],.104);
    limb([.28,foot+1.20,.11],[.06,foot+1.22,.21],.083);
  }
}

export function leafArches(m,detail) {
  const n=7,span=3.2,metal=0x405342,segments=detail ? 10 : 6;
  for(let j=0;j<n;j++) {
    const x=(j-(n-1)/2)*span;
    m.rod([x-span/2,0,0],[x-span/2,1.55,0],.052,metal);
    for(let k=0;k<segments;k++){
      const at=t=>[x+span/2*Math.cos(t),1.54+1.32*Math.sin(t),0];
      const a=k*Math.PI/segments,b=(k+1)*Math.PI/segments;
      m.rod(at(a),at(b),.052,metal);
      if(detail || k%2===0) {
        const [u,y]=at((a+b)/2);
        m.oval(u,y+.10,.02,.32,.22,.27,k%3===0?0x577448:0x426440);
      }
    }
    m.oval(x-span/2,.85,0,.25,.85,.23,0x58764b);
  }
  m.rod([n*span/2,0,0],[n*span/2,1.55,0],.052,metal);
}
