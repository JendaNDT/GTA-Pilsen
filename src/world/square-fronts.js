import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { color, smoothstep, texture, uv } from 'three/tsl';
import houses from './square-fronts/houses.json' with { type: 'json' };
import { hasNorthSquare } from './north-square.js';
import { cellWidth, cellHeight, columns, crownLine, facadeY } from './square-gables.js';

const checksums = {
  '-128--128': '5ae2fb5a', '128--128': '74998e04',
  '-128-128': 'b9ad9ff6', '128-128': 'a787e843',
};
const atlases = {
  '-128--128': new URL('./square-fronts/-128--128.svg', import.meta.url).href,
  '128--128': new URL('./square-fronts/128--128.svg', import.meta.url).href,
  '-128-128': new URL('./square-fronts/-128-128.svg', import.meta.url).href,
  '128-128': new URL('./square-fronts/128-128.svg', import.meta.url).href,
};
const tiles = new Map(Object.entries(checksums).map(([tile, hash]) => [
  tile+'.bin', { hash, houses: houses.filter(h => h.tile===tile), path: tile },
]));
export const hasSquareFronts = file => tiles.has(file);
const clamp = THREE.MathUtils.clamp;

export function squareFrontGeometry(file, pack, shell, detailed, north = null) {
  const tile=tiles.get(file);
  if (!tile || tile.hash!==pack.fileHash) return null;
  const position=shell.getAttribute('position');
  const vertices=[], uvs=[], selected=new Map(), keep=[];
  const sample=tile.houses.length, rows=Math.ceil((sample+1)/columns);
  const panelsHeight=rows*cellHeight;
  const height=panelsHeight+(hasNorthSquare(file) ? 640 : 0);
  const pixel=(cell,x,y)=>[(cell%columns+x/cellWidth)/columns,1-(Math.floor(cell/columns)*cellHeight+y)/height];
  function triangle(points,inks) {
    for(let i=0;i<3;i++) {
      vertices.push(...points[i]);
      uvs.push(...inks[i]);
    }
  }
  for(const [cell,h] of tile.houses.entries()) {
    const [x,z]=h.left, dx=h.right[0]-x, dz=h.right[1]-z, length=Math.hypot(dx,dz);
    const point=(u,y,out=0)=>[x+u*dx-out*dz/length,y,z+u*dz+out*dx/length];
    const frontInk=(u,y)=>pixel(cell,clamp(u*cellWidth,1,cellWidth-1),clamp(facadeY(h,y),1,cellHeight-1));
    const line=crownLine(h);
    // Ustupující podlaží a předsunuté osy se kreslí na skutečné zaměřené stěny.
    const planar=line.length && ![6,7,11,15,25,32,36,38,39].includes(h.number);
    for (const [tag,ranges] of [['faces',h.faces],['roof',h.roof]]) {
      for (const [start,end] of ranges) for (let i=start;i<end;i+=3) {
        const ids=pack.i.subarray(i,i+3);
        if (!selected.has(ids[0])) selected.set(ids[0],new Set());
        selected.get(ids[0]).add(ids[1]+','+ids[2]);
        if (planar && tag==='faces') continue;
        const points=Array.from(ids,id=>[position.getX(id),position.getY(id),position.getZ(id)]);
        const inks=points.map(([px,y,pz])=>{
          const u=((px-x)*dx+(pz-z)*dz)/(length*length);
          if (tag==='faces') return frontInk(u,y);
          const depth=((px-x)*dz-(pz-z)*dx)/length;
          return pixel(sample,5+clamp(u,0,1)*309,(h.shape==='mansard'?130:5)+clamp(depth/14,0,1)*110);
        });
        triangle(points,inks);
      }
    }
    const edge=line.map(([u,rise])=>[u,h.eave+(h.peak-h.eave)*rise]);
    if (edge.length) {
      // V nízké kvalitě vyřízne přesný obrys stejná kresba na dvou trojúhelnících.
      const bottom=planar ? h.base-2 : h.eave-.03;
      const top=detailed ? edge : [[0,h.peak],[1,h.peak]];
      const contour=[[0,bottom],[1,bottom],...top.slice().reverse()];
      const indices=THREE.ShapeUtils.triangulateShape(contour.map(([u,y])=>new THREE.Vector2(u*length,y)),[]);
      for (const face of indices) {
        const corners=face.map(i=>contour[i]);
        triangle(corners.map(([u,y])=>point(u,y,.08)),corners.map(([u,y])=>frontInk(u,y)));
      }
    }
    if (!detailed) continue;
    // Krycí desky skutečně vystupují před omítku a vrhají při bočním světle stín.
    function ledge(a,b,height,depth) {
      const [u,y]=a,[v,q]=b;
      const outerA=point(u,y,.09+depth), outerB=point(v,q,.09+depth);
      function quad(a,b,c,d,inkX) {
        const ink=Array(3).fill(pixel(sample,inkX,290));
        triangle([a,b,c],ink); triangle([a,c,d],ink);
      }
      quad(point(u,y,-.16),point(v,q,-.16),outerB,outerA,60);
      quad(outerA,outerB,point(v,q-height,.09+depth),point(u,y-height,.09+depth),221);
    }
    ledge([0,h.eave],[1,h.eave],.13,.19);
    for(let i=1;i<edge.length;i++) ledge(edge[i-1],edge[i],.08,.08);
  }
  const old=shell.index.array;
  for(let i=0;i<old.length;i+=3) {
    if (!selected.get(old[i])?.has(old[i+1]+','+old[i+2])) keep.push(old[i],old[i+1],old[i+2]);
  }
  shell.setIndex(keep);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  let result=geo;
  if (north) {
    const uv=north.getAttribute('uv');
    for (let i=0;i<uv.count;i++) uv.setY(i,uv.getY(i)*640/height);
    result=mergeGeometries([geo,north]);
    result.computeBoundingSphere();
    geo.dispose();
    north.dispose();
  }
  result.userData.squareAddresses=tile.houses.map(h=>h.number);
  return result;
}

export function squareFrontMaterial(file,night) {
  const tile=tiles.get(file);
  const map=new THREE.TextureLoader().load(atlases[tile.path]);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  const mat=new THREE.MeshStandardNodeMaterial({map,side:THREE.DoubleSide,roughness:.88,alphaTest:.4});
  const glass=texture(map);
  const coordinate=uv();
  const bandsHeight=Math.ceil((tile.houses.length+1)/columns)*cellHeight;
  const wholeHeight=bandsHeight+(hasNorthSquare(file) ? 640 : 0);
  const row=coordinate.y.oneMinus().mul(wholeHeight/cellHeight).floor();
  const cell=row.mul(columns).add(coordinate.x.mul(columns).floor());
  const occupied=uv().x.mul(34).floor().add(uv().y.mul(21).floor()).mod(3).lessThan(1);
  mat.emissiveNode=color(0xffcf98).mul(smoothstep(.007,.038,glass.b.sub(glass.r)))
        .mul(occupied.and(cell.lessThan(tile.houses.length)).toFloat()).mul(night).mul(.42);
  if (hasNorthSquare(file)) {
    const northY=coordinate.y.mul(wholeHeight/640);
    const lit=coordinate.x.mul(36).floor().add(northY.mul(12).floor()).mod(3).lessThan(1)
      .and(coordinate.x.lessThan(.75)).and(northY.lessThanEqual(1));
    mat.emissiveNode=mat.emissiveNode.add(color(0xffce96).mul(smoothstep(.002,.018,glass.b.sub(glass.r)))
      .mul(lit.toFloat()).mul(night).mul(.45));
  }
  return mat;
}
