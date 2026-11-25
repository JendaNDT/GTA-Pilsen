import { RC, RF } from '../config.js';
import { parkWalks } from '../entities/pedestrian-walks.js';
import { cameraRailFraction } from './camera-railings.js';
import { sidewalkSections } from './sidewalks.js';
import { WalkingNetwork } from './walking-network.js';

export function canJoin(w, a, b) {
  if (cameraRailFraction(w,a.x,a.y+.55,a.z,b.x,b.y+.55,b.z) < 1) return false;
  if (cameraRailFraction(w,a.x,a.y+.55,a.z,b.x,b.y+.55,b.z,w.streetFixtures) < 1) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)));
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, x = a.x+(b.x-a.x)*t, z = a.z+(b.z-a.z)*t, y = a.y+(b.y-a.y)*t;
    if (w.isWater(x,z) && w.deckAt(x,z,y+.8) < y-1 && !onParkBridge(w,x,z)) return false;
    if (Math.abs(w.groundY(x,z,y)-y) > 1.8 || w.collideCircle(x,z,.25,y+.2,y+1.6,true)) return false;
  }
  return true;
}

function onParkBridge(w,x,z) {
  const bridge = w.sady?.solids.find(s => s.id === 'lavka');
  if (!bridge) return false;
  const dx = x-bridge.x, dz = z-bridge.z, c = Math.cos(bridge.angle), s = Math.sin(bridge.angle);
  return Math.abs(c*dx+s*dz) <= bridge.length/2 && Math.abs(c*dz-s*dx) <= bridge.width/2;
}

export class WalkingMap {
  constructor(w, a, b) {
    this.world = w;
    this.network = new WalkingNetwork((p,q) => canJoin(w,p,q));
    const margin = 400;
    this.bounds = [Math.min(a.x,b.x)-margin,Math.min(a.z,b.z)-margin,
      Math.max(a.x,b.x)+margin,Math.max(a.z,b.z)+margin];
    this.build = this.buildNetwork();
  }

  contains(p) {
    const [x,z,bx,bz] = this.bounds;
    return p.x >= x && p.x <= bx && p.z >= z && p.z <= bz;
  }

  *buildNetwork() {
    const w = this.world, net = this.network, joins = new Set();
    const point = ([x,z]) => net.vertex(x,z,w.groundY(x,z));
    const addPath = path => {
      let prev;
      for (const coords of path) {
        const node = point(coords);
        if (prev) net.segment(prev,node);
        prev = node;
      }
    };
    for (const path of parkWalks) if (path.some(([x,z]) => this.contains({x,z}))) addPath(path);
    for (const walk of Object.values(w.meta.walkingApproaches ?? {})) {
      const pts = [];
      for (let i=0; i<walk.length; i+=2) pts.push([walk[i],walk[i+1]]);
      if (pts.some(([x,z]) => this.contains({x,z}))) addPath(pts);
    }
    for (const {a,b,x,z} of w.traffic.crossings) if (this.contains({x,z})) {
      const left = point(a), right = point(b);
      net.segment(left,right);
      joins.add(left); joins.add(right);
    }
    const [x,z,bx,bz] = this.bounds;
    const first = w.cellIndex(x,z), last = w.cellIndex(bx,bz), done = new Set();
    for (let row = Math.floor(first/w.gcols); row <= Math.floor(last/w.gcols); row++) {
      for (let col = first%w.gcols; col <= last%w.gcols; col++) {
        const cell = row*w.gcols+col;
        yield;
        for (let j=w.segCellStart[cell]; j<w.segCellStart[cell+1]; j++) {
          const k = w.segCellItems[j];
          if (done.has(k)) continue;
          done.add(k);
          const road = w.roadOfPt[k], cls = w.r.cls[road], flags = w.r.flags[road];
          if (flags & RF.PRIVATE || cls === RC.CYCLEWAY) continue;
          if (cls >= RC.LIVING) {
            const roadPoint = i => net.vertex(w.rpx[i],w.rpz[i],w.roadSurfaceY(road,k,i-k,w.rpx[i],w.rpz[i]));
            net.segment(roadPoint(k),roadPoint(k+1));
          } else if (w.walkingWidths?.[road]) {
            yield;
            for (const side of sidewalkSections(w,road,k,k+1,w.walkingWidths)) {
              let prev;
              for (const s of side) {
                if (!s.valid) { prev = null; continue; }
                const n = net.vertex(s.cx+s.ox*s.width/2,s.cz+s.oz*s.width/2,s.profile.curb);
                if (prev) net.segment(prev,n);
                else joins.add(n);
                prev = n;
              }
              if (prev) joins.add(prev);
            }
          }
        }
      }
    }
    for (const n of joins) {
      yield;
      for (const other of net.nearby(n,3.5)) {
        if (!n.neighbours.has(other) && net.clear(n,other)) net.connect(n,other);
      }
    }
    this.build = null;
  }

  *directions(from,to) {
    if (this.build) yield* this.build;
    return yield* this.network.route(from,to);
  }
}
