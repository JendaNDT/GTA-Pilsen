import * as THREE from 'three/webgpu';
import { positionLocal, vec2, vertexColor } from 'three/tsl';
import { valueNoise } from './material-noise.js';
import { SolidBuf } from './solid-buffer.js';
import { attachRoadFurniture } from './road-furniture.js';
import { columnCenter, columnPoint, columnSteps } from './plague-column-site.js';

const rgb = hex => new THREE.Color(hex).toArray();
const stone=rgb(0x82755f), pale=rgb(0xa5987e), edge=rgb(0x968971), recess=rgb(0x645c4b);
const robe=rgb(0x928570), folds=rgb(0x827663), iron=rgb(0x363837), gilt=rgb(0xefba41);
const leafGold=rgb(0xd99a27), plaque=rgb(0x3b3b37);

// Prstence nejsou pravidelné jen u drapérie. Posun osy a střídání poloměru vyznačí záhyby pláště.
function loft(buf, place, rows, color, sides, drape=false) {
  let previous;
  for (const [y,rx,rz,x=0,z=0] of rows) {
    const ring=Array.from({length:sides},(_,i)=>{
      const a=i*2*Math.PI/sides;
      const wave=drape ? 1+.13*Math.cos(5*a+.9*y)+.06*Math.sin(3*a-y) : 1;
      return place(x+rx*wave*Math.cos(a),y,z+rz*wave*Math.sin(a));
    });
    if (previous) for (let i=0;i<sides;i++) {
      const j=(i+1)%sides;
      buf.quad(previous[i],ring[i],ring[j],previous[j],color, drape ? .94+.055*Math.sin(3*i+y) : 1);
    }
    previous=ring;
  }
}
function orb(buf,place,x,y,z,rx,ry,rz,color,n=9) {
  loft(buf,place,[[-1,.02],[-.72,.69],[-.25,.97],[.34,.94],[.78,.62],[1,.02]]
    .map(([dy,r])=>[y+ry*dy,rx*r,rz*r,x,z]),color,n);
}
function prism(buf,place,x,z,halfX,halfZ,bottom,top,color) {
  const corners=[[-1,-1],[-1,1],[1,1],[1,-1]];
  const ring=(h)=>corners.map(([a,b])=>place(x+a*halfX,h,z+b*halfZ));
  const lower=ring(bottom), upper=ring(top);
  buf.quad(...upper,color,1.06);
  for (let i=0;i<4;i++) {
    const j=(i+1)%4;
    buf.quad(lower[i],lower[j],upper[j],upper[i],color);
  }
}
function rod(buf,place,a,b,r1,r2,color,n=6) {
  const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b);
  const dir=end.clone().sub(start).normalize();
  const right=new THREE.Vector3(0,1,0);
  if (Math.abs(dir.y)>.92) right.set(1,0,0);
  right.cross(dir).normalize();
  const up=dir.clone().cross(right);
  const ring=(p,r)=>Array.from({length:n},(_,i)=>{
    const theta=i*2*Math.PI/n;
    return place(...p.clone().addScaledVector(right,r*Math.cos(theta)).addScaledVector(up,r*Math.sin(theta)).toArray());
  });
  const lower=ring(start,r1), upper=ring(end,r2);
  for (let i=0;i<n;i++) { const j=(i+1)%n; buf.quad(lower[i],lower[j],upper[j],upper[i],color); }
}

function faceAt(place,u,v,h,angle,scale=1) {
  const cos=Math.cos(angle), sin=Math.sin(angle);
  return (x,y,z)=>place(u+scale*(x*cos-z*sin),h+scale*y,v+scale*(x*sin+z*cos));
}

