import * as THREE from 'three/webgpu';
import { color, smoothstep, texture, uv } from 'three/tsl';

// Rozsahy v ověřených městských listech označují pouze průčelí a střešní plochy do náměstí.
// Souřadnice jsou v metrech, výšky vůči výškovému počátku hry.
const west = [
  { address: 40, cell: 0, left: [-41.48,-73.84], right: [-21.2,-69.94], ground: -2.24, eave: 13.79,
    front: [[468,483]], roof: [[840,846]], rise: 21.5 },
  { address: 41, cell: 1, left: [-21.22,-69.94], right: [-3.02,-67.12], ground: -2.24, eave: 14.27,
    front: [[36,123]], roof: [[384,390]], rise: 21.6 },
];
const east = [
  { address: 2, cell: 2, left: [17.64,-63.56], right: [36.64,-61.5], ground: -2.4, eave: 13.15,
    front: [[978,996],[1071,1086]], roof: [[1290,1296]], rise: 18.5 },
  { address: 3, cell: 3, left: [36.60,-61.32], right: [51.46,-59.9], ground: -2.52, eave: 11.14,
    front: [[6237,6246]], roof: [[6372,6378]], rise: 17.4 },
  { address: 4, cell: 4, left: [51.46,-60.06], right: [57.72,-59.36], ground: -2.58, eave: 10.87,
    front: [[5892,5916]], roof: [], rise: 16.1 },
  { address: 5, cell: 5, left: [57.72,-59.36], right: [79.48,-56.96], ground: -2.72, eave: 11.64,
    front: [[4899,4908],[5172,5178]], roof: [[5589,5598]], rise: 18.6 },
];
const tiles = new Map([
  ['-128--128.bin', { hash: '5ae2fb5a', houses: west }],
  ['128--128.bin', { hash: '74998e04', houses: east }],
]);
export const hasNorthSquare = tile => tiles.has(tile);

