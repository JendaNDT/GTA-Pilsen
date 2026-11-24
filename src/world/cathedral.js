import * as THREE from 'three/webgpu';

export const cathedralTile = '-128-128.bin';
const axis = Math.hypot(31.44,6.98);
const east = 31.44/axis, south = 6.98/axis;
// Podélná osa s míří od západního portálu k závěru. Kladné t vede k jižní kapli.
const point = (s,t,h) => [east*s-south*t,h,south*s+east*t];
const local = ([x,h,z]) => [east*x+south*z,-south*x+east*z,h];
const uv = (x,y) => [x/1536,1-y/1024];
const ink = i => uv(1257+i*27,817);
const trim = ink(0), light = ink(1), shade = ink(2), slate = ink(3);
const brass = ink(6), iron = ink(7);
const clockFaces = [[-24.55,-9.54,0,-1],[-19.28,-4.69,1,0],[-24.42,.25,0,1],[-29.28,-4.66,-1,0]];

const wall = (s,t,ns,nt) => (x,y,d) => point(s+x*nt+ns*d,t-x*ns+nt*d,y);

// Koncové body zaměřených stěn presbytáře a boční kaple v místních souřadnicích.
const choirBays = [
  [20.51,-1.44,23.42,-1.46],[24.41,-1.47,26.63,-.57],[27.46,.01,28.80,2.03],
  [29.07,2.98,29.05,5.37],[28.85,6.30,27.24,8.30],[26.37,8.81,24.09,9.55],
  [23.09,9.83,20.85,9.84],[20.02,9.83,12.85,9.75],[12.71,-1.40,20.51,-1.46]
];
const chapelBays = [[21.61,11.69,21.54,14.10],[21.24,14.88,19.44,16.58],[18.55,16.93,16.15,16.88]];