function figure(buf,place,pose,madonna=false) {
  const cloth=madonna ? gilt : robe, hem=madonna ? leafGold : folds, skin=madonna ? gilt : pale;
  const lean=.065*Math.sin(pose+1);
  const mantle=[[0,.31,.205,-.03],[.12,.34,.22,-.025],[.44,.26,.20,lean,.02],
    [.81,.22,.16,.04],[1.02,.17,.15,.03],[1.24,.245,.155,0],[1.34,.14,.12,lean]];
  loft(buf,place,mantle,cloth,16,true);
  // Plášť vedený přes rameno má nerovný lem a odhaluje nakročenou nohu.
  for (let i=0;i<4;i++) {
    const x=-.22+i*.115;
    rod(buf,place,[x,.15+.055*i,.176],[x*.49+.04,.79+.08*i,.156],.032,.018,hem);
  }
  orb(buf,place,.09,.055,.16,.12,.06,.15,hem);
  orb(buf,place,lean,1.46,.017,.127,.164,.123,skin);
  orb(buf,place,lean-.014,1.51,-.032,.136,.134,.125,hem);
  orb(buf,place,lean,1.46,.133,.035,.045,.048,skin,6);
  const handX=(pose%2 ? -.21 : -.33), handY=madonna ? 1.12 : 1.05+.13*(pose%4);
  for (const side of [-1,1]) {
    const hand=side===-1 ? [handX,handY,.20] : [madonna ? .26 : .065, madonna ? 1.17 : .94,.235];
    const elbow=[side*.30,1.0+.045*Math.sin(pose),.08];
    rod(buf,place,[side*.19,1.235,0],elbow,.123,.096,cloth);
    rod(buf,place,elbow,hand,.096,.059,cloth);
    orb(buf,place,...hand,.062,.072,.058,skin,7);
  }
  if (madonna) {
    const child=faceAt(place,.22,.18,1.06,-.24);
    loft(buf,child,[[0,.085,.08],[.17,.12,.11],[.39,.118,.09],[.46,.065,.06]],gilt,10,true);
    orb(buf,child,.01,.54,0,.096,.106,.092,gilt);
    rod(buf,child,[.10,.36,0],[.22,.42,.05],.04,.032,gilt);
    loft(buf,place,[[1.54,.115,.115,lean],[1.64,.146,.146,lean],[1.67,.12,.12,lean]],leafGold,12);
    for (let i=0;i<12;i++) {
      const a=i*Math.PI/6, b=(i+1)*Math.PI/6;
      const rim=t=>[lean+.212*Math.cos(t),1.58+.23*Math.sin(t),-.09];
      rod(buf,place,rim(a),rim(b),.012,.012,gilt,4);
      orb(buf,place,...rim(a),.026,.03,.02,gilt,5);
    }
  } else if (pose%3===0) {
    rod(buf,place,[-.33,.03,.19],[-.33,1.81,.19],.020,.012,leafGold);
    rod(buf,place,[-.42,1.67,.19],[-.24,1.67,.19],.015,.015,leafGold);
  } else if (pose%3===1) {
    prism(buf,place,-.23,.22,.092,.065,1.14,1.37,edge);
  } else {
    rod(buf,place,[-.32,.06,.17],[-.21,1.58,.20],.025,.018,hem);
  }
}

// Tři letopočty na východní desce jsou čitelné i při přiblížení kamery.
function plaqueYears(buf,place) {
  const strokes={
    0:[[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,1],[3,0],[1,0]],
    1:[[0,4.7],[2,6],[2,0],[.5,0],[3.5,0]],
    3:[[0,5.2],[1,6],[3,6],[4,5],[3.4,3.7],[1.3,3.1],[3.4,3],[4,2],[3.7,.7],[2.5,0],[1,0],[0,.8]],
    6:[[3.6,6],[2.2,5.8],[.5,4.4],[0,2.7],[0,1],[1,0],[3,0],[4,1],[4,2.4],[3,3.3],[1.5,3.3],[0,2.3]],
    8:[[1,3],[0,4],[0,5],[1,6],[3,6],[4,5],[4,4],[3,3],[1,3],[0,2],[0,1],[1,0],[3,0],[4,1],[4,2],[3,3]],
    9:[[.5,0],[2,.5],[3.4,2],[4,3.8],[4,5],[3,6],[1,6],[0,5],[0,3.7],[1,2.9],[2.6,2.9],[4,3.9]],
  };
  for (const [year,base,size] of [['1681',1.055,.026],['1890',.86,.019],['1931',.68,.019]]) {
    for (let i=0;i<year.length;i++) {
      const line=strokes[year[i]], left=(i*5.5-10.25)*size;
      for (let j=1;j<line.length;j++) {
        const [ax,ay]=line[j-1], [bx,by]=line[j];
        const length=Math.hypot(bx-ax,by-ay), dx=(by-ay)/length*.29, dy=(ax-bx)/length*.29;
        const at=(x,y)=>place(left+x*size,base+y*size,.021);
        buf.quad(at(ax+dx,ay+dy),at(bx+dx,by+dy),at(bx-dx,by-dy),at(ax-dx,ay-dy),gilt);
      }
    }
  }
}

