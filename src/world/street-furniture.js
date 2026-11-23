// Rozměry vlastních herních modelů v metrech. Impulsy slouží jen pro herní mechaniku.
export const STREET_MODELS = {
  bench: {width:1.65, depth:.60, height:.86, impulse:3000},
  bin: {width:.48, depth:.48, height:.88, impulse:800},
  rack: {width:.82, depth:.20, height:.84, impulse:3200},
  post: {width:.15, depth:.15, height:.80, impulse:3800},
  platformGuide: {width:2.36, depth:.12, height:2.75, impulse:3800},
  platformSign: {width:.68, depth:.12, height:2.75, impulse:3800},
  shelter: {width:3.0, depth:1.05, height:2.35, impulse:Infinity},
};

export function streetCorners(x, y, z, yaw, width, depth) {
  const dx = Math.cos(yaw), dz = Math.sin(yaw);
  return [[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b]) => [
    x + dx*a*width/2 - dz*b*depth/2, y, z + dz*a*width/2 + dx*b*depth/2,
  ]);
}

export function streetFixtures(item, world) {
  const model = STREET_MODELS[item.kind];
  if (!model) return [];
  const {x,z,yaw} = item, y = world.heightAt(x,z), tile = world.chunkIndex(x,z);
  const part = (piece, across, along, width, depth, bottom, height, impulse) => {
    const px = x + across*Math.cos(yaw) - along*Math.sin(yaw);
    const pz = z + across*Math.sin(yaw) + along*Math.cos(yaw);
    return {id:'street/'+tile+'/'+item.id+'/'+piece, kind:item.kind, piece, tile, yaw,
      x:px,y:y+bottom,z:pz,width,depth,height,impulse, corners:streetCorners(px,y+bottom,pz,yaw,width,depth)};
  };
  if (item.kind === 'platformSign' || item.kind === 'platformGuide') {
    const sign = part('oznacnik', 0, 0, model.width, model.depth, 0, model.height, model.impulse);
    if (item.kind === 'platformGuide') {
      sign.left = item.left;
      sign.right = item.right;
    } else sign.number = item.number;
    return [sign];
  }
  if (item.kind !== 'shelter') return [part(item.kind,0,0,model.width,model.depth,0,model.height,model.impulse)];
  return [part('stojka-l',-1.43,.45,.10,.10,0,2.30,Infinity),
    part('stojka-p',1.43,.45,.10,.10,0,2.30,Infinity),
    part('strecha',0,0,3,1.05,2.30,.05,Infinity),
    part('sklo',0,.45,2.73,.05,.24,1.98,600)];
}

// Číslice jsou součástí společné sítě mobiliáře, včetně uvolněného označníku po nárazu.
const platformDigits = {
  1: [[0, 0, .08, .43], [-.05, .17, .10, .07]],
  2: [[0,.18,.29,.07], [.11,.09,.07,.18], [0,0,.29,.07], [-.11,-.09,.07,.18], [0,-.18,.29,.07]],
  3: [[0,.18,.29,.07], [.11,0,.07,.39], [0,0,.26,.07], [0,-.18,.29,.07]],
  4: [[-.11,.10,.07,.22], [0,0,.29,.07], [.11,0,.07,.43]],
};

function drawPlatformNumber(solid, f) {
  const dx = Math.cos(f.yaw), dz = Math.sin(f.yaw);
  for (const side of [-1, 1]) {
    const point = (u, v, depth = .065) => [f.x + side * (dx * u - dz * depth),
      f.y + 2.37 + v, f.z + side * (dz * u + dx * depth)];
    const ink = [.98,.98,.95];
    const digit = (number, offset, color) => {
      for (const [u, v, width, height] of platformDigits[number]) {
        const left = offset + u - width / 2, right = left + width;
        const bottom = v - height / 2, top = bottom + height;
        solid.quad(point(left,bottom), point(right,bottom), point(right,top), point(left,top), color);
      }
    };
    if (f.kind === 'platformSign') {
      digit(f.number, 0, ink);
      continue;
    }
    // Při pohledu zezadu se vymění cíle šipek, čísla zůstanou čitelná.
    const groups = side === 1 ? [f.left, f.right] : [f.right, f.left];
    for (const [i, direction] of [-1, 1].entries()) {
      for (const [j, number] of groups[i].entries()) {
        const center = direction * .52 + (j - .5) * .44;
        const tile = (u, v) => point(center + u, v, .062);
        solid.quad(tile(-.19,-.245), tile(.19,-.245), tile(.19,.245), tile(-.19,.245), ink);
        digit(number, center, [.018,.055,.14]);
      }
      const tip = direction * 1.14, tail = direction * .98;
      solid.quad(point(tail,-.13), point(tip,0), point(tail,.13), point(tail,.13), ink);
    }
  }
}

