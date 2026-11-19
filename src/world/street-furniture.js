// Rozměry vlastních herních modelů v metrech. Impulsy slouží jen pro herní mechaniku.
export const STREET_MODELS = {
  bench: {width:1.65, depth:.60, height:.86, impulse:3000},
  bin: {width:.48, depth:.48, height:.88, impulse:800},
  rack: {width:.82, depth:.20, height:.84, impulse:3200},
  post: {width:.15, depth:.15, height:.80, impulse:3800},
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
  if (item.kind !== 'shelter') return [part(item.kind,0,0,model.width,model.depth,0,model.height,model.impulse)];
  return [part('stojka-l',-1.43,.45,.10,.10,0,2.30,Infinity),
    part('stojka-p',1.43,.45,.10,.10,0,2.30,Infinity),
    part('strecha',0,0,3,1.05,2.30,.05,Infinity),
    part('sklo',0,.45,2.73,.05,.24,1.98,600)];
}

const wood=[.39,.205,.084], metal=[.17,.19,.20], glass=[.46,.64,.68];
export function drawStreetFixture(solid, f) {
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
  if(f.kind==='bench') {
    for(const offset of [-.60,.60]) part(offset,0,.11,.48,0,.42,metal);
    for(const offset of [-.20,0,.20]) part(0,offset,1.65,.16,.42,.07,wood);
    for(const offset of [-.64,.64]) part(offset,.24,.055,.055,.46,.39,metal);
    part(0,.24,1.65,.07,.65,.21,wood);
  } else if(f.kind==='rack') {
    for(const offset of [-.37,.37]) part(offset,0,.07,.08,0,.84,metal);
    part(0,0,.82,.08,.77,.07,metal);
  } else if(f.kind==='bin') {
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