function drawFence(buf,f,detailed) {
  const cos=Math.cos(f.yaw), sin=Math.sin(f.yaw);
  const place=(a,h,b)=>[f.x+a*cos-b*sin,f.y+h,f.z+a*sin+b*cos];
  const half=f.width/2;
  if (f.kind==='columnFence' || f.kind==='columnGate') {
    for (const h of [.24,.70]) prism(buf,place,0,0,half,.017,h,h+.026,iron);
    const count=detailed ? 8 : 4;
    for (let i=0;i<count;i++) {
      const x=((i+.5)/count-.5)*f.width;
      rod(buf,place,[x,0,0],[x,.86,0],.016,.018,iron,4);
      rod(buf,place,[x,.84,0],[x,.93,0],.036,.002,leafGold,4);
      if (detailed) rod(buf,place,[x,.26,0],[x+f.width/count,.67,0],.012,.012,iron,4);
    }
  } else {
    prism(buf,place,0,0,half,.20,0,.19,stone);
    prism(buf,place,0,0,half,.22,.91,1.045,edge);
    prism(buf,place,0,0,half,.24,1.045,1.12,pale);
    const count=detailed ? 5 : 3;
    for (let i=0;i<count;i++) {
      const x=((i+.5)/count-.5)*f.width;
      loft(buf,faceAt(place,x,0,0,0),[[.18,.113,.11],[.27,.083,.083],[.43,.082,.082],
        [.59,.145,.14],[.69,.13,.13],[.82,.071,.071],[.92,.115,.115]],edge,detailed?8:5);
    }
    prism(buf,place,-half+.14,0,.16,.215,.16,1.13,stone);
    orb(buf,place,-half+.14,1.28,0,.154,.157,.154,pale);
    if (detailed) {
      const center=-half+.14;
      for (const sign of [-1,1]) {
        const petal=(x,h,z)=>place(center+sign*x,h,z+.22);
        loft(buf,petal,[[.25,.015,.012,0],[.44,.043,.026,.044],
          [.58,.049,.035,.082],[.66,.017,.015,.065]],edge,6);
        loft(buf,petal,[[.55,.009,.010,.018],[.70,.048,.035,.055],[.81,.014,.016,.09]],pale,6);
      }
      orb(buf,place,center,.55,.25,.048,.078,.031,pale,7);
    }
  }
}

function distantColumn(site) {
  const buf = new SolidBuf(), p = (u,h,v) => columnPoint(u,h,v,site.ground);
  prism(buf,p,0,0,4.46,4.30,-.3,.40,stone);
  prism(buf,p,0,0,3.49,3.34,.40,1.02,edge);
  prism(buf,p,0,0,1.78,1.78,1.02,2.30,stone);
  prism(buf,p,0,0,.83,.83,2.30,5.4,edge);
  loft(buf,p,[[5.4,.38,.38],[12.84,.28,.28]],pale,7);
  loft(buf,p,[[12.84,.28,.28],[13.41,.5,.5],[13.48,.29,.29]],gilt,6);
  loft(buf,p,[[13.48,.32,.23],[14.74,.22,.14],[15.02,.13,.12],[15.38,.08,.08]],gilt,5);
  for (const u of [-1.4,1.4]) for (const v of [-1.4,1.4]) {
    loft(buf,faceAt(p,u,v,2.3,0),[[0,.37,.37],[1.03,.26,.21],[2.34,.09,.09]],robe,3);
  }
  return {stone:buf.geometry(),gold:null,ranges:[]};
}

