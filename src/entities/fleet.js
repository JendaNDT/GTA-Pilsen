// Vlastní návrhy karoserií. Osy světel a plechy používají společný zakřivený povrch.
import { carPanel } from './car-panels.js';
import { SURFACE } from '../world/material-table.js';

const paint = [1, 1, 1], rubber = [0.022, 0.026, 0.031], silver = [0.43, 0.48, 0.52];
const head = [1, 0.96, 0.86], tail = [0.96, 0.025, 0.021], amber = [1, 0.36, 0.012];

const designs = {
  sedan:  { nose: 0.35, roof: 0.80, belt: 0.00, lens: 0.109, sweep: 0.024, grille: 0.32 },
  kombi:  { nose: 0.32, roof: 0.87, belt: 0.02, lens: 0.128, sweep: 0.041, grille: 0.28 },
  suv:    { nose: 0.39, roof: 0.88, belt: 0.10, lens: 0.149, sweep: 0.011, grille: 0.37 },
  van:    { nose: 0.25, roof: 0.94, belt: 0.23, lens: 0.167, sweep: 0.083, grille: 0.31 },
  sport:  { nose: 0.48, roof: 0.73, belt: -0.025, lens: 0.063, sweep: 0.078, grille: 0.40 },
  pickup: { nose: 0.32, roof: 0.89, belt: 0.13, lens: 0.169, sweep: 0.00, grille: 0.36 }
};

export const fleetDesign = type => designs[type.base ?? type.id];

// u je úhel na vodorovném oblouku od osy přídě (0) k blatníku (1).
function nosePoint(type, side, u, y, lift = 0) {
  const { nose } = fleetDesign(type);
  const angle = u * Math.PI / 2;
  return [side * (type.wid / 2 + lift) * Math.sin(angle), y,
    type.len / 2 - nose + (nose + lift) * Math.cos(angle)];
}

function strip(parts, point, left, right, low, high, outward, color, steps, surface) {
  for (let i = 0; i < steps; i++) {
    const a = left + (right - left) * i / steps, b = left + (right - left) * (i + 1) / steps;
    carPanel(parts, [point(a, low(a)), point(b, low(b)), point(b, high(b)), point(a, high(a))], outward, color, surface);
  }
}

function lampEdges(type, profile, u) {
  const { lens, sweep } = fleetDesign(type);
  const t = (u - 0.34) / 0.46;
  const top = profile.belt - 0.14 + sweep * t;
  return [top - lens * (1 - 0.46 * t), top];
}

export function fleetNose(body, detail, type, profile, panels) {
  const design = fleetDesign(type), { belt, ride, cab } = profile;
  const kind = type.base ?? type.id;
  const utility = ['suv', 'van', 'pickup'].includes(kind);
  const top = u => belt - 0.126 + 0.055 * u;
  const hoodStart = body.p.length / 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8, b = (i + 1) / 8;
      const hood = (u, t) => {
        const p = nosePoint(type, side, u, top(u));
        const rise = belt + 0.031 - 0.028 * u * u - p[1];
        return [p[0] * (1 - 0.035 * t), p[1] + t * rise + 0.014 * Math.sin(Math.PI * t),
          p[2] + (cab.front - p[2]) * t];
      };
      for (const [start, end] of [[0, 0.52], [0.52, 1]]) {
        carPanel(body, [hood(a,start), hood(b,start), hood(b,end), hood(a,end)], [0,1,0], paint);
      }
    }
  }
  panels.hood = { batch: 'body', start: hoodStart, count: body.p.length / 3 - hoodStart };
  for (const side of [-1, 1]) {
    const out = [side, 0, 1];
    const surface = (u, y) => nosePoint(type, side, u, y);
    strip(body, surface, 0, 1, () => ride, top, out, paint, 10);
    const inset = (u, y) => nosePoint(type, side, u, y, 0.008);
    const bottom = u => lampEdges(type, profile, u)[0];
    const upper = u => lampEdges(type, profile, u)[1];
    strip(detail, inset, 0.34, 0.8, bottom, upper, out, rubber, 6);
    const optics = (u, y) => nosePoint(type, side, u, y, 0.013);
    strip(detail, optics, 0.35, 0.78, u => bottom(u)+0.012, u => upper(u)-0.012, out, silver, 6, SURFACE.glass);
    const grilleTop = belt - 0.155, grilleBottom = Math.max(ride + 0.20, grilleTop - design.lens * 1.4);
    strip(detail, inset, 0, design.grille, () => grilleBottom, u => grilleTop - 0.019 * u, out, rubber, 5);
    if (kind === 'pickup') {
      for (const u of [0.05, 0.14, 0.23, 0.32]) {
        strip(detail, (a,y) => nosePoint(type,side,a,y,0.019), u, u+.016, () => grilleBottom, () => grilleTop-.012, out, silver, 1);
      }
    }
    const bars = type.id === 'sport' ? 1 : 2;
    for (let i = 1; i <= bars; i++) {
      const y = grilleBottom + (grilleTop - grilleBottom) * i / (bars + 1);
      strip(detail, optics, 0, design.grille - 0.012, () => y, () => y+0.011, out, silver, 4);
    }
    const fogY = ride + (utility ? 0.23 : 0.15);
    const flankTop = u => fogY + (kind === 'sport' ? 0.17*(u-.48) : 0.018);
    strip(detail, inset, 0.48, 0.74, u => fogY - 0.04 + 0.044*(u-.48), flankTop, out, rubber, 4);
    if (kind !== 'sport') strip(detail, optics, 0.552, 0.64, () => fogY-.017, () => fogY+.004, out, silver, 2);
    if (utility) {
      strip(detail, optics, 0, .70, () => ride+.008, u => ride+.033+.015*u, out,
        kind === 'van' ? rubber : silver, 7);
    }
    strip(detail, inset, 0, type.id === 'sport' ? 0.63 : 0.43,
      () => ride + 0.037, u => ride + 0.103 + 0.023*u, out, rubber, 6);
  }
}

