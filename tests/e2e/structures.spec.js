import {expect, test} from '@playwright/test';
import {gameUrl} from './game-url.js';

test('E22 – měřený pilíř má stálou oporu a při přiblížení načte městský model @webgpu', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', {name: 'Hrát', exact: true}).click();
  const location = await page.evaluate(() => {
    __freeze(true);
    const {world, chunks, colliders} = __game;
    const [ci, tile] = [...world.structures.tiles].find(([, tile]) =>
      tile.objects.some(o => o.id === '00000002021000213-265e2383af644593'));
    const part = tile.objects.find(o => o.id === '00000002021000213-265e2383af644593');
    const vertices = world.structures.positions.subarray(3 * part.start, 3 * (part.start + part.count));
    let top = -Infinity, x = 0, z = 0;
    // Těžiště vodorovné horní stěny je uvnitř plochy i u úzkého pilíře.
    for (let i = 0; i < vertices.length; i += 9) {
      const [ax,ay,az,bx,by,bz,cx,cy,cz] = vertices.subarray(i, i + 9);
      const y = (ay + by + cy) / 3;
      if (y <= top || Math.max(ay,by,cy) - Math.min(ay,by,cy) > 0.25 ||
          (bz-az)*(cx-ax) - (bx-ax)*(cz-az) < 0.03) continue;
      x = (ax+bx+cx)/3;
      z = (az+bz+cz)/3;
      top = y;
    }
    if (!Number.isFinite(top)) throw Error('Chybí horní plocha pilíře.');
    for (let i = 0; i < 12; i++) chunks.update(x,z,440,100);
    for (let i = 0; i < 25; i++) colliders.update(x,z);
    // Paprsek začne 15 cm nad pilířem, pod samostatnou jízdní mostovkou.
    const height = colliders.exitHeight(x,z,top - 0.55);
    return {ci, delta: Math.abs(height - top)};
  });
  expect(location.delta).toBeLessThan(0.08);
  await page.waitForFunction(ci => {
    const item = __game.chunks.chunks.get(ci)?.structure;
    return item && item.mesh.geometry !== item.core && item.mesh.geometry.attributes.position.count > 0;
  }, location.ci);
});

for (const mode of ['vypnuto', 'chybějící základ', 'starý otisk']) {
  test('E22 – hra nastartuje bez měřených objektů: ' + mode, async ({page}) => {
    let count = 0;
    await page.route('**/detail/structures/**', async route => {
      count++;
      if (mode === 'chybějící základ' && route.request().url().endsWith('/core.bin'))
        return route.fulfill({status:404, body:''});
      if (mode === 'starý otisk' && route.request().url().endsWith('/index.json')) {
        const result = await route.fetch(), index = await result.json();
        index.sources.roads = '00000000';
        return route.fulfill({response:result, json:index});
      }
      return route.continue();
    });
    await page.goto(gameUrl('/?debug&quality=low' + (mode === 'vypnuto' ? '&structures=0' : '')));
    await page.waitForFunction(() => window.__ready);
    expect(await page.evaluate(() => __game.world.structures)).toBeNull();
    expect(count).toBe(mode === 'vypnuto' ? 0 : 2);
  });
}

test('E22 – kamera zaparkovaného vozu se u nízkého pohledu zastaví před kamenným okrajem', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, car = g.player.lastCar;
    const model = w.deckCalibrations.get(19), k = w.rOff[19];
    const dx = w.rpx[k+1]-w.rpx[k], dz = w.rpz[k+1]-w.rpz[k], length = Math.hypot(dx,dz);
    const nx = -dz/length, nz = dx/length, t = 0.35, u = t*length;
    const strip = model.strips.find(([a,lo,,b]) => a <= u && u < b && lo > 0);
    const inner = strip[1] + (strip[4]-strip[1])*(u-strip[0])/(strip[3]-strip[0]);
    const side = inner-1, x = w.rpx[k]+t*dx+side*nx, z = w.rpz[k]+t*dz+side*nz;
    const y = w.rpy[k]+t*(w.rpy[k+1]-w.rpy[k]);
    car.place(x,z,Math.atan2(dx,dz),y);
    g._enterCar(car);
    g.camYaw = Math.atan2(-nx,-nz);
    g.camPitch = 0.04;
    g.camDist = 7;
    g._updateCamera(1/60);
    const near = (g.camera.position.x-x)*nx+(g.camera.position.z-z)*nz;
    g.camPitch = 0.8;
    g.camDist = 7;
    g._updateCamera(1/60);
    const high = (g.camera.position.x-x)*nx+(g.camera.position.z-z)*nz;
    return {near,high};
  });
  expect(result.near).toBeGreaterThan(0.3);
  expect(result.near).toBeLessThan(1);
  expect(result.high).toBeGreaterThan(2);
});

