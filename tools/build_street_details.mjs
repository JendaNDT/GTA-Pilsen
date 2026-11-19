// Převod měřených ploch na lokální souřadnice detailu pro skutečné vrcholy herních dlaždic.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assetFingerprint, parsePack } from '../src/data.js';
import { loadStructureMap } from './audit_structures.mjs';
import { streetClearance } from './street_clearance.mjs';
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
    if (f.entrance !== undefined) {
      const [[ax,az],[bx,bz]] = f.edge;
      if (!Number.isFinite(f.entrance) || f.entrance < .55 || f.entrance > Math.hypot(bx-ax,bz-az)-.55)
        throw Error(section.id + ' – dveře leží mimo přiřazenou stěnu ' + f.building);
    }
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

function matchTile(pack, fronts, world, matched) {
  const matches = new Map();
  const {cx,cz}=pack.header;
  for(let i=0;i<pack.i.length;i+=3) {
    const ids=[pack.i[i],pack.i[i+1],pack.i[i+2]];
    if (ids.some(id=>Math.abs(pack.n[id*3+1])>24)) continue;
    for(const front of fronts) {
      const coords=ids.map(id=>faceCoordinates(cx+pack.p[id*3]*.02,pack.p[id*3+1]*.02,cz+pack.p[id*3+2]*.02,front,world.baseElevation));
      if(coords.every(Boolean)) {
        matched.add(front.sha256);
        // Spodní hrana měřeného pláště často leží ve sklepě. Výlohu a kliku
        // umístíme nad chodník u vstupu, samotnou měřenou geometrii zachováme.
        const [[ax, az], [bx, bz]] = front.edge;
        const along = front.entrance === undefined ? .5 : front.entrance / coords[0][2];
        const sidewalk = world.baseElevation + world.heightAt(ax + along * (bx - ax), az + along * (bz - az));
        const buried = Math.max(0, sidewalk - front.bottom);
        ids.forEach((id, j) => {
          const [u, v, width, height] = coords[j];
          matches.set(id, {uv: [u, v - buried, width, height - buried], entrance: front.entrance ?? 0});
        });
        break;
      }
    }
  }
  return matches;
}

export async function buildStreets(sourcePath, descriptions='tools/street-details', output='public/detail/streets') {
  const source=json(sourcePath), city=json('public/detail/city/index.json');
  const descriptionsList = readdirSync(descriptions).filter(f => f.endsWith('.json')).sort()
    .map(file => json(join(descriptions,file)));
  const structureFile = 'public/detail/structures/index.json';
  const {bridges, railDecks} = json(structureFile);
  const map = await loadStructureMap('public/data', bridges, railDecks);
  const check = await streetClearance(map, descriptionsList);
  const centers = new Map(city.tiles.map(([x,z,name]) => [name,[x,z]]));
  const sections = [], ids = new Set();
  mkdirSync(output,{recursive:true});
  for (const section of descriptionsList) {
    const fronts = verifiedFronts(section,source);
    const bounds=[Math.min(...section.outline.map(p=>p[0])),Math.min(...section.outline.map(p=>p[1])),
      Math.max(...section.outline.map(p=>p[0])),Math.max(...section.outline.map(p=>p[1]))];
    const tiles=[], indices=[], uv=[], entrances=[], matched=new Set();
    for(const [,,name,[x0,z0,x1,z1]] of city.tiles) {
      if (x1<bounds[0] || x0>bounds[2] || z1<bounds[1] || z0>bounds[3]) continue;
      const input=bytes(join('public/detail/city',name));
      const vertices=matchTile(parsePack(input), fronts, map.world, matched);
      if (!vertices.size) continue;
      tiles.push({name,hash:assetFingerprint(input),start:indices.length,count:vertices.size});
      for(const [id,coord] of vertices) {indices.push(id);uv.push(...coord.uv);entrances.push(coord.entrance);}
    }
    const missing = fronts.filter(front => !matched.has(front.sha256));
    if (missing.length) throw new Error(section.id + ' – chybí v herních dlaždicích: ' +
      missing.map(front => front.building + '/' + front.sha256).join(', '));
    if(!tiles.length) throw new Error(section.id+' – žádné přiřazení v distribuovaném modelu.');
    const owner = (x,z) => {
      let closest, distance = Infinity;
      for (const tile of tiles) {
        const [cx,cz] = centers.get(tile.name), d = Math.hypot(x-cx,z-cz);
        if (d < distance) { closest = tile; distance = d; }
      }
      return closest;
    };
    for (const item of section.furniture ?? []) {
      if (ids.has(item.id)) throw Error('Opakované ID vybavení ' + item.id);
      ids.add(item.id);
      const reason = check(item);
      if (reason) throw Error(section.id + ' – překážka v trase ' + reason + ' u ' + item.id);
      const tile = owner(item.x,item.z);
      (tile.furniture ??= []).push(item);
    }
    for (const patch of section.paving ?? []) {
      const points = patch.outline;
      if (!Array.isArray(points) || points.length < 3 || !points.every(p => p.length === 2 &&
          p.every(Number.isFinite) && p[0]>=bounds[0] && p[0]<=bounds[2] && p[1]>=bounds[1] && p[1]<=bounds[3])) {
        throw Error(section.id + ' – neplatná plocha dlažby');
      }
      const tile = owner(...points[0]);
      (tile.paving ??= []).push(patch);
    }
    const name=section.id+'.bin', dest=join(output,name);
    writePack(dest,{version:1,tiles}, {vertex:['u4',Uint32Array.from(indices)],front:['f4',Float32Array.from(uv)],entrance:['f4',Float32Array.from(entrances)]});
    sections.push({id:section.id,name,bounds,tiles:tiles.map(t=>t.name),hash:assetFingerprint(bytes(dest))});
  }
  const manifest={version:1,city:city.sha256,structures:assetFingerprint(bytes('public/detail/structures/index.json')),sections};
  writeFileSync(join(output,'index.json'),JSON.stringify(manifest)+'\n');
  return manifest;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildStreets(process.argv[2] ?? 'data-raw/e25/plochy.json',process.argv[3],process.argv[4]);
}