function rearLens(type, profile, side, u, t, lift) {
  const kind = type.base ?? type.id;
  const tall = ['kombi','van','pickup','suv'].includes(kind);
  const bottom = profile.belt - (tall ? 0.29 : 0.16);
  const x = type.wid * (tall ? 0.372 + 0.081*u : 0.237 + 0.207*u);
  return [side*x, bottom + (tall ? 0.22 : 0.062)*t + 0.029*u,
    -type.len/2 - lift - 0.004 + 0.006*u];
}

export function fleetLightGroup(parts, type, profile, group, side) {
  const out = [side, 0, group === 'head' || group === 'frontIndicator' ? 1 : -1];
  const kind = type.base ?? type.id;
  if (group === 'head' && ['van', 'pickup', 'suv'].includes(kind)) {
    for (const u of [0.415, 0.576]) {
      const [bottom, top] = lampEdges(type, profile, u), y = (bottom + top)/2;
      for (let i = 0; i < 6; i++) {
        const rim = k => nosePoint(type, side, u + .048*Math.cos(k*Math.PI/3),
          y + (top-bottom)*.24*Math.sin(k*Math.PI/3), .026);
        carPanel(parts, [nosePoint(type,side,u,y,.029), rim(i), rim(i+1)], out, head, SURFACE.lamp);
      }
    }
  } else if (group === 'head' || group === 'frontIndicator') {
    const indicator = group === 'frontIndicator';
    const point = (u, t) => {
      const [bottom, top] = lampEdges(type, profile, u);
      return nosePoint(type, side, u, bottom + (top-bottom)*t, 0.024);
    };
    strip(parts, point, indicator ? 0.70 : 0.369, indicator ? 0.773 : 0.667,
      () => indicator ? 0.2 : 0.36, () => indicator ? 0.76 : 0.63, out, indicator ? amber : head, 6, SURFACE.lamp);
  } else {
    const reverse = group === 'reverse', indicator = group === 'rearIndicator';
    const point = (u,t) => rearLens(type, profile, side, u, t, reverse || indicator ? 0.016 : 0.012);
    strip(parts, point, reverse ? 0.03 : indicator ? 0.67 : 0, reverse ? 0.34 : 1,
      () => reverse || indicator ? 0.14 : 0, () => reverse || indicator ? 0.41 : 1,
      out, reverse ? paint : indicator ? amber : tail, 6, SURFACE.lamp);
  }
}

