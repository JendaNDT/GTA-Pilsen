// Převod měřených ploch na lokální souřadnice detailu pro skutečné vrcholy herních dlaždic.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetFingerprint, parsePack } from '../src/data.js';
import { writePack } from './write_pack.mjs';

const bytes = path => Uint8Array.from(readFileSync(path)).buffer;
const json = path => JSON.parse(readFileSync(path));
const cm = value => Math.round(value * 100);

export function faceHash(uid, rings) {
  const canonical = rings.map(ring => {
    const points = [];
    for (let i=0; i<ring.length; i+=3) points.push(ring.slice(i,i+3).map(cm));
    return points.sort((a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
  });
  return createHash('sha256').update(JSON.stringify([uid, ...canonical])).digest('hex');
}

export function faceCoordinates(x,y,z,front,base) {
  const [[ax,az],[bx,bz]] = front.edge;
  const dx=bx-ax, dz=bz-az, width=Math.hypot(dx,dz);
  if (width < .1 || Math.abs((x-ax)*dz-(z-az)*dx) > width*.035) return null;
  const u=((x-ax)*dx+(z-az)*dz)/width, v=y+base-front.bottom, h=front.top-front.bottom;
  if (u < -.04 || u > width+.04 || v < -.04 || v > h+.04) return null;
  return [u,v,width,h];
}

export function verifiedFronts(section, source) {
  if(section.citySha256 !== source.sha256) throw new Error(section.id+' – jiná verze městského měření.');
  const requested = new Set(section.fronts.map(f=>f.building));
  const available = new Map();
  for (const [uid,faces] of source.buildings) if(requested.has(uid)) {
    for (const [type,...rings] of faces) if(type===1) available.set(faceHash(uid,rings),rings[0]);
  }
  for(const f of section.fronts) {
    const ring=available.get(f.sha256);
    if(!ring) throw new Error(section.id+' – přiřaď znovu stěnu '+f.building+' '+f.sha256);
    const coordinates = [];
    for (let i = 0; i < ring.length; i += 3) {
      const point = faceCoordinates(ring[i], ring[i + 1], ring[i + 2], f, 0);
      if (point) coordinates.push(point);
    }
    const u = coordinates.map(p => p[0]), v = coordinates.map(p => p[1]);
    if (coordinates.length !== ring.length / 3 || !coordinates.length ||
        Math.abs(Math.min(...u)) > .04 || Math.abs(Math.max(...u) - coordinates[0][2]) > .04 ||
        Math.abs(Math.min(...v)) > .04 || Math.abs(Math.max(...v) - coordinates[0][3]) > .04) {
      throw new Error(section.id+' – změněná hrana nebo výška stěny '+f.building);
    }
  }
  return section.fronts;
}

function matchTile(pack, fronts, elevation, matched) {
  const matches = new Map();
  const {cx,cz}=pack.header;
  for(let i=0;i<pack.i.length;i+=3) {
    const ids=[pack.i[i],pack.i[i+1],pack.i[i+2]];
    if (ids.some(id=>Math.abs(pack.n[id*3+1])>24)) continue;
    for(const front of fronts) {
      const coords=ids.map(id=>faceCoordinates(cx+pack.p[id*3]*.02,pack.p[id*3+1]*.02,cz+pack.p[id*3+2]*.02,front,elevation));
      if(coords.every(Boolean)) {
        matched.add(front.sha256);
        ids.forEach((id,j)=>matches.set(id,coords[j]));
        break;
      }
    }
  }
  return matches;
}

export function buildStreets(sourcePath, descriptions='tools/street-details', output='public/detail/streets') {
  const source=json(sourcePath), city=json('public/detail/city/index.json');
  const elevation=json('public/data/meta.json').baseElevation;
  const sections=[];
  mkdirSync(output,{recursive:true});
  for(const file of readdirSync(descriptions).filter(f=>f.endsWith('.json')).sort()) {
    const section=json(join(descriptions,file)), fronts=verifiedFronts(section,source);
    const bounds=[Math.min(...section.outline.map(p=>p[0])),Math.min(...section.outline.map(p=>p[1])),
      Math.max(...section.outline.map(p=>p[0])),Math.max(...section.outline.map(p=>p[1]))];
    const tiles=[], indices=[], uv=[], matched=new Set();
    for(const [,,name,[x0,z0,x1,z1]] of city.tiles) {
      if (x1<bounds[0] || x0>bounds[2] || z1<bounds[1] || z0>bounds[3]) continue;
      const input=bytes(join('public/detail/city',name));
      const map=matchTile(parsePack(input), fronts, elevation, matched);
      if (!map.size) continue;
      tiles.push({name,hash:assetFingerprint(input),start:indices.length,count:map.size});
      for(const [id,coord] of map) {indices.push(id);uv.push(...coord);}
    }
    const missing = fronts.filter(front => !matched.has(front.sha256));
    if (missing.length) throw new Error(section.id + ' – chybí v herních dlaždicích: ' +
      missing.map(front => front.building + '/' + front.sha256).join(', '));
    if(!tiles.length) throw new Error(section.id+' – žádné přiřazení v distribuovaném modelu.');
    const name=section.id+'.bin', dest=join(output,name);
    writePack(dest,{version:1,tiles}, {vertex:['u4',Uint32Array.from(indices)],front:['f4',Float32Array.from(uv)]});
    sections.push({id:section.id,name,bounds,tiles:tiles.map(t=>t.name),hash:assetFingerprint(bytes(dest))});
  }
  const manifest={version:1,city:city.sha256,structures:assetFingerprint(bytes('public/detail/structures/index.json')),sections};
  writeFileSync(join(output,'index.json'),JSON.stringify(manifest)+'\n');
  return manifest;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildStreets(process.argv[2] ?? 'data-raw/e25/plochy.json',process.argv[3],process.argv[4]);
}
