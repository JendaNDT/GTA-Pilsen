// Vlastní plechy a optika Fabie II. Rozměry jsou v lokálních metrech vozu.
import { carPanel as face } from './car-panels.js';
import { SURFACE } from '../world/material-table.js';

const paint = [1, 1, 1], gasket = [0.023, 0.026, 0.028], chrome = [0.47, 0.50, 0.52];
const reflector = [0.23, 0.26, 0.28], bulb = [1, 0.97, 0.89];

// Všechny díly přídě sledují tutéž křivku od masky až k přednímu blatníku.
function nose(side, u, y, offset = 0) {
  const angle = Math.PI / 2 * u;
  const lower = Math.max(0, 0.46 - y) * 0.19;
  return [side * (0.85 - lower + offset) * Math.sin(angle), y,
    1.53 + (0.42 - lower + offset) * Math.cos(angle)];
}

function joinHeight(u) {
  return .871 - .057 * Math.max(0, (u-.74)/.26);
}

function crown(u) {
  return .795 + .074*u*u - .055*Math.max(0,(u-.74)/.26);
}

export function fabiaHood(body, panels) {
  const start = body.p.length / 3;
  for (const side of [-1, 1]) {
    const point = (u, t) => {
      const [x, y, z] = nose(side, u, crown(u));
      const back = .954 - .006*u;
      return [x, y + (back-y)*t + .009 + Math.sin(t*Math.PI)*(.021-.012*u), z + (1.035-z)*t];
    };
    for (const [a,b] of [[0,.22],[.22,.33],[.33,.46],[.46,.59]]) {
      for (const [t,v] of [[0,.45],[.45,1]]) {
        face(body, [point(a,t), point(b,t), point(b,v), point(a,v)], [0,1,0], paint);
      }
    }
  }
  panels.hood = {batch:'body', start, count:body.p.length/3-start};
}

export function fabiaFrontLip(det) {
  for (const side of [-1,1]) {
    noseBand(det, side, [[0,.318],[.61,.333],[.623,.349],[0,.334]], .007, gasket);
  }
}

export function fabiaNose(body, det) {
  for (const side of [-1, 1]) {
    const outward = [side, 0, 1];
    for (let i = 0; i < 10; i++) {
      const u = i / 10, v = (i + 1) / 10;
      for (const [bottom, top] of [[0.301, 0.46], [0.46, null]]) {
        face(body, [nose(side, u, bottom), nose(side, v, bottom),
          nose(side, v, top ?? crown(v)), nose(side, u, top ?? crown(u))], outward, paint);
      }
      // Kapota se zvedá od chromované masky k navazujícímu příčnému řezu.
      const a = nose(side, u, crown(u)), b = nose(side, v, crown(v));
      const backA = [a[0], joinHeight(u), 1.525], backB = [b[0], joinHeight(v), 1.525];
      face(body, [a, b, backB, backA], [0, 1, 0], paint);
    }
    // Černé sání s tenkým lemem a mlhovka zasazená do lakovaného nárazníku.
    noseBand(det, side, [[0, .657], [.255, .663], [.288, .792], [0, .795]], .006, chrome, SURFACE.metal);
    noseBand(det, side, [[0, .67], [.247, .677], [.272, .783], [0, .785]], .009, gasket);
    for (const u of [.038, .088, .139, .191, .239]) {
      nosePatch(det, side, [[u, .678], [u + .005, .678], [u + .014, .774], [u + .008, .774]], .013, reflector);
    }
    noseBand(det, side, [[0,.344],[.375,.35],[.397,.423],[0,.42]], .005, gasket);
    noseBand(det, side, [[.43,.409],[.64,.429],[.67,.485],[.45,.482]], .006, gasket);
    oval(det, side, .568, .451, .033, .019, .011, chrome);
  }
}

function nosePatch(parts, side, points, offset, color, surface) {
  face(parts, points.map(([u,y]) => nose(side, u, y, offset)), [side, 0, 1], color, surface);
}

// Široký pás se dělí podél nárazníku, aby tětiva neprošla lakovaným plechem.
function noseBand(parts, side, [a,b,c,d], offset, color, surface) {
  const mix = (p, q, t) => p.map((v, i) => v + (q[i]-v)*t);
  for (let i = 0; i < 6; i++) {
    nosePatch(parts, side, [mix(a,b,i/6), mix(a,b,(i+1)/6), mix(d,c,(i+1)/6), mix(d,c,i/6)], offset, color, surface);
  }
}