export function fleetDoors(body, detail, type, profile, pillar, panels) {
  const kind = type.base ?? type.id, hw = type.wid / 2;
  const { ride, belt, cab, wheelZ, wheelR } = profile;
  const frontDoorOnly = ['sport', 'pickup', 'van'].includes(kind);
  const rear = frontDoorOnly ? Math.max(cab.rear + 0.09, cab.front - (kind === 'sport' ? 1.58 : 1.26)) : pillar;
  for (const side of [-1, 1]) {
    for (const front of (frontDoorOnly ? [true] : [true, false])) {
      const start = body.p.length / 3;
      const rows = [[ride + 0.065, 0.003, 0], [belt - 0.265, 0.019, 0.25], [belt - 0.12, 0.023, 0.77], [belt - 0.012, 0.007, 1]];
      let prev;
      for (const [y, depth, t] of rows) {
        const lead = front ? Math.min(wheelZ-wheelR-0.08, cab.front-0.21) + 0.105*t : rear-0.011;
        const end = front ? rear+0.005 : -wheelZ + wheelR + 0.09 - 0.48*t*t;
        const x = side * (hw+depth);
        const row = [[x,y,lead], [x,y,end]];
        if (prev) {
          carPanel(body, [prev[0], prev[1], row[1], row[0]], [side,0,0], paint);
          for (const j of (front ? [0,1] : [1])) {
            const p = prev[j], q = row[j], dx = side*0.005;
            carPanel(detail, [[p[0]+dx,p[1],p[2]-.005],[p[0]+dx,p[1],p[2]+.005],
              [q[0]+dx,q[1],q[2]+.005],[q[0]+dx,q[1],q[2]-.005]], [side,0,0], rubber);
          }
        }
        prev = row;
      }
      const handle = prev[1][2] + 0.15;
      detail.box(.025,.037,.157,side*(hw+.024),belt-.105,handle,rubber,.8,.84);
      body.box(.035,.025,.136,side*(hw+.037),belt-.096,handle,paint,.72,.86);
      if (front) panels[side > 0 ? 'rightDoor' : 'leftDoor'] = { batch:'body', start, count:body.p.length/3-start };
    }
  }
}

export function fleetBumper(parts, type, profile) {
  for (const side of [-1, 1]) {
    const point = (u, y) => nosePoint(type, side, u, y, 0.007);
    strip(parts, point, 0, 0.98, () => profile.ride + 0.009, u => profile.ride + 0.035 + 0.043*u*u,
      [side,0,1], rubber, 7);
  }
}

function fleetLivery(detail, type, side, belt, hw) {
  const out = [side,0,0];
  const point = (z,y) => [side*(hw+.032), y, z];
  if (type.police) {
    for (const [bottom, height, color] of [[-.23,.125,[.017,.102,.45]],[-.10,.041,[.79,.75,.029]]]) {
      const y = belt + bottom;
      carPanel(detail, [point(-1.52,y),point(1.20,y),point(1.41,y+height),point(-1.41,y+height)],out,color);
    }
  } else if (type.sign) {
    for (let i=0; i<18; i++) {
      const z = -1.0 + i*.105, y = belt-.21 + i%2*.046;
      carPanel(detail,[point(z,y),point(z+.105,y),point(z+.105,y+.046),point(z,y+.046)],out,rubber);
    }
  }
}