function drawColumn(site,detailed) {
  const stoneBuf=new SolidBuf(), goldBuf=new SolidBuf(), ranges=[];
  const p=(u,h,v)=>columnPoint(u,h,v,site.ground);
  const box=(u,v,w,d,h,top,c)=>prism(stoneBuf,p,u,v,w,d,h,top,c);
  const shaft=(rows,c,n=16,buf=stoneBuf)=>loft(buf,p,rows.map(([y,r])=>[y,r,r]),c,n);
  for (const [i,s] of columnSteps.entries()) {
    box(0,0,s.w,s.d,s.bottom,s.top,i%2 ? edge : stone);
  }
  box(0,0,1.77,1.77,.99,2.16,stone);
  box(0,0,1.82,1.82,2.12,2.26,edge);
  box(0,0,.99,.99,2.26,3.86,stone);
  box(0,0,1.09,1.09,3.78,3.91,pale);
  box(0,0,.74,.74,3.91,5.25,edge);
  box(0,0,.89,.89,5.23,5.41,pale);
  const sideCount=detailed ? 22 : 16;
  shaft([[5.40,.53],[5.52,.53],[5.58,.421],[5.69,.41],[5.73,.346],[12.87,.276]],pale,sideCount);
  shaft([[5.68,.367],[5.75,.38],[5.79,.37],[5.83,.35]],leafGold,sideCount,goldBuf);
  shaft([[12.8,.28],[12.89,.365],[13,.34],[13.24,.51],[13.32,.54],[13.40,.49]],gilt,sideCount,goldBuf);
  prism(goldBuf,p,0,0,.46,.46,13.37,13.47,leafGold);
  for (let i=0;i<4;i++) {
    const a=(i+.5)*Math.PI/2, u=Math.cos(a)*1.99, v=Math.sin(a)*1.99;
    box(u,v,.46,.46,2.24,3.08,stone);
    box(u,v,.505,.505,3.08,3.22,edge);
    const upper=faceAt(p,u,v,3.22,a-Math.PI/2,.91);
    const b=i*Math.PI/2;
    const lower=faceAt(p,1.85*Math.cos(b),1.85*Math.sin(b),1.11,b-Math.PI/2,.83);
    figure(stoneBuf,upper,i);
    if (i===0) {
      // Ležící postava sv. Rozálie ve výklenku na východní straně.
      const lying=(x,y,z)=>lower(y-.79,.25-x,z+.12);
      figure(stoneBuf,lying,1);
    } else {
      prism(stoneBuf,lower,0,0,.42,.33,-.10,.07,edge);
      figure(stoneBuf,lower,i+4);
    }
    // Vpadlé výplně na pilířích a přesazené patky i římsy pod sochami.
    for (const [cx,cz,half,low,high] of [[u,v,.46,2.26,3.08],[0,0,.74,3.91,5.23]]) {
      const face=faceAt(p,cx,cz,low,b), side=half, h=high-low;
      prism(stoneBuf,face,0,side,.71*half,.012,.12,h-.13,recess);
      prism(stoneBuf,face,0,side+.011,.65*half,.014,.15,h-.16,edge);
      for (const [y,thick] of [[.06,.06],[h-.085,.08]]) {
        prism(stoneBuf,face,0,side,half+.035,.06,y,y+thick,pale);
      }
    }
  }
  box(0,0,1.8,1.8,1.03,1.16,recess);
  box(0,0,1.78,1.78,1.16,1.24,pale);
  box(0,0,1.06,1.06,2.32,2.46,edge);
  box(0,0,.85,.85,3.94,4.02,stone);
  for (let i=0;i<10;i++) {
    const a=i*2*Math.PI/10, leaf=faceAt(p,0,0,0,a);
    loft(goldBuf,leaf,[[5.79,.10,.032,0,.34],[5.93,.11,.048,0,.356],[6.19,.068,.035,.023,.36],
      [6.36,.011,.014,.052,.34]],leafGold,6);
    loft(goldBuf,leaf,[[12.91,.071,.034,0,.326],[13.05,.13,.055,0,.355],
      [13.23,.085,.085,.04,.43],[13.27,.02,.024,.075,.47]],gilt,7);
  }
  const east=faceAt(p,1.01,0,2.26,-Math.PI/2);
  prism(stoneBuf,east,0,0,.42,.019,.48,1.29,plaque);
  plaqueYears(goldBuf,east);
  figure(goldBuf,faceAt(p,0,0,13.47,1.12,1.12),0,true);
  for (const fixture of site.fixtures) {
    const start=stoneBuf.p.length;
    drawFence(stoneBuf,fixture,detailed);
    ranges.push({fixture,start,end:stoneBuf.p.length});
  }
  return {stone:stoneBuf.geometry(),gold:goldBuf.geometry(),ranges};
}

export function buildColumn(world,site,stoneMaterial,detailed,owner) {
  const lod=new THREE.LOD();
  lod.name='Morový sloup';
  lod.position.set(columnCenter.x,site.ground,columnCenter.z);
  const goldMaterial=new THREE.MeshStandardNodeMaterial({vertexColors:true,metalness:.54,roughness:.36,side:THREE.DoubleSide});
  const grain = vec2(positionLocal.x.add(positionLocal.z.mul(.62)),positionLocal.y.add(positionLocal.z.mul(.83)));
  const mottling = valueNoise(grain.mul(1.7)).mul(.32).add(valueNoise(grain.mul(19)).mul(.16)).add(.59);
  const carvedStone = new THREE.MeshStandardNodeMaterial({
    colorNode:vertexColor().rgb.mul(mottling), roughness:.92, side:THREE.DoubleSide,
  });
  owner.disposables.push(goldMaterial, carvedStone);
  for (const far of [false,true]) {
    const level=new THREE.Group();
    level.position.copy(lod.position).negate();
    const {stone,gold,ranges}=far ? distantColumn(site) : drawColumn(site,detailed);
    for (const [geo,material] of [[stone,far ? stoneMaterial : carvedStone],[gold,goldMaterial]]) {
      if (!geo) continue;
      const mesh=new THREE.Mesh(geo,material);
      mesh.castShadow=mesh.receiveShadow=true;
      level.add(mesh);
      owner.disposables.push(geo);
    }
    if (!far) owner.columnRails=attachRoadFurniture(world.breakables,level,stone,carvedStone,ranges);
    lod.addLevel(level,far ? (detailed ? 105 : 53) : 0, .09);
  }
  return lod;
}