function oval(parts, side, u, y, ru, ry, offset, color, steps = 10) {
  const points = Array.from({ length: steps }, (_, i) => {
    const angle = i * 2 * Math.PI / steps;
    return [u + ru * Math.cos(angle), y + ry * Math.sin(angle)];
  });
  nosePatch(parts, side, points, offset, color, SURFACE.metal);
}

// Pásy kopírují zakřivení blatníku. Spodní stříbrná plocha a tmavší horní lem
// dávají i při zhasnutých světlech čitelnou hloubku pod krytem.
export function fabiaLampHousings(det) {
  const sections = [[.298,.652,.712], [.32,.649,.75], [.393,.655,.786], [.51,.666,.81],
    [.63,.691,.823], [.731,.735,.826], [.781,.794,.819]];
  for (const side of [-1, 1]) {
    for (let i = 1; i < sections.length; i++) {
      const [u, low, high] = sections[i - 1], [v, low2, high2] = sections[i];
      const strip = (a, b, color, offset) => nosePatch(det, side, [
        [u, low + (high-low)*a], [v, low2 + (high2-low2)*a],
        [v, low2 + (high2-low2)*b], [u, low + (high-low)*b]], offset, color, SURFACE.glass);
      strip(0, .09, gasket, .009);
      strip(.09, .25, chrome, .01);
      strip(.25, .86, reflector, .011);
      strip(.86, .94, chrome, .011);
      strip(.94, 1, gasket, .011);
    }
    for (const [u, y, ru, ry] of [[.383,.714,.054,.040], [.516,.744,.077,.054]]) {
      // Šikmé plošky paraboly zachytí světlo odlišně podél horní a spodní hrany.
      const edge = (i, scale) => {
        const angle = i*Math.PI/6;
        return [u + ru*scale*Math.cos(angle), y + ry*scale*Math.sin(angle)];
      };
      for (let i = 0; i < 12; i++) {
        const shade = .44 - .225*Math.sin((i+.5)*Math.PI/6);
        nosePatch(det, side, [edge(i,1), edge(i+1,1), edge(i+1,.34), edge(i,.34)],
          .021, [shade*.95,shade,shade*1.02], SURFACE.metal);
      }
    }
    nosePatch(det, side, [[.65,.742],[.713,.769],[.736,.8],[.676,.789]], .018, [.56,.29,.075], SURFACE.lamp);
  }
}

export function fabiaIndicator(parts, side) {
  const rim = i => [.695 + .033*Math.cos(i*Math.PI/6), .778 + .016*Math.sin(i*Math.PI/6)];
  for (let i = 0; i < 12; i++) {
    nosePatch(parts, side, [[.695,.778], rim(i), rim(i+1)], .027, [1,.38,.01], SURFACE.lamp);
  }
}

export function fabiaBulbs(det) {
  for (const side of [-1, 1]) {
    for (const [u, y] of [[.383,.714],[.516,.744]]) {
      // Šest výsečí na žárovku patří k rozsvěcené části paraboly.
      for (let i = 0; i < 6; i++) {
        const rim = j => [u + .014 * Math.cos(j * Math.PI / 3), y + .012 * Math.sin(j * Math.PI / 3)];
        nosePatch(det, side, [[u,y], rim(i), rim(i+1)], .032, bulb, SURFACE.lamp);
      }
    }
  }
}

function doorHandle(body, det, side, x, y, z) {
  const outline = [[-.081,0],[-.063,-.018],[.039,-.021],[.072,-.009],[.071,.011],[.048,.02],[-.061,.02]];
  const outside = p => [side*(x+.006),y+p[1],z+p[0]];
  face(det, outline.map(outside), [side,0,0], gasket);
  const grip = [[-.065,.002],[-.048,-.006],[.048,-.007],[.065,0],[.048,.014],[-.048,.014]];
  const back = grip.map(([dz,dy]) => [side*(x+.014), y+dy,z+dz]);
  const top = grip.map(([dz,dy]) => [side*(x+.029), y+dy*.73+.003,z+dz*.90]);
  face(body, top, [side,0,0], paint);
  for (let i=0; i<top.length; i++) {
    const j=(i+1)%top.length;
    face(body,[back[i],back[j],top[j],top[i]],[side,0,0],paint);
  }
}