export function fleetEquipment(body, detail, type, profile, halfCab) {
  const kind = type.base ?? type.id, { cab, belt, ride, wheelZ, wheelR } = profile;
  const rear = -type.len / 2, hw = type.wid / 2;
  for (const side of [-1, 1]) {
    fleetLivery(detail, type, side, belt, hw);
    const rearX = side * hw;
    detail.box(.13,.041,.022,rearX*.76,ride+.123,rear-.031,[.44,.014,.015]);
    detail.box(.12,.042,.115,side*(hw-.01),belt+.125,cab.front-.28,rubber);
    detail.box(.145,.073,.144,side*(hw+.059),belt+.151,cab.front-.31,rubber,.84,.80);
    body.box(.154,.082,.156,side*(hw+.059),belt+.162,cab.front-.29,paint,.79,.78);

    if (kind === 'kombi' || kind === 'suv') {
      const near = cab.roofFront-.12, far = cab.roofRear+.17, x = side*type.wid*.32;
      for (const z of [near,far]) detail.box(.075,.086,.15,x,type.h+.008,z,rubber,.76,.78);
      detail.box(.066,.045,near-far+.08,x,type.h+.058,(near+far)/2,kind === 'suv' ? silver : rubber,.75,.98);
    }
    if (kind === 'suv' || kind === 'pickup') {
      const sill = wheelZ - wheelR - .11;
      detail.box(.095,.075,2*sill,side*(hw+.012),ride+.043,0,rubber,.88,.97);
      for (const z of [wheelZ,-wheelZ]) {
        const edge = (i,r) => [side*(hw+.009),wheelR + r*Math.sin(i*Math.PI/8),z+r*Math.cos(i*Math.PI/8)];
        for (let i=0;i<8;i++) carPanel(detail,[edge(i,wheelR+.065),edge(i+1,wheelR+.065),
          edge(i+1,wheelR+.119),edge(i,wheelR+.119)],[side,0,0],rubber);
      }
    }
    if (kind === 'van') {
      // Lisovaný obdélník nákladového prostoru a vodicí lišta posuvných dveří.
      const sideFace = (z,y) => [side*(halfCab(y)+.009),y,z];
      const a = cab.front-1.41, b = rear+.29;
      const outline = [[a-.07,belt+.19],[b+.10,belt+.19],[b,belt+.27],
        [b,type.h-.29],[b+.08,type.h-.21],[a-.09,type.h-.21],[a,type.h-.29],[a,belt+.27]];
      const centerZ=(a+b)/2, centerY=(belt+type.h)/2;
      for (let i=0;i<outline.length;i++) {
        const p=outline[i], q=outline[(i+1)%outline.length];
        const inner = pair => sideFace(centerZ+(pair[0]-centerZ)*.989,centerY+(pair[1]-centerY)*.964);
        carPanel(detail,[sideFace(...p),sideFace(...q),inner(q),inner(p)],[side,.1,0],silver);
      }
      if (side === 1) {
        detail.box(.027,.042,1.40,side*(hw+.012),belt-.11,rear+1.06,rubber);
        detail.box(.038,.056,.16,side*(hw+.019),belt-.16,a-.13,rubber);
      }
    }
    if (kind === 'sport') {
      const x = side*(hw+.011);
      carPanel(detail, [[x,ride+.12,-wheelZ+.49],[x,belt-.12,-wheelZ+.64],[x,belt-.15,-wheelZ+.32]],
        [side,0,0],rubber);
    }
  }
  if (kind === 'pickup') {
    const length = cab.rear - rear;
    const floor = belt - 0.27;
    detail.box(type.wid-.14,.022,length-.14,0,floor+.014,rear+length/2,rubber);
    for (const side of [-1,1]) {
      body.box(.10,belt-floor,length,side*(hw-.05),(floor+belt)/2,rear+length/2,paint);
      detail.box(.115,.024,length,side*(hw-.05),belt+.008,rear+length/2,rubber);
    }
    body.box(type.wid-.16,belt-floor,.09,0,(floor+belt)/2,rear+.046,paint);
    detail.box(.25,.045,.025,0,belt-.092,rear-.012,rubber);
    for (let i=-3;i<=3;i++) detail.box(.038,.014,length-.22,i*.20,floor+.033,rear+length/2,silver);
  } else if (kind === 'van') {
    const atBack = y => cab.rear + (cab.roofRear-cab.rear)*(y-belt)/(type.h-.035-belt)-.009;
    const a=belt+.018, b=type.h-.109;
    carPanel(detail,[[-.009,a,atBack(a)],[.009,a,atBack(a)],[.009,b,atBack(b)],[-.009,b,atBack(b)]],[0,0,-1],rubber);
    detail.box(.16,.045,.038,.11,belt+.10,atBack(belt+.1),rubber);
    detail.box(.013,belt-ride-.09,.018,0,(belt+ride+.09)/2,rear-.013,rubber);
    for (const side of [-1,1]) for (const y of [belt+.18, type.h-.35]) {
      detail.box(.101,.043,.032,side*(hw-.185),y,atBack(y),silver);
    }
  } else if (kind === 'sport') {
    for (const side of [-1,1]) detail.box(.07,.116,.13,side*.53,belt+.078,rear+.30,rubber);
    body.box(type.wid*.84,.054,.21,0,belt+.146,rear+.30,paint,.92,.76);
  } else if (kind === 'sedan') {
    detail.box(type.wid*.69,.024,.025,0,belt-.105,rear-.013,silver);
  }
}