export function cathedralGeometry(pack,shell) {
  if (pack.fileHash !== 'b9ad9ff6') return null;
  const positions = [], coords = [];
  const original = shell.getAttribute('position');
  function triangle(points,inks) {
    for (let i=0;i<3;i++) {
      positions.push(...points[i]);
      coords.push(...inks[i]);
    }
  }
  function quad(points,inks) {
    triangle([points[0],points[1],points[2]],[inks[0],inks[1],inks[2]]);
    triangle([points[0],points[2],points[3]],[inks[0],inks[2],inks[3]]);
  }
  function solid(points,color) { quad(points,[color,color,color,color]); }

  // Prvních 1 117 trojúhelníků ověřeného listu tvoří výhradně městský model katedrály.
  // Střechy si ponechávají i svou samostatnou síť pro fyziku.
  for (let j=0;j<3351;j+=3) {
    const ids = pack.i.subarray(j,j+3);
    const points = Array.from(ids,i => [original.getX(i),original.getY(i),original.getZ(i)]);
    const cart = points.map(local);
    const first = ids[0]*3;
    const across = Math.abs(pack.n[first]*east+pack.n[first+2]*south)>.72*127;
    const roof = pack.c[first]===23;
    const spire = cart.every(p => p[2]>=56.25) && cart.some(p => p[2]>56.28);
    triangle(points,cart.map(([s,t,h]) => {
      const along = across ? t : s;
      if (spire) return uv(920+(across ? t+4.7 : s+24.4)*18,983-(h-56)*9.7);
      if (roof) return uv(1155+along*9.6,500-Math.min(h,45)*10.1-(across ? s : t)*1.3);
      return uv(392+10.4*along,680-h*10.4);
    }));
  }
  shell.setIndex(new THREE.BufferAttribute(pack.i.slice(3351),1));

  // Lomený oblouk má svislé ostění a dvě kružnicová ramena. Šířky říms se měří v metrech.
  function opening(place,bottom,height,radius,kind) {
    const glyph = [70,221,372,523][kind];
    const rise = Math.min(radius*1.78,height*.36);
    // Krátké oblouky stačí rozdělit na čtyři úseky na každé straně, široké portály na šest.
    const segments = radius > 1.8 ? 6 : 4;
    function outline(offset,depth) {
      const r = radius+offset, base = bottom-offset, crown = rise+offset;
      const rows = [{w:r,h:base,y:998},{w:r,h:bottom+height-rise,y:818}];
      for (let i=1;i<=segments;i++) {
        const t = i/segments;
        rows.push({w:r*(Math.sqrt(4-3*t*t)-1),h:bottom+height-rise+crown*t,y:818-84*t});
      }
      const side = (row,sign) => place(sign*row.w,row.h,depth);
      const edge = [...rows.map(row => side(row,-1)),...rows.slice(0,-1).reverse().map(row => side(row,1))];
      return {rows,edge};
    }
    const glass = outline(0,.12);
    const texturePoint = (w,row) => uv(glyph+w/radius*61,row.y);
    for (let i=1;i<glass.rows.length;i++) {
      const a=glass.rows[i-1], b=glass.rows[i];
      const vertices = [place(-a.w,a.h,.12),place(a.w,a.h,.12),place(b.w,b.h,.12),place(-b.w,b.h,.12)];
      const tex = [texturePoint(-a.w,a),texturePoint(a.w,a),texturePoint(b.w,b),texturePoint(-b.w,b)];
      if (i===glass.rows.length-1) triangle(vertices.slice(0,3),tex.slice(0,3));
      else quad(vertices,tex);
    }
    let inner = glass.edge;
    const profiles = kind === 3
      ? [[.09,.23,shade],[.19,.37,light],[.29,.31,trim],[.42,.48,light],[.56,.27,trim]]
      : [[.14,.29,light],[.28,.10,trim]];
    for (const [offset,d,color] of profiles) {
      const outer = outline(offset,d).edge;
      for (let i=0;i<inner.length;i++) {
        const next = (i+1)%inner.length;
        solid([inner[i],inner[next],outer[next],outer[i]],color);
      }
      inner = outer;
    }
  }

  // Větší prostřední pole má čtyřdílnou kružbu. Západní pole nízké jižní věže je slepé.
  for (const [s,t,sign,r] of [[-16.38,17.23,1,1.30],[-7.82,17.12,1,2.12],[.68,17.0,1,1.32],[8.55,16.91,1,1.35],
    [-16.15,-9.33,-1,1.36],[-7.7,-9.34,-1,1.91],[.71,-9.30,-1,1.35],[8.23,-9.22,-1,1.36]]) {
    opening(wall(s,t,0,sign),3.35,19.55,r,r>1.8 ? 1 : 0);
  }
  function measuredWindow([a,b,c,d],base,h,r) {
    const length = Math.hypot(c-a,d-b);
    opening(wall((a+c)/2,(b+d)/2,(d-b)/length,(a-c)/length),base,h,Math.min(r,length*.405),0);
  }
  for (const bay of choirBays) measuredWindow(bay,2.55,18.2,1.32);
  for (const bay of chapelBays) measuredWindow(bay,2.35,7.0,.96);
  opening(wall(-29.37,4.20,-1,0),10.0,14.1,2.22,1);
  opening(wall(-29.38,4.20,-1,0),-.36,8.32,2.15,3);
  opening(wall(-29.32,12.6,-1,0),2.7,7.65,.75,0);
  opening(wall(-29.32,-4.65,-1,0),2.8,7.4,.83,0);
  measuredWindow([20.7,-10.98,21.8,-10.92],2.8,5.8,.48);
  opening(wall(-5.85,21.79,.734,.680),-.35,5.50,1.05,3);
  opening(wall(-9.52,22.05,-.656,.755),1.24,3.65,.64,0);
  for (const s of [-11.25,-8.95,-6.60,-4.35]) opening(wall(s,-13.05,0,-1),.25,5.15,.55,2);

  for (const settings of clockFaces) {
    const place = wall(...settings);
    opening(place,43.45,6.66,1.20,2);
    const size = 2.03, y = 53.38;
    quad([place(-size,y-size,.16),place(size,y-size,.16),place(size,y+size,.16),place(-size,y+size,.16)],
      [uv(1060,809),uv(1214,809),uv(1214,655),uv(1060,655)]);
  }
  for (const index of [0,3]) {
    const place = wall(...clockFaces[index]);
    for (const y of [16.6,26.7,35.9]) opening(place,y,1.85,.18,2);
  }

  function prismFootprint(corners,height,thickness,color) {
    const bottom = corners.map(([s,t])=>point(s,t,height));
    const top = corners.map(([s,t])=>point(s,t,height+thickness));
    for (let i=0;i<corners.length;i++) {
      const j=(i+1)%corners.length;
      solid([bottom[i],bottom[j],top[j],top[i]],color);
      if (i>0 && i+1<corners.length) triangle([top[0],top[i],top[j]],[color,color,color]);
    }
  }
  // Odkapy obíhají také vyčnívající pilíře. Rozměry líců pocházejí ze stejného městského listu.
  const towerPiers = [
    [[-30.6,-9.3],[-29.1,-10.8],[-27.7,-9.4],[-29.2,-7.9]],
    [[-21.7,-10.8],[-19.4,-10.8],[-19.3,-9.5],[-21.6,-9.5]],
    [[-30.4,-1.9],[-29.2,-1.9],[-29.2,.2],[-30.4,.2]],
    [[-21.5,.1],[-19.5,.1],[-19.5,1.2],[-21.4,1.2]]
  ];
  function drip(corners,levels) {
    const center = corners.reduce(([s,t],[x,z])=>[s+x/corners.length,t+z/corners.length],[0,0]);
    const lip = corners.map(([s,t])=>[s+.12*Math.sign(s-center[0]),t+.12*Math.sign(t-center[1])]);
    for (const h of levels) prismFootprint(lip,h,.17,trim);
  }
  for (const corners of towerPiers) drip(corners,[5.55,15.2,25.6,34.8,42.82,51.2]);
  for (const [s,t,depth] of [[-12.35,17.2,2.0],[-3.18,17.04,1.86],[4.4,16.93,1.91],
    [-12.37,-9.28,-2.02],[-2.9,-9.31,-2.07],[4.41,-9.23,-2.04],[12.2,-9.2,-2.05]]) {
    drip([[s-.7,t],[s+.7,t],[s+.7,t+depth],[s-.7,t+depth]],[2.75,10.1,17.8]);
  }
  const rim = [[-29.4,-8.03],[-27.76,-9.64],[-19.12,-9.64],[-19.28,.32],[-29.40,.45]];
  for (const h of [5.55,15.2,25.6,34.8,42.82,55.95]) prismFootprint(rim,h,.18,h>55 ? shade : trim);
  for (const place of clockFaces.map(f => wall(...f))) {
    const beam = (left,right,low,high,d,color) => solid([place(left,low,d),place(right,low,d),place(right,high,d),place(left,high,d)],color);
    beam(-4.92,4.92,56.08,56.48,.30,shade);
    beam(-4.84,4.84,57.55,57.72,.26,iron);
    for (let i=-4;i<=4;i++) beam(i*1.12-.055,i*1.12+.055,56.46,57.58,.25,iron);
  }
  // Světlý štít nad presbytářem je vidět z východní strany náměstí.
  const gable = wall(12.91,4.14,1,0);
  const end = [[-13.08,25.5],[-5.62,33.49],[-5.62,34.55],[0,43.75],[5.50,34.55],[5.50,33.49],[13.30,25.5]];
  for (let i=1;i<end.length-1;i++) {
    const vertices = [end[0],end[i],end[i+1]];
    triangle(vertices.map(([x,h])=>gable(x,h,.065)),vertices.map(([x,h])=>uv(1280+x*10,614-(h-25)*4)));
  }
  for (const [x,h] of [[-2,37.8],[1.65,37.8],[2.1,32.7]]) {
    solid([gable(x-.18,h,.09),gable(x+.18,h,.09),gable(x+.18,h+.72,.09),gable(x-.18,h+.72,.09)],shade);
  }
  function turned(s,t,profile,sides) {
    for (let j=1;j<profile.length;j++) {
      const [h,r] = profile[j-1], [high,r2,color] = profile[j];
      const at = (i,y,radius) => point(s+radius*Math.cos(i*2*Math.PI/sides),t+radius*Math.sin(i*2*Math.PI/sides),y);
      for (let i=0;i<sides;i++) solid([at(i,h,r),at(i+1,h,r),at(i+1,high,r2),at(i,high,r2)],color);
    }
  }
  function lantern(s,t,h,size) {
    const tier = (rows,n) => turned(s,t,rows.map(([y,r,c])=>[h+y*size,r*size,c]),n);
    tier([[-1.55,.83],[.42,.83,slate],[.63,1.0,trim],[.75,.87,slate]],8);
    for (let i=0;i<8;i++) {
      const angle=i*Math.PI/4;
      turned(s+.71*size*Math.cos(angle),t+.71*size*Math.sin(angle),
        [[h+.70*size,.096*size],[h+2.07*size,.09*size,iron]],6);
    }
    tier([[2.04,.84],[2.26,.94,slate],[2.76,.63,slate],[5.8,.065,slate],[6.02,.11,brass],[6.72,.014,iron]],8);
  }
  // Baldachýn nad hlavním portálem a kamenná konzola pod ním.
  const west = wall(-29.38,4.2,-1,0);
  function canopy(y,r,h) {
    const corners=[west(-r,y,.18),west(r,y,.18),west(r*.7,y,.76),west(-r*.7,y,.76)];
    solid(corners,trim);
    for (let i=0;i<4;i++) triangle([corners[i],corners[(i+1)%4],west(0,y+h,.39)],[light,light,trim]);
  }
  canopy(9.93,.59,.61);
  canopy(8.64,.43,-.32);
  lantern(-3,4.17,43.77,1.02);
  lantern(20.5,4.12,32.53,.82);
  turned(-24.39,-4.72,[[100.47,.095],[100.74,.145,brass],[100.94,.05,brass],[101.51,.012,brass]],10);

  function dormer(s,t,sign,h,size) {
    const place = wall(s,t,0,sign);
    const a=place(-size,h,0), b=place(size,h,0), c=place(0,h+size*1.7,0), ridge=place(0,h+size*2.1,-size*2);
    triangle([a,b,c],[iron,iron,iron]);triangle([a,c,ridge],[slate,slate,slate]);triangle([c,b,ridge],[slate,slate,slate]);
  }
  for (const s of [-16.4,-8,.4,8.6]) {
    dormer(s,13.3,1,29.25,.65); dormer(s,-5.9,-1,29.1,.65);
    dormer(s,8.63,1,36.45,.39); dormer(s,-.4,-1,36.2,.39);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function cathedralMaterial() {
  const map = new THREE.TextureLoader().load(new URL('./cathedral.svg',import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardNodeMaterial({map,side:THREE.DoubleSide,roughness:.86});
}

// Čtyři ciferníky sdílejí jednu geometrii ručiček a aktualizují se jednou za herní minutu.
export function cathedralHands() {
  const places = clockFaces.map(f=>wall(...f));
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.Float32BufferAttribute(new Float32Array(4*2*6*3),3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',positions);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(Array.from({length:positions.count},()=>brass).flat(),2));
  let previous = -1;
  function setTime(hour) {
    const minute = Math.floor(hour*60+1e-8);
    if (minute===previous) return;
    previous = minute;
    let index = 0;
    for (const place of places) {
      for (const [angle,length,width,d] of [[minute*Math.PI/360,1.09,.095,.19],[minute*Math.PI/30,1.61,.068,.22]]) {
        for (const [x,y] of [[0,-.21],[width,length*.39],[0,length],[0,length],[-width,length*.39],[0,-.21]]) {
          const across=x*Math.cos(angle)+y*Math.sin(angle), up=y*Math.cos(angle)-x*Math.sin(angle);
          positions.setXYZ(index++,...place(across,53.38+up,d));
        }
      }
    }
    positions.needsUpdate = true;
  }
  setTime(0);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 2;
  return {geometry,setTime};
}
