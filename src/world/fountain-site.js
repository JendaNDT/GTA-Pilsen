import { Ray, Triangle, Vector3 } from 'three/webgpu';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { fountains, fountainBowl, fountainSculpture } from './fountain-shapes.js';

// Stejná síť pro pevná tělesa v Joltu, výšku povrchu, pěší kolizi a kameru.
export function createFountainSites(world) {
  const tiles=new Map();
  for (const spec of fountains) {
    const tile=world.chunkIndex(spec.x,spec.z);
    if (tile<0) continue;
    const site={...spec,cos:Math.cos(spec.angle),sin:Math.sin(spec.angle),
      ground:world.heightAt(spec.x,spec.z)+.045,tree:new Octree(),solid:[]};
    const insert=(points,finish)=>{
      if (finish==='pool') return;
      for (let i=1;i+1<points.length;i++) {
        const p=[points[0],points[i],points[i+1]];
        site.solid.push(...p.flat());
        site.tree.addTriangle(new Triangle(...p.map(a=>new Vector3(...a))));
      }
    };
    fountainSculpture(site,false,insert);
    for (const bowl of site.bowls) fountainBowl(site,bowl,16,insert);
    site.tree.build();
    if (!tiles.has(tile)) tiles.set(tile,[]);
    tiles.get(tile).push(site);
  }
  return tiles;
}

const ray=new Ray(), capsule=new Capsule();
export function fountainSurface(sites,x,z,maxY) {
  let h=-Infinity;
  for (const site of sites) {
    const b=site.tree.bounds;
    if (x<b.min.x || x>b.max.x || z<b.min.z || z>b.max.z || maxY<b.min.y) continue;
    ray.origin.set(x,Math.min(maxY,b.max.y+.01),z);
    ray.direction.set(0,-1,0);
    const hit=site.tree.rayIntersect(ray);
    if (hit) h=Math.max(h,hit.position.y);
  }
  return h;
}

export function fountainContact(sites,hit,r,low,high) {
  let moved=false;
  for (const site of sites) {
    const b=site.tree.bounds;
    if (hit.x+r<b.min.x || hit.x-r>b.max.x || hit.z+r<b.min.z || hit.z-r>b.max.z || low>=b.max.y || high<b.min.y) continue;
    capsule.start.set(hit.x,Math.min((low+high)/2,low+r),hit.z);
    capsule.end.set(hit.x,Math.max((low+high)/2,high-r),hit.z);
    capsule.radius=r;
    const contact=site.tree.capsuleIntersect(capsule);
    if (!contact) continue;
    const {normal,depth}=contact, horizontal=Math.hypot(normal.x,normal.z);
    if (horizontal<.001) continue;
    hit.x+=normal.x*depth; hit.z+=normal.z*depth;
    hit.depth=Math.max(hit.depth,depth*horizontal);
    hit.nx=normal.x/horizontal; hit.nz=normal.z/horizontal;
    moved=true;
  }
  return moved;
}

export function fountainRay(sites,x0,z0,x1,z1,y) {
  const length=Math.hypot(x1-x0,z1-z0);
  if (!length) return 1;
  let t=1;
  ray.origin.set(x0,y,z0); ray.direction.set((x1-x0)/length,0,(z1-z0)/length);
  for (const site of sites) {
    const b=site.tree.bounds;
    if (y>b.max.y || y<b.min.y || !ray.intersectsBox(b)) continue;
    const hit=site.tree.rayIntersect(ray);
    if (hit) t=Math.min(t,hit.distance/length);
  }
  return t;
}
