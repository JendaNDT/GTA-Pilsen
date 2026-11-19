import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three/webgpu';
import { indexRoutes, corridor } from './audit_structures.mjs';
import { STREET_MODELS } from '../src/world/street-furniture.js';

// Konzervativní kružnice obepíše půdorys modelu i při pootočení.
export function blocksPassage(x,z,y,radius,height,route) {
  const dx=x-route.x, dz=z-route.z;
  const along=dx*route.dx+dz*route.dz;
  const across=Math.abs(dz*route.dx-dx*route.dz);
  const end=Math.max(0,-along,along-route.length);
  const side=Math.max(0,across-route.width);
  const floor=route.y+route.grade*Math.max(0,Math.min(route.length,along));
  return Math.hypot(end,side) < radius && y+height>floor+.12 && y<floor+route.height;
}

export async function streetClearance({world, stops}, sections) {
  const {RC,RF,DRIVABLE_MAX} = await import('../src/config.js');
  const area = new Box3();
  for (const s of sections) for (const [x,z] of s.outline) area.expandByPoint(new Vector3(x,0,z));
  const {cells}=indexRoutes(world,stops,area,RC,RF,DRIVABLE_MAX);
  const {Route,SECTIONS} = await import('../src/entities/transit.js');
  const {TATRA_SECTIONS} = await import('../src/entities/transit-models.js');
  const data = JSON.parse(await readFile('public/data/timetable.json','utf8'));
  const doors = [];
  for (const source of data.routes) {
    if (!source) continue;
    const route = new Route(source), tram = route.type === 'tram';
    const models = [SECTIONS[route.type]];
    if (tram && ['1','2'].includes(route.ref)) models.push(TATRA_SECTIONS);
    for (const [s] of route.stops) {
      const stop = route.posAt(s,tram ? 0 : 1.7,{});
      if (stop.x < area.min.x-40 || stop.x > area.max.x+40 || stop.z < area.min.z-40 || stop.z > area.max.z+40) continue;
      for (const sections of models) {
        let end=s;
        for (const section of sections) {
          const center=end-section.length/2, axle=section.axle ?? (tram ? 2.6 : 3.5);
          end-=section.length;
          const a=route.posAt(center+axle,tram?0:1.7,{}), b=route.posAt(center-axle,tram?0:1.7,{});
          const angle=Math.atan2(a.x-b.x,a.z-b.z), dx=Math.sin(angle), dz=Math.cos(angle);
          for (const offset of section.doors) {
            const x=(a.x+b.x)/2+dx*offset, z=(a.z+b.z)/2+dz*offset;
            const y=world.groundY(x,z);
            doors.push(corridor('dveře MHD',x-dz*1.15,z+dx*1.15,y,x-dz*3.6,z+dx*3.6,y,.85,2.1));
          }
        }
      }
    }
  }
  return function check(item) {
    const model=STREET_MODELS[item.kind];
    if(!model || ![item.x,item.z,item.yaw].every(Number.isFinite)) throw Error('Neplatný model '+item.id);
    const {x,z}=item, y=world.heightAt(x,z), r=Math.hypot(model.width,model.depth)*.5+.22;
    if (doors.some(door => blocksPassage(x,z,y,r,model.height,door))) return 'dveře MHD';
    for(let a=Math.floor((x-r)/32);a<=Math.floor((x+r)/32);a++) {
      for(let b=Math.floor((z-r)/32);b<=Math.floor((z+r)/32);b++) {
        for(const route of cells.get(a+','+b)??[]) {
          if(blocksPassage(x,z,y,r,model.height,route)) return route.kind;
        }
      }
    }
    return null;
  };
}