test('E22 – dvě měřené lávky mají průchozí okraje a zachovávají výšku přístupů @webgpu', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const walks = await page.evaluate(() => {
    const {world:w,player,colliders} = __game;
    const walks = [];
    for (const road of [1921,1845]) {
      const model = w.deckCalibrations.get(road);
      if (model?.kind !== 'plan') throw Error('Chybí půdorys lávky.');
      const a = w.rOff[road], b = w.rOff[road+1]-1, dx = w.rpx[b]-w.rpx[a], dz = w.rpz[b]-w.rpz[a];
      const length = Math.hypot(dx,dz), ux = dx/length, uz = dz/length;
      const original = w.r.bridgeOff[road];
      const ends = [Math.abs(w.rpy[a]-w.r.bridgeY[original]*0.02),Math.abs(w.rpy[b]-w.r.bridgeY[original+1]*0.02)];
      for (const sign of [-1,1]) {
        const offset = sign*(w.deckHalfWidth(road)-0.64);
        const fraction = sign > 0 ? 1/length : 1-1/length;
        const x = w.rpx[a]+fraction*dx+model.shiftX-offset*uz;
        const z = w.rpz[a]+fraction*dz+model.shiftZ+offset*ux;
        for (let n=0;n<25;n++) colliders.update(x,z);
        player.place(x,z,w.rpy[a]+(w.rpy[b]-w.rpy[a])*fraction);
        let progress = 0, drift = 0, swimming = false;
        for (let n=0;n<60*length && progress<length-2;n++) {
          player.update(1/60,sign*ux,sign*uz,false,false);
          const rx = player.x-x, rz = player.z-z;
          progress = sign*(rx*ux+rz*uz);
          drift = Math.max(drift,Math.abs(rx*uz-rz*ux));
          swimming ||= player.swimming;
        }
        walks.push({road,ends,progress,length,drift,swimming,grounded:player.grounded});
      }
    }
    return walks;
  });
  for (const walk of walks) {
    expect(Math.max(...walk.ends)).toBeLessThan(0.001);
    expect(walk.progress,JSON.stringify(walk)).toBeGreaterThanOrEqual(walk.length-2);
    expect(walk.drift).toBeLessThan(0.45);
    expect(walk.swimming).toBe(false);
    expect(walk.grounded).toBe(true);
  }
});

test('E22 – šířka dvou železničních mostovek souhlasí s kresbou a fyzikou @webgpu', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const checks = await page.evaluate(() => {
    const {world:w,colliders,chunks} = __game;
    const checks = [];
    for (const index of [8,21]) {
      const rail=w.rails[index], p=rail.deck;
      if (!p?.widths) throw Error('Chybí měřená železniční deska ' + index);
      const k=Math.floor(p.n/2), x=p.x[k], z=p.z[k], y=p.y[k];
      const dx0=x-p.x[k-1], dz0=z-p.z[k-1], dx1=p.x[k+1]-x, dz1=p.z[k+1]-z;
      const l0=Math.hypot(dx0,dz0), l1=Math.hypot(dx1,dz1);
      let nx=-dz0/l0-dz1/l1, nz=dx0/l0+dx1/l1;
      const len=Math.hypot(nx,nz);
      nx/=len; nz/=len;
      const scale=Math.min(1.5,1/Math.max(0.55,nx*(-dz1/l1)+nz*dx1/l1));
      for (let n=0;n<25;n++) colliders.update(x,z);
      for (let n=0;n<12;n++) chunks.update(x,z,450,80,y);
      const ci=w.railChunks.findIndex(ids=>ids?.includes(index)), chunk=chunks.chunks.get(ci);
      if (!chunk) throw Error('Chybí vykreslená dlaždice kolejí.');
      const geometries=chunk.group.children.filter(m=>m.isMesh && m.material===chunks.solidMat)
        .map(m=>m.geometry.getAttribute('position'));
      for (const sign of [-1,1]) {
        const outer=sign*p.widths[k]*scale, edgeX=x+outer*nx, edgeZ=z+outer*nz;
        let visual=Infinity;
        for (const a of geometries) for (let j=0;j<a.count;j++) {
          visual=Math.min(visual,Math.hypot(a.getX(j)-edgeX,a.getY(j)-(y-0.04),a.getZ(j)-edgeZ));
        }
        const walk=outer-sign*0.32, px=x+walk*nx, pz=z+walk*nz;
        const floor=colliders.exitHeight(px,pz,y-0.55);
        checks.push({index,sign,visual,physics:Math.abs(floor-y),
          profile:Math.abs(w.deckAt(px,pz,y+0.25,rail.cls===0?1:2)-y)});
      }
    }
    return checks;
  });
  expect(checks).toHaveLength(4);
  for (const c of checks) {
    expect(c.visual,JSON.stringify(c)).toBeLessThan(0.01);
    expect(c.physics,JSON.stringify(c)).toBeLessThan(0.09);
    expect(c.profile,JSON.stringify(c)).toBeLessThan(0.09);
  }
});
