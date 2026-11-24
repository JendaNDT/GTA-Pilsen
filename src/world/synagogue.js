// Souřadnice v metrech před průčelím (u), podél ulice doleva (v) a nad městskou nulou (h).
import * as THREE from 'three/webgpu';

export const synagogueTile = '-384-128.bin';
const axis = Math.hypot(122, 35);
const nx = 122 / axis, nz = 35 / axis;
const atlas = (x, y) => [x / 144, y / 48];
const world = (u, v, h) => [-325 + u * nx - v * nz, h, 98 + u * nz + v * nx];

function crowns(vertex) {
  // Barvy kovu a kamene jsou na pravém okraji společné kresby.
  const stone = 137, red = 138, rib = 139, gold = 140, shadow = 141;
  function ring(u, v, bottom, top, sides, ink, phase, drum = false) {
    const point = ([h, r], side) => {
      const a = phase + side * 2 * Math.PI / sides;
      return world(u + r * Math.cos(a), v + r * Math.sin(a), h);
    };
    for (let i = 0; i < sides; i++) {
      for (const [row, j] of [[bottom,i],[top,i],[top,i+1],[bottom,i],[top,i+1],[bottom,i+1]]) {
        const coords = drum ? atlas(131 + (j-i)*4, row[0]-1) : atlas(ink+.5, 2);
        vertex(point(row, j), coords);
      }
    }
  }
  function profile(u, v, rings, sides, phase) {
    for (let i = 1; i < rings.length; i++) {
      ring(u, v, rings[i-1], rings[i], sides, rings[i][2], phase);
    }
  }
  function star(u, v, h) {
    for (const flip of [1,-1]) {
      const point = (i, radius) => world(u, v + Math.sin(i*2*Math.PI/3)*radius,
        h + flip*Math.cos(i*2*Math.PI/3)*radius);
      for (let i = 0; i < 3; i++) {
        for (const [j,r] of [[i,.61],[i+1,.61],[i+1,.43],[i,.61],[i+1,.43],[i,.43]]) {
          vertex(point(j,r), atlas(gold+.5,2));
        }
      }
    }
  }
  const phase = Math.PI / 8;
  for (const [u,v] of [[-1.2,9.1],[-1.3,-12.4]]) {
    // Římsy čtvercové spodní věže navazují za rohem na osmiboký tambur.
    const square = [[18.75,5.32],[18.87,5.55,stone],[19.08,5.55,stone],[19.17,5.32,shadow]];
    profile(u,v,square,4,Math.PI/4);
    profile(u,v,[[22.03,5.30],[22.22,5.62,stone],[22.49,5.62,stone],[22.60,5.28,stone]],4,Math.PI/4);
    profile(u,v,[[22.55,4.1],[22.8,4.25,stone],[23.15,3.92,shadow]],8,phase);
    ring(u,v,[23.15,3.92],[33.65,3.92],8,0,phase,true);
    profile(u,v,[[33.65,3.92],[33.85,4.13,stone],[34.2,4.35,stone],
      [34.52,4.27,stone],[34.72,3.60,shadow],[35.0,3.43,rib]],8,phase);
    const dome = [[34.98,3.42],[35.65,3.94],[36.75,4.34],[37.8,4.23],
      [38.7,3.74],[39.5,2.65],[40.12,1.5],[40.65,.54],[40.9,.35]];
    for (let k = 1; k < dome.length; k++) {
      ring(u,v,dome[k-1],dome[k],32,red,phase);
      for (let j = 0; j < 8; j++) {
        const angle = phase+j*Math.PI/4;
        for (const [row,delta] of [[k-1,-.035],[k,-.035],[k,.035],[k-1,-.035],[k,.035],[k-1,.035]]) {
          const [h,r] = dome[row];
          vertex(world(u+(r+.025)*Math.cos(angle+delta),v+(r+.025)*Math.sin(angle+delta),h),atlas(rib+.5,2));
        }
      }
    }
    profile(u,v,[[40.9,.35],[41.06,.5,rib],[41.3,.32,red],[41.48,.11,gold],
      [41.9,.09,gold],[42.05,.27,gold],[42.28,.16,gold],[42.35,.07,gold],[42.95,.045,gold]],12,phase);
    star(u,v,43.1);
  }
  profile(-.18,-1.72,[[27.65,1.04],[28.0,1.1,stone],[28.18,.85,stone],
    [29.35,.78,shadow],[29.52,.92,stone],[29.92,.6,stone],[30.16,.13,stone],[30.52,.045,gold]],8,phase);
}

export function synagogueSurface(pack, shell) {
  // Rozsahy indexů jsou svázané s konkrétní verzí městského měření.
  if (pack.fileHash !== 'f495308f') return null;
  const points = shell.attributes.position;
  const local = i => {
    const x = points.getX(i)+325, z = points.getZ(i)-98;
    return [x*nx+z*nz,-x*nz+z*nx,points.getY(i)];
  };
  const keep = [], positions = [], uvs = [];
  const vertex = (point, uv) => { positions.push(...point); uvs.push(...uv); };
  for (let j=0; j<pack.i.length; j+=3) {
    const ids = pack.i.subarray(j,j+3);
    // Vrchní osmiboké zdivo a provizorní jehlany věží mají vlastní kresbu a siluetu.
    if ((j>=9516 && j<=9705) || (j>=9870 && j<=9915)) continue;
    const first = ids[0]*3;
    const facing = Math.abs(pack.n[first]*nx + pack.n[first+2]*nz) / 127;
    const left = j>=7104 && j<=7449 && facing>.9 && pack.c[first]===177;
    const middle = j>=8340 && j<=9738 && pack.c[first]===156;
    const right = j>=9990 && j<=10299 && pack.c[first]===190;
    if ((left || middle || right) && Math.abs(pack.n[first+1])<10) {
      const vertices = Array.from(ids,local);
      const depth = vertices.reduce((s,p)=>s+p[0],0)/3;
      if (right || (left && depth>1 && depth<3) || (middle && depth>(facing>.88 ? -.1 : -4) && depth<3)) {
        for (let k=0; k<3; k++) {
          const [u,v,h] = vertices[k], i = ids[k];
          let s = 56-v;
          if (right && v < -37.5) s = 93.5 + Math.hypot(v+37.5,u-1.6);
          if (middle && facing<.8 && depth<.5) s = 39.1 + (u+5)*.16;
          const base = left ? 1.45 + (v-17.2)*.026 : right ? .45 : 1;
          vertex([points.getX(i),h,points.getZ(i)],atlas(s,h-base));
        }
        continue;
      }
    }
    keep.push(...ids);
  }
  shell.setIndex(keep);
  crowns(vertex);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function synagogueMaterial() {
  const map = new THREE.TextureLoader().load(new URL('./synagogue-front.svg',import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshStandardNodeMaterial({map, roughness:.85, side:THREE.DoubleSide});
}