const wood=[.39,.205,.084], metal=[.17,.19,.20], glass=[.46,.64,.68];
export function drawStreetFixture(solid, f, detailed = true) {
  const part = (across, along, width, depth, y0, height, color) => {
    const dx=Math.cos(f.yaw), dz=Math.sin(f.yaw);
    const base=streetCorners(f.x + dx*across-dz*along, f.y+y0, f.z+dz*across+dx*along, f.yaw,width,depth);
    const top=base.map(([x,y,z])=>[x,y+height,z]);
    solid.quad(...top,color);
    for(let i=0;i<4;i++) {
      const j=(i+1)%4;
      solid.quad(base[i],base[j],top[j],top[i],color,.85);
    }
  };
  if (f.kind === 'platformSign' || f.kind === 'platformGuide') {
    part(0, 0, .09, .09, 0, 2.04, metal);
    part(0, 0, f.width, f.depth, 2.04, .71, [.018,.082,.20]);
    part(0, 0, f.width, f.depth + .003, 2.65, .065, [.12,.62,.68]);
    drawPlatformNumber(solid, f);
  } else if(f.kind==='bench') {
    for(const offset of [-.60,.60]) part(offset,0,.11,.48,0,.42,metal);
    if (!detailed) part(0,0,1.65,.55,.42,.07,wood);
    else for(const offset of [-.20,0,.20]) part(0,offset,1.65,.16,.42,.07,wood);
    if (detailed) for(const offset of [-.64,.64]) part(offset,.24,.055,.055,.46,.39,metal);
    part(0,.24,1.65,.07,.65,.21,wood);
  } else if(f.kind==='rack') {
    for(const offset of [-.37,.37]) part(offset,0,.07,.08,0,.84,metal);
    part(0,0,.82,.08,.77,.07,metal);
  } else if(f.kind==='bin' && detailed) {
    part(0,0,.36,.36,0,.17,metal);
    part(0,0,.48,.48,.17,.61,[.18,.25,.23]);
    part(0,0,.48,.48,.85,.03,metal);
  } else {
    part(0,0,f.width,f.depth,0,f.height,f.piece==='sklo'?glass:metal);
  }
}

export function installStreetPaving(world, patches) {
  const touched = new Set();
  for (const patch of patches) {
    const xs = patch.outline.map(p => p[0]), zs = patch.outline.map(p => p[1]);
    const first = world.chunkIndex(Math.min(...xs),Math.min(...zs));
    const last = world.chunkIndex(Math.max(...xs),Math.max(...zs));
    if (first < 0 || last < 0) continue;
    for (let z = Math.floor(first / world.cols); z <= Math.floor(last / world.cols); z++) {
      for (let x = first % world.cols; x <= last % world.cols; x++) {
        const ci = z * world.cols + x;
        if (!world.streetPaving.has(ci)) world.streetPaving.set(ci, []);
        world.streetPaving.get(ci).push(patch);
        touched.add(ci);
      }
    }
  }
  for (const ci of touched) world.refreshStreetGround?.(ci);
}

export function paintStreetPaving(ctx, patches) {
  for (const patch of patches ?? []) {
    ctx.save();
    ctx.beginPath();
    patch.outline.forEach(([x,z],i) => i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#aca79c';
    ctx.fill();
    const xs = patch.outline.map(p=>p[0]), zs = patch.outline.map(p=>p[1]);
    const x0=Math.floor(Math.min(...xs)), x1=Math.ceil(Math.max(...xs));
    const z0=Math.floor(Math.min(...zs)), z1=Math.ceil(Math.max(...zs));
    ctx.fillStyle = '#8c887e';
    for (let row = 0; z0 + row*.55 < z1; row++) {
      const z = z0 + row*.55;
      ctx.fillRect(x0,z,x1-x0,.045);
      for(let x=x0+(row%2)*.45;x<x1;x+=.90) ctx.fillRect(x,z,.045,.55);
    }
    ctx.restore();
  }
}