export function northSquareGeometry(tile, pack, shell, detailed) {
  const entry = tiles.get(tile);
  if (!entry || pack.fileHash !== entry.hash) return null;
  const position = shell.getAttribute('position');
  const vertices = [], uvs = [], keep = [], selected = new Map();
  const pixel = (x,y) => [x/1280, 1-y/640];
  function triangle(points, inks) {
    for (let i=0; i<3; i++) {
      vertices.push(...points[i]);
      uvs.push(...inks[i]);
    }
  }
  for (const house of entry.houses) {
    const [x,z] = house.left;
    const dx = house.right[0]-x, dz = house.right[1]-z;
    const length = Math.hypot(dx,dz), ex = dx/length, ez = dz/length;
    const slopes = [];
    const point = (u,h,out) => [x+u*ex-out*ez,h,z+u*ez+out*ex];
    for (const [ranges, roof] of [[house.front,false],[house.roof,true]]) {
      for (const [start,end] of ranges) for (let offset=start; offset<end; offset+=3) {
        const ids = pack.i.subarray(offset,offset+3);
        const points = Array.from(ids,id=>[position.getX(id),position.getY(id),position.getZ(id)]);
        if (roof) slopes.push(new THREE.Triangle(...points.map(p => new THREE.Vector3(...p))));
        const inks = points.map(([px,h,pz])=>{
          const u = THREE.MathUtils.clamp(((px-x)*ex+(pz-z)*ez)/length,0,1);
          if (roof) {
            const rise = THREE.MathUtils.clamp((h-house.eave)/(house.rise-house.eave),0,1);
            return pixel(963+u*314,house.cell*100+95-rise*91);
          }
          const v = 312-216*(h-house.ground)/(house.eave-house.ground);
          return pixel(house.cell%3*320+1+u*318,Math.floor(house.cell/3)*320+THREE.MathUtils.clamp(v,1,319));
        });
        triangle(points, inks);
        if (!selected.has(ids[0])) selected.set(ids[0],new Set());
        selected.get(ids[0]).add(ids[1]+','+ids[2]);
      }
    }
    if (!detailed) continue;
    // Horní plochy a čela říms čtou světlo i při pohledu podél řady.
    function moulding(u1,h1,u2,h2,depth,thickness) {
      const back = house.address===41 ? .61 : .045;
      const high1=point(u1,h1,back+depth), high2=point(u2,h2,back+depth);
      const low1=point(u1,h1-thickness,back+depth), low2=point(u2,h2-thickness,back+depth);
      const inner1=point(u1,h1,back-.10), inner2=point(u2,h2,back-.10);
      const quad=(a,b,c,d,swatch)=>{
        const ink=Array(3).fill(pixel(swatch,617));
        triangle([a,b,c],ink); triangle([a,c,d],ink);
      };
      quad(inner1,inner2,high2,high1,1100);
      quad(high1,high2,low2,low1,1005);
      quad(low1,low2,point(u2,h2-thickness,back-.10),point(u1,h1-thickness,back-.10),1205);
    }
    moulding(0,house.eave,length,house.eave,.27,.15);
    // Nad vstupy Pechovského domu jsou tři lomené nadokenní římsy.
    if (house.address===40) {
      const h=house.ground+(312-188)/216*(house.eave-house.ground);
      for (const axis of [56,159,263]) {
        const mid=axis/320*length, half=length*.070;
        moulding(mid-half,h,mid,h+.53,.16,.10);
        moulding(mid,h+.53,mid+half,h,.16,.10);
      }
    }
    // Vikýře se opírají o skutečnou šikmou plochu střechy, včetně valby na nároží.
    function dormer(fraction, level, tall) {
      const u=length*fraction, h=house.eave+(house.rise-house.eave)*level;
      const along=point(u,h,0);
      for (const slope of slopes) {
        const plane=slope.getPlane(new THREE.Plane());
        const outward=new THREE.Vector3(-ez,0,ex);
        const divisor=plane.normal.dot(outward);
        if (Math.abs(divisor)<.01) continue;
        const d=-plane.distanceToPoint(new THREE.Vector3(...along))/divisor;
        if (!slope.containsPoint(new THREE.Vector3(...point(u,h,d)))) continue;
        const width=tall ? .61 : .73, height=tall ? .74 : .32;
        const lip=d+.18;
        const a=point(u-width,h-.10,lip), b=point(u+width,h-.10,lip);
        const l=point(u-width*.48,h+height,lip), r=point(u+width*.48,h+height,lip);
        const ridge=point(u,h+height+.11,lip-.10), back=point(u,h+height+.17,d-.85);
        const paint=(p,q,r,swatch)=>triangle([p,q,r],Array(3).fill(pixel(swatch,617)));
        paint(a,b,r,975); paint(a,r,l,975);
        paint(a,l,back,1246); paint(l,ridge,back,1192); paint(ridge,r,back,1192); paint(r,b,back,1246);
        paint(l,r,ridge,1192);
        return;
      }
    }
    if (slopes.length) {
      for (const fraction of [.15,.48,.825]) dormer(fraction,.22,false);
      if (house.address===41) for (const fraction of [.29,.69]) dormer(fraction,.57,true);
    }
    if (house.address===4) {
      const peak = (54.52-x)*ex+(-59.72-z)*ez;
      moulding(0,14.34,peak,16.12,.16,.14);
      moulding(peak,16.12,length,14.34,.16,.14);
    }
  }
  // Zachovej také předchozí výběr trojúhelníků radnice na společné dlaždici.
  const indices = shell.index.array;
  for (let i=0; i<indices.length; i+=3) {
    const a=indices[i], b=indices[i+1], c=indices[i+2];
    if (!selected.get(a)?.has(b+','+c)) keep.push(a,b,c);
  }
  shell.setIndex(keep);
  const front = new THREE.BufferGeometry();
  front.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  front.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  front.computeVertexNormals();
  front.computeBoundingSphere();
  return front;
}

export function northSquareMaterial(night) {
  const map = new THREE.TextureLoader().load(new URL('./north-square.svg', import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mat = new THREE.MeshStandardNodeMaterial({map, side:THREE.DoubleSide, roughness:.89});
  const texel=texture(map), glazing=smoothstep(.002,.018,texel.b.sub(texel.r));
  const bay=uv().x.mul(36).floor(), floor=uv().y.mul(12).floor();
  const occupied=bay.add(floor).mod(3).lessThan(1).and(uv().x.lessThan(.75));
  mat.emissiveNode=color(0xffce96).mul(glazing).mul(occupied.toFloat()).mul(night).mul(.45);
  return mat;
}
