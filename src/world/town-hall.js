import * as THREE from 'three/webgpu';
import { color, smoothstep, step, texture, uv } from 'three/tsl';

export const townHallTile = '128--128.bin';
// Osa v sleduje zaměřenou jižní stěnu, kladné d míří do náměstí.
const width = Math.hypot(20.66, 3.56);
const ex = 20.66 / width, ez = 3.56 / width;
const point = (v, d, h) => [7.31 + ex*v - ez*d, h, -65.34 + ez*v + ex*d];
const local = ([x,h,z]) => [(x-7.31)*ex + (z+65.34)*ez, -(x-7.31)*ez + (z+65.34)*ex, h];
const pixel = (x, y) => [x/840, 1-y/850];
const scale = 620 / width;
const frontUV = (v, h) => pixel(340+v*scale, 775-(h+.58)*scale);
const brickUV = (v, h) => pixel(760+v*5, 330-h*7);
const finish = i => pixel(694+16*i, 838);
const umber=finish(0), sandstone=finish(1), shadow=finish(2), copper=finish(4);
const patina=finish(5), bronze=finish(6), dark=finish(7), gold=finish(8);

export function townHallGeometry(pack, shell) {
  if (pack.fileHash !== '74998e04') return null;
  const positions = [], uvs = [], keep = [];
  const pos = shell.getAttribute('position');
  function face(points, inks) {
    for (let i=0; i<points.length; i++) {
      positions.push(...points[i]);
      uvs.push(...inks[i]);
    }
  }
  function quad(a,b,c,d,ink) {
    const vertices = [a,b,c,a,c,d];
    face(vertices.map(p => point(...p)), vertices.map(p => typeof ink === 'function' ? ink(...p) : ink));
  }
  for (let j=0; j<pack.i.length; j+=3) {
    const ids = pack.i.subarray(j,j+3);
    // Tři původní jednoduché štíty a hranol věžičky nahrazuje vlastní silueta.
    if ((j>=336 && j<552) || (j>=732 && j<792)) continue;
    if (j>=42 && (j<642 || j>=657)) {
      keep.push(...ids);
      continue;
    }
    const points = Array.from(ids, i => [pos.getX(i), pos.getY(i), pos.getZ(i)]);
    face(points, points.map(p => {
      const [v,d,h] = local(p);
      if (j>=642) return pixel(760+v*7, 520-d*10);
      if (j===18 || j===21) return frontUV(v,h);
      return brickUV(d/2,h);
    }));
  }

  // Profil štítu leží v rovině průčelí. Horní hrany mají hloubku i při pohledu od rohu.
  function pediment(v, outline, near, far, ink) {
    const flat = outline.map(([x,y]) => [v+x,y]);
    const indices = THREE.ShapeUtils.triangulateShape(flat.map(([x,y]) => new THREE.Vector2(x,y)), []);
    for (const side of [near,far]) {
      for (const triangle of indices) {
        const vertices = triangle.map(i => flat[i]);
        face(vertices.map(([x,y]) => point(x,side,y)), vertices.map(([x,y]) => ink ?? brickUV(x,y)));
      }
    }
    for (let i=0; i<flat.length; i++) {
      const [x,h] = flat[i], [xx,hh] = flat[(i+1)%flat.length];
      quad([x,near,h],[xx,near,hh],[xx,far,hh],[x,far,h], ink ?? sandstone);
    }
  }
  function ledge(v, span, d, back, h, thick, ink) {
    pediment(v,[[-span/2,h],[span/2,h],[span/2,h+thick],[-span/2,h+thick]],d,back,ink);
  }
  function turned(v,d,profile,sides) {
    for (let row=1; row<profile.length; row++) {
      const [low,r] = profile[row-1], [high,r2,ink] = profile[row];
      for (let i=0; i<sides; i++) {
        const vertex = (j,y,radius) => [v+radius*Math.cos(j*2*Math.PI/sides),d+radius*Math.sin(j*2*Math.PI/sides),y];
        quad(vertex(i,low,r),vertex(i+1,low,r),vertex(i+1,high,r2),vertex(i,high,r2),ink);
      }
    }
  }
  const half = width/2, attic = 23.65;
  const atticInk = (v,d,h) => frontUV(v,h);
  quad([-half,.025,19.61],[half,.025,19.61],[half,.025,attic],[-half,.025,attic],atticInk);
  const back = -3.85;
  for (const v of [-half,half]) {
    quad([v,.025,19.62],[v,back,19.62],[v,back,attic],[v,.025,attic],(x,d,h) => brickUV(d,h));
  }
  ledge(0,width,.025,back,attic-.13,.13,umber);
  for (const [h,t,d,ink] of [[5.93,.14,.16,shadow],[19.55,.12,.23,sandstone],[19.71,.19,.34,shadow],
    [19.96,.09,.42,umber],[23.37,.15,.16,sandstone],[23.54,.19,.31,shadow]]) {
    ledge(0,width+2*d,d,-.48,h,t,ink);
  }
  // Klenáky a nadokenní římsy vystupují z kresby při bočním osvětlení.
  const atX = x => (x-340)/scale;
  const atY = y => (775-y)/scale-.58;
  for (const x of [111,213,340,451,565]) {
    for (const [y,span] of [[224,2.22],[347,1.71],[458,1.94]]) {
      ledge(atX(x),span,.10,-.025,atY(y),.085,umber);
    }
  }
  for (let i=0; i<13; i++) {
    const a=i*Math.PI/13+.009, b=(i+1)*Math.PI/13-.009;
    const corner = (angle,r) => [r*Math.cos(angle)/scale,atY(694-r*Math.sin(angle))];
    const outline = [corner(a,40),corner(a,54),corner(b,54),corner(b,40)];
    pediment(0,outline,.13+(i===6 ? .055 : 0),-.02,i%3===1 ? umber : sandstone);
  }
  for (const v of [-6.24,.28,6.59]) {
    pediment(v,[[-2.62,23.7],[2.62,23.7],[2.62,24],[2.18,24.04],[1.65,24.42],[1.43,24.92],
      [1.43,25.34],[.94,25.34],[0,25.94],[-.94,25.34],[-1.43,25.34],[-1.43,24.92],
      [-1.65,24.42],[-2.18,24.04],[-2.62,24]],.14,-.47);
    ledge(v,3.16,.27,-.53,25.14,.15,shadow);
    ledge(v,4.98,.24,-.54,23.99,.09,umber);
    for (const offset of [-1.38,0,1.38]) {
      const h = offset===0 ? 25.90 : 25.28;
      turned(v+offset,-.04,[[h,.14],[h+.14,.16,shadow],[h+.24,.08,bronze],[h+.44,.135,umber],
        [h+.55,.05,bronze],[h+1.02,.032,dark],[h+1.22,.008,bronze]],8);
    }
  }
  for (const v of [-10.17,-3.15,3.56,10.17]) {
    turned(v,-.06,[[23.65,.17],[23.85,.21,umber],[24.1,.12,shadow],[24.23,.15,bronze],
      [24.42,.045,dark],[24.9,.012,bronze]],8);
  }
  // Boční štíty mají odstupňované kamenné krytí podél hřebene.
  for (const [v, drift] of [[-half,.78],[half,.42]]) {
    for (let step=0; step<9; step++) {
      const d = -step*1.23, end = d-1.23;
      const side = v + drift*step/9;
      const h = Math.max(attic,19.62+(step+1)*1.32);
      quad([side,d,h],[side,end,h],[side,end,h-.95],[side,d,h-.95],(x,depth,y) => brickUV(depth,y));
      quad([side-.16,d,h],[side+.16,d,h],[side+.16,end,h],[side-.16,end,h],shadow);
    }
  }
  // Otevřená lucerna spočívá ve skutečné poloze původní věžičky na hřebeni střechy.
  const [v,d] = local([9.86,0,-76.3]);
  turned(v,d,[[30.12,1.31],[31.7,1.31,umber],[32.03,1.46,shadow],[32.23,1.49,copper],
    [32.38,1.17,copper]],12);
  for (let i=0; i<8; i++) {
    const a=i*Math.PI/4;
    turned(v+1.02*Math.cos(a),d+1.02*Math.sin(a),[[32.32,.15],[32.55,.17,shadow],
      [33.95,.105,dark],[34.16,.18,bronze]],8);
  }
  turned(v,d,[[34.11,1.2],[34.24,1.43,copper],[34.49,1.41,patina],[34.85,1.30,patina],
    [35.18,1.07,patina],[35.41,.68,patina],[35.57,.26,patina],[35.70,.11,copper],
    [35.93,.13,bronze],[36.06,.065,bronze],[36.49,.025,bronze],[36.54,.01,bronze]],24);
  shell.setIndex(keep);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function townHallMaterial(night) {
  const map = new THREE.TextureLoader().load(new URL('./town-hall.svg',import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const material = new THREE.MeshStandardNodeMaterial({map,side:THREE.DoubleSide,roughness:.87});
  // Modrošedé tabulky mají v kresbě vyšší modrou složku než kámen a okenní rámy.
  const painted = texture(map);
  const glazing = smoothstep(.003,.019,painted.b.sub(painted.r));
  const x = uv().x.mul(840), y = uv().y.oneMinus().mul(850);
  const bay = step(162,x).add(step(277,x)).add(step(398,x)).add(step(510,x));
  const floor = step(318,y).add(step(426,y)).add(step(605,y));
  const onFacade = x.greaterThan(46).and(x.lessThan(632)).and(y.greaterThan(209)).and(y.lessThan(752));
  const occupied = bay.add(floor).mod(3).lessThan(1).and(onFacade);
  material.emissiveNode = color(0xffc785).mul(glazing).mul(occupied.toFloat()).mul(night).mul(.58);
  return material;
}

// Obě ručičky mají stejný čep jako malovaný ciferník. Natočení vychází z místního herního času.
export function townHallClock(material) {
  const group = new THREE.Group();
  group.name = 'Radniční hodiny';
  group.position.set(...point(0,.09,(775-115)/scale-.58));
  group.rotation.y = -Math.atan2(ez,ex);
  function hand(length, spread, depth) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -spread,-.13,depth, spread,-.13,depth, spread*.66,length*.64,depth,
      -spread,-.13,depth, spread*.66,length*.64,depth, -spread*.66,length*.64,depth,
      -spread*.66,length*.64,depth, spread*.66,length*.64,depth, 0,length,depth
    ],3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({length:9},() => gold).flat(),2));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry,material);
    group.add(mesh);
    return mesh;
  }
  const hourHand = hand(.75,.07,.01), minuteHand = hand(1.12,.045,.023);
  group.setTime = hour => {
    hourHand.rotation.z = -hour*Math.PI/6;
    minuteHand.rotation.z = -hour*2*Math.PI;
  };
  return group;
}