function wheelLiner(det, side, x, z, radius) {
  const lining = [0.027, 0.029, 0.03];
  const inner = side * (x - 0.29);
  const archPoint = (i, width) => {
    const angle = i * Math.PI / 7;
    return [width, radius + (radius + 0.066) * Math.sin(angle), z + (radius + 0.066) * Math.cos(angle)];
  };
  for (let i = 0; i < 7; i++) {
    const a = archPoint(i, inner), b = archPoint(i + 1, inner);
    face(det, [[inner,radius-.018,z],a,b], [side,0,0], lining);
    face(det, [a,b,archPoint(i+1,side*(x-.024)),archPoint(i,side*(x-.024))], [0,-1,0], lining);
  }
}

export function fabiaDoors(body, det, panels, halfWidth, pillar, chassis) {
  // Řezy zespoda nahoru: prolis plechu, přední spára a výřez kolem zadního kola.
  const rows = [
    [.354,.001,.694, pillar+.025,-.703], [.39,.008,.725,pillar+.019,-.714],
    [.51,.015,.747,pillar+.009,-.758], [.666,.024,.762,pillar,-.886],
    [.747,.027,.79,pillar-.003,-1.09], [.831,.017,.844,pillar-.006,-1.36],
    [.907,.005,.875,pillar-.008,-1.422],
  ];
  for (const side of [-1, 1]) {
    for (const z of [-chassis.wheelZ, chassis.wheelZ]) wheelLiner(det, side, halfWidth, z, chassis.wheelR);
    for (const front of [true, false]) {
      const start = body.p.length / 3;
      const edges = rows.map(([y, depth, lead, split, tail]) => {
        const point = z => [side * (halfWidth + depth + .003), y, z];
        return [point(front ? lead : split-.004), point(front ? split+.004 : tail)];
      });
      for (let i = 1; i < edges.length; i++) {
        const [a,b] = edges[i-1], [c,d] = edges[i];
        const normal = row => {
          const low = rows[Math.max(0,row-1)], high = rows[Math.min(rows.length-1,row+1)];
          const slope = (high[1]-low[1])/(high[0]-low[0]), length = Math.hypot(1,slope);
          return [side/length, -slope/length, 0];
        };
        const points = side > 0 ? [a,b,d,a,d,c] : [a,d,b,a,c,d];
        for (const point of points) {
          const n = normal(point === a || point === b ? i-1 : i);
          body.vertex(...point, ...n, paint);
        }
        // Jemná hrana spáry kopíruje plech včetně oblouku podběhu.
        for (const [p,q] of (front ? [[a,c],[b,d]] : [[b,d]])) {
          const dx = side*.006;
          face(det, [[p[0]+dx,p[1],p[2]-.005],[p[0]+dx,p[1],p[2]+.005],
            [q[0]+dx,q[1],q[2]+.005],[q[0]+dx,q[1],q[2]-.005]], [side,0,0], gasket);
        }
      }
      // Spodní spára se zvedá k podběhům. Nahoře spoj přechází přes rameno
      // blatníku až k pryžovému těsnění bočních oken.
      const [footA, footB] = edges[0], [topA, topB] = edges.at(-1);
      const sill = [footA, [footA[0],.348,footA[2]-.07],
        [footB[0],.348,footB[2]+.07], footB];
      for (let i = 1; i < sill.length; i++) {
        const a = sill[i-1], b = sill[i];
        face(det, [a,b,[b[0],b[1]+.007,b[2]],[a[0],a[1]+.007,a[2]]],
          [side,0,0], [.10,.095,.085]);
      }
      for (const top of front ? [topA,topB] : [topB]) {
        const endZ = top[2] + (top === topA ? .004 : front ? .001 : -.058);
        face(det, [[top[0],top[1],top[2]-.005],[top[0],top[1],top[2]+.005],
          [side*.802,.985,endZ+.005],[side*.802,.985,endZ-.005]], [side,1,0], gasket);
      }
      const handleZ = front ? pillar + .139 : -1.20;
      doorHandle(body, det, side, halfWidth+.024, .839, handleZ);
      if (front) panels[side > 0 ? 'rightDoor' : 'leftDoor'] = {batch:'body', start, count:body.p.length/3-start};
    }
  }
}
