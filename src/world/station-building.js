// Západní průčelí leží na původních zaměřených plochách města.
// Místní souřadnice jsou vzdálenost od dveří, šířka průčelí a výška nad dlažbou.
import * as THREE from 'three/webgpu';
import { atan, color, float, mix, positionWorld, smoothstep, texture, uv } from 'three/tsl';
import { stationPaving } from './station-forecourt.js';

export const stationTile = '896-384.bin';
export const canopyTile = '640-384.bin';
const canopyHash = 'f800b6ca';
const surveyHash = 'eabccbc5';
const {origin, axisX, axisZ} = stationPaving;
const floor = 316.2 - 313.2;
const fullTurn = 2 * Math.PI;
const atlasUv = (x, y) => [(840 + x) / 1680, 1 - y / 1120];

function position(depth, width, height) {
  return [origin[0] + axisX[0]*depth + axisZ[0]*width, floor + height,
    origin[1] + axisX[1]*depth + axisZ[1]*width];
}

function surface() {
  return {points:[], coords:[]};
}

function finish({points, coords}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function finial(mesh, depth, width, base, size) {
  const rings = [[0,.46],[.12,.5],[.2,.31],[.43,.25],[.58,.38],[.83,.32],[1.02,.13],
    [1.18,.09],[1.23,.24],[1.32,.24],[1.38,.075],[2.9,.015]];
  for (let j = 1; j < rings.length; j++) {
    for (let i = 0; i < 8; i++) {
      for (const [row, side] of [[j-1,i],[j,i],[j,i+1],[j-1,i],[j,i+1],[j-1,i+1]]) {
        const [h,r] = rings[row], angle = side * fullTurn / 8;
        mesh.points.push(...position(depth + size*r*Math.cos(angle), width + size*r*Math.sin(angle), base + size*h));
        mesh.coords.push(r*Math.cos(angle), r*Math.sin(angle));
      }
    }
  }
}

function trim(mesh) {
  const quad = (a,b,c,d,ink) => {
    for (const vertex of [a,b,c,a,c,d]) {
      mesh.points.push(...position(...vertex));
      mesh.coords.push(...ink);
    }
  };
  const limestone = atlasUv(702,1073), iron = atlasUv(605,1073);
  for (const center of [-16.75,16.85]) {
    // Stupňovaná korunní římsa pokračuje za roh obou věží.
    const course = [[19.28,.04],[19.34,.14],[19.46,.15],[19.60,.31],[19.74,.31],[19.8,.09]];
    for (let i = 1; i < course.length; i++) {
      const corners = ([h, rim]) => [[-8.9-rim,center-3.55-rim,h],[-1.0+rim,center-3.55-rim,h],
        [-1.0+rim,center+3.55+rim,h],[-8.9-rim,center+3.55+rim,h]];
      const bottom = corners(course[i-1]), top = corners(course[i]);
      for (let j=0; j<4; j++) quad(bottom[j], bottom[(j+1)%4], top[(j+1)%4], top[j], limestone);
    }
  }
  for (const v of [-15,-9,-3,3,9,15]) {
    quad([.45,v,6.75],[7.34,v,8.29],[7.34,v,8.45],[.45,v,6.96],iron);
    quad([3.9,v,7.55],[4.86,v,8.24],[5.06,v,8.24],[4.11,v,7.55],iron);
  }
}

export function stationSurfaces(pack, shell) {
  const paintSteel = i => {
    shell.attributes.color.setXYZ(i,.092,.127,.133);
    shell.attributes.aWin.setZ(i,0);
  };
  if (pack.fileHash === canopyHash) {
    // Poslední dva metry stříšky patří do sousedního městského listu.
    // Těchto deset trojúhelníků odpovídá uvedenému otisku měření.
    for (const vertex of pack.i.subarray(5250,5280)) paintSteel(vertex);
    return null;
  }
  if (pack.fileHash !== surveyHash) return null;
  const front = surface(), copper = surface(), keep = [];
  const points = shell.attributes.position;
  const local = Array.from({length:points.count}, (_, i) => {
    const x = points.getX(i)-origin[0], z = points.getZ(i)-origin[1];
    return [x*axisX[0]+z*axisX[1], x*axisZ[0]+z*axisZ[1], points.getY(i)-floor];
  });
  for (let k = 0; k < pack.i.length; k += 3) {
    const ids = [pack.i[k], pack.i[k+1], pack.i[k+2]];
    const [a,b,c] = ids.map(i => local[i]);
    const depth = (a[0]+b[0]+c[0])/3, width = (a[1]+b[1]+c[1])/3, height = (a[2]+b[2]+c[2])/3;
    const first = ids[0], nx = pack.n[3*first]/127, ny = pack.n[3*first+1]/127, nz = pack.n[3*first+2]/127;
    const facing = Math.abs(nx*axisX[0] + nz*axisX[1]);
    const tower = Math.abs(width)>13 && Math.abs(width)<20.65;
    const canopy = [a,b,c].every(([u,v,h]) => u > -10 && u < 33 && Math.abs(v)<27 && h>7 && h<10)
      && Math.max(a[0],b[0],c[0]) > .8;
    if (canopy) ids.forEach(paintSteel);
    // První barevná složka rozlišuje v tomto městském listu krytinu a omítku.

    const dome = depth > -39 && depth < -.6 && Math.abs(width)<20.6 && height>17 && pack.c[3*first]===61;
    const lantern = depth > -27 && depth < -16 && Math.abs(width)<4.5 && height>30 && Math.abs(ny)<.2;
    const facade = depth >= -9.8 && depth < .65 && Math.abs(width) < 20.6 && Math.abs(ny)<.2
      && (facing>.90 || tower) && height<23 && pack.c[3*first]===177;
    if (!dome && !facade && !lantern) {
      keep.push(...ids);
      continue;
    }
    for (const i of ids) {
      const [u,v,h] = local[i];
      const mesh = dome ? copper : front;
      mesh.points.push(points.getX(i), points.getY(i), points.getZ(i));
      if (dome) {
        const small = Math.abs(width)>13 && depth > -9 && height > 19.8;
        mesh.coords.push(u - (small ? -5 : -21.6), v - (small ? Math.sign(width)*16.55 : 0));
      } else if (lantern) {
        const horizontal = facing > .7 ? v : u+21.6;
        mesh.coords.push(...atlasUv(horizontal*41, 1117-(h-30.2)*24));
      } else {
        // Na bočních lících věží běží kresba podél jejich hloubky.
        const bay = facing > .88 ? v : Math.sign(width)*(16.75 + (u+4.95)*.80);
        mesh.coords.push(...atlasUv(bay*40, (23-h)*40));
      }
    }
  }
  if (!front.points.length || !copper.points.length) return null;
  shell.setIndex(keep);
  // Tabule na hraně stříšky, nad průchozí výškou spodního vstupu.
  for (const [v,h,s,t] of [[-8.8,8.21,-540,1033],[8.8,8.21,540,1033],[8.8,9.23,540,978],
    [-8.8,8.21,-540,1033],[8.8,9.23,540,978],[-8.8,9.23,-540,978]]) {
    front.points.push(...position(7.64,v,h));
    front.coords.push(...atlasUv(s,t));
  }
  trim(front);
  finial(copper,-5,-16.4,25.3,.88);
  finial(copper,-5,16.7,25.2,.88);
  finial(copper,-21.7,-.08,35.92,1.1);
  return {front:finish(front), copper:finish(copper)};
}

export function stationMaterials(night) {
  const map = new THREE.TextureLoader().load(new URL('./station-front.svg', import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const painted = texture(map);
  const front = new THREE.MeshStandardNodeMaterial({side:THREE.DoubleSide, roughness:.89});
  front.colorNode = painted.rgb;
  const glass = smoothstep(.005,.025,painted.b.sub(painted.r)).mul(smoothstep(.14,.16,uv().y));
  const letters = smoothstep(.075,.08,uv().y).mul(float(1).sub(smoothstep(.13,.14,uv().y)))
    .mul(smoothstep(.4,.65,painted.r));
  front.emissiveNode = painted.rgb.mul(letters.mul(.65).add(.13))
    .add(color(0xc09868).mul(glass).mul(painted.b.add(.25))).mul(night);
  // Polární směr se počítá na povrchu, aby švy plechu navazovaly přes hrany trojúhelníků.
  const panel = atan(uv().y, uv().x).mul(32/fullTurn);
  const seam = smoothstep(.025,.10,panel.fract()).mul(float(1).sub(smoothstep(.94,.99,panel.fract())));
  const course = smoothstep(.0,.085,positionWorld.y.mul(1.2).add(panel.floor().mod(2).mul(.5)).fract());
  const copper = new THREE.MeshStandardNodeMaterial({side:THREE.DoubleSide,roughness:.72,metalness:.19});
  copper.colorNode = mix(color(0x87aaa1),color(0xafcdc3),seam.mul(.8).add(course.mul(.2)));
  return {front,copper,map};
}
