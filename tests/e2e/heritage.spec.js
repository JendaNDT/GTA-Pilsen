import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E05 – pilotní památky se vykreslí, přepnou detail a uvolní dlaždici', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
  const response = page.waitForResponse('**/detail/city/index.json');
  // Pevné datum a hodina: zkouška čeká ve 21.48 úplnou noc, která v Plzni od konce května
  // do konce července ještě nenastane. Noc, mlha a srážky také mění vykreslené efekty.
  await page.goto(gameUrl('/?debug&view=620&wet=1&date=2026-11-09&hour=10'));
  const data = await (await response).json();
  expect(data.sha256).toBe("825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac");
  expect(data.buildings).toBe(5697);
  expect(data.tiles).toHaveLength(93);
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(5, 5, 620, 8);
    // Vyčkáme na původní detail památky i na měřenou dlaždici v místě dotazu na střechu.
    const landmark = g.chunks.chunks.get(g.world.chunkIndex(-128, 128))?.heritage;
    const roof = g.chunks.chunks.get(g.world.chunkIndex(-22.8, -9.7))?.heritage;
    return landmark?.city && landmark.detail.length > 0 && roof?.city;
  });
  const city = await page.evaluate(() => {
    const g = window.__game, heritage = g.chunks.heritage;
    const ch = g.chunks.chunks.get(g.world.chunkIndex(-128, 128));
    const detail = ch.heritage.detail[0], base = ch.heritage.base[0];
    const near = detail.visible && base.material === heritage.cityClose;
    g.chunks.update(5, 5, 620, 0, 450);
    const fromHigh = !detail.visible && base.material === heritage.cityFar;
    g.chunks.update(5, 5, 620, 0, 0);
    g.env.setHour(17.95);
    window.__view(-63, 4, 64, -8, 36, 0);
    g.env.setHour(21.8);
    window.__view(-63, 4, 64, -8, 36, 0);
    return { near, fromHigh, night: g.env.night, roof: g.world.roofAt(-22.8, -9.7) };
  });
  expect(city.near).toBe(true);
  expect(city.fromHigh).toBe(true);
  expect(city.roof).toBeGreaterThan(60);
  expect(city.night).toBe(1);

  const forge = await page.evaluate(() => {
    const g = window.__game, w = g.world, heritage = g.chunks.heritage;
    const x = 22660.55, z = 3099.7;
    for (let i = 0; i < 5; i++) g.chunks.update(x, z, 620, 150);
    const key = w.chunkIndex(x, z), ch = g.chunks.chunks.get(key);
    const model = ch.heritage;
    const roof = w.roofAt(x, z);
    const normalRoof = w.bTop[heritage.forgeIndex];
    const clear = !w.collideCircle(x, z, 0.3, roof + 0.05, roof + 1.7);
    const stop = w.blocked(x, z, 0.3);
    g.focus = { x, z, y: w.heightAt(x, z) };
    g.env.setHour(22);
    g.chunks.update(x, z, 620, 0);
    window.__view(22681, 115.7, 3120, x, 113.1, z);
    const night = model.night.every((m) => m.visible);
    const nearWheels = model.wheels.every((m) => m.visible);
    let disposed = false;
    model.base[0].geometry.addEventListener('dispose', () => { disposed = true; });
    g.chunks.update(0, 0, 620, 0);
    return { roof, normalRoof, clear, stop, night, nearWheels, disposed, wheels: model.wheels.length };
  });
  expect(forge.roof).toBeGreaterThan(forge.normalRoof + 1);
  expect(forge.clear && forge.stop).toBe(true);
  expect(forge.wheels).toBe(4);
  expect(forge.nearWheels && forge.night && forge.disposed).toBe(true);
  expect(errors).toEqual([]);
});

test('měřené budovy se stahují podle polohy a po selhání zůstane vidět původní zástavba', async ({ page }) => {
  const file = '**/detail/city/128--128.bin';
  let fail = true, attempts = 0, requests = 0;
  page.on('request', (r) => { if (/\/detail\/city\/.*\.bin$/.test(r.url())) requests++; });
  await page.route(file, (route) => {
    attempts++;
    return fail ? route.abort() : route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 1, x: -1100, z: -2650, hour: 10 }));
  });
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready);
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(128, -128, 620, 12);
    const ch = g.chunks.chunks.get(g.world.chunkIndex(128, -128));
    return ch?.cityRequest && ch.stage >= 2 && ch.regularBuildings?.visible && !ch.heritage;
  });
  expect(attempts).toBe(1);
  await page.evaluate(() => window.__game.chunks.update(-1100, -2650, 620, 0));
  fail = false;
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(128, -128, 620, 12);
    return g.chunks.chunks.get(g.world.chunkIndex(128, -128))?.heritage?.city;
  });
  expect(attempts).toBe(2);
  const installed = await page.evaluate(() => {
    const g = window.__game, ci = g.world.chunkIndex(128, -128);
    const { heritage, chunks } = g.chunks;
    const tile = chunks.get(ci).heritage;
    const matched = heritage.cells.get(ci).replacements;
    let disposed = false;
    tile.base[0].geometry.addEventListener('dispose', () => { disposed = true; });
    const active = matched.filter((i) => heritage.replaced.has(i)).length;
    g.chunks.update(-1100, -2650, 620, 0);
    return { active, released: matched.every((i) => !heritage.replaced.has(i)), disposed };
  });
  expect(installed.active).toBeGreaterThan(0);
  expect(installed.released && installed.disposed).toBe(true);
});

test('Hlavní nádraží načte vlastní průčelí i v nízké kvalitě a po odjezdu ho uvolní', async ({page}) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',entry=>{ if (entry.type()==='error') errors.push(entry.text()); });
  await page.setViewportSize({width:640,height:384});
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=23.17'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button',{name:'Hrát',exact:true}).click();
  await page.evaluate(() => { window.__freeze(true); window.__game.player.place(696,496); });
  await page.waitForFunction(() => {
    const g=window.__game;
    g.chunks.update(696,496,340,40,g.player.y);
    const ch=g.chunks.chunks.get(g.world.chunkIndex(896,384));
    const atlas=ch?.disposables.find(item=>item.isTexture && item.image?.src?.includes('station-front'));
    return ch?.heritage?.group.getObjectByName('Průčelí hlavního nádraží') && atlas?.image.naturalWidth>0;
  });
  const observed=await page.evaluate(() => {
    const g=window.__game, key=g.world.chunkIndex(896,384), ch=g.chunks.chunks.get(key);
    const front=ch.heritage.group.getObjectByName('Průčelí hlavního nádraží');
    const dome=ch.heritage.group.getObjectByName('Kupole hlavního nádraží');
    let disposed=0;
    const atlas=ch.disposables.find(item=>item.isTexture && item.image?.src?.includes('station-front'));
    const assets=[front.geometry,dome.geometry,front.material,dome.material,atlas];
    for (const asset of assets) asset.addEventListener('dispose',()=>disposed++);
    window.__view(694,6,496,727,12,482);
    const visible=front.visible && dome.visible && front.parent.visible;
    g.chunks.update(-1200,-2600,340,0);
    return {visible,disposed,unloaded:!g.chunks.chunks.has(key)};
  });
  expect(observed).toEqual({visible:true,disposed:5,unloaded:true});
  expect(errors).toEqual([]);
});

test('Velká synagoga a oba domy se v nízké kvalitě načtou a po odjezdu uvolní', async ({page}) => {
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:844,height:390});
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=10'));
  await page.waitForFunction(()=>window.__ready);
  await page.getByRole('button',{name:'Hrát',exact:true}).click();
  await page.evaluate(()=>{ window.__freeze(true); window.__game.player.place(-292,111); });
  await page.waitForFunction(()=>{
    const g = window.__game;
    g.chunks.update(-292,111,340,40,g.player.y);
    return g.scene.getObjectByName('Velká synagoga a sousední domy')?.material.map.image?.naturalWidth>0;
  });
  const result = await page.evaluate(()=>{
    const g = window.__game, mesh = g.scene.getObjectByName('Velká synagoga a sousední domy');
    window.__view(-292,6.6,111,-329,17,103);
    let disposed = 0;
    for (const asset of [mesh.geometry,mesh.material,mesh.material.map]) {
      asset.addEventListener('dispose',()=>disposed++);
    }
    const visible = mesh.visible && mesh.parent.visible;
    g.chunks.update(-1200,-2600,340,0);
    return {visible,disposed};
  });
  expect(result).toEqual({visible:true,disposed:3});
  expect(errors).toEqual([]);
});

test('Velké divadlo na telefonu načte terasu i zábradlí a obnoví je po návratu', async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=10'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{ window.__freeze(true); window.__game.player.place(-316.25,208.91); });
    const visits=[];
    for(let pass=0;pass<2;pass++) {
      await page.waitForFunction(()=>{
        const g=window.__game;
        g.chunks.update(-316.25,208.91,340,40,g.player.y);
        return g.scene.getObjectByName('Velké divadlo')?.material.map.image?.naturalWidth>0;
      });
      visits.push(await page.evaluate(()=>{
        const g=window.__game, w=g.world, mesh=g.scene.getObjectByName('Velké divadlo');
        const rails=w.streetFixtures.get(w.chunkIndex(-316.25,208.91)).filter(f=>f.kind==='theatreGlass');
        const id=rails[0].id;
        const targetX=-326+(117*21-50*29)/Math.hypot(117,50);
        const targetZ=237+(-50*21-117*29)/Math.hypot(117,50);
        const distance=f=>Math.hypot(f.x-targetX,f.z-targetZ);
        const edge=rails.reduce((near,f)=>distance(f)<distance(near)?f:near);
        const dx=50/Math.hypot(117,50), dz=117/Math.hypot(117,50);
        g.colliders.update(edge.x,edge.z);
        g.player.place(edge.x+dx*1.3,edge.z+dz*1.3,edge.y+.3);
        for(let i=0;i<90;i++) g.player.update(1/60,0,0,false,false);
        const landed=Math.abs(g.player.y-edge.y)<.10;
        for(let i=0;i<120;i++) g.player.update(1/60,-dx,-dz,false,false);
        const gap=(g.player.x-edge.x)*dx+(g.player.z-edge.z)*dz;
        const stopped=gap>.07 && gap<.8;
        const attached=w.breakables.visuals.has(id);
        const terrace=w.roofAt(-316.25,208.91);
        window.__view(-346,12,252,-325,17,235);
        let disposed=0;
        for(const asset of [mesh.geometry,mesh.material,mesh.material.map]) asset.addEventListener('dispose',()=>disposed++);
        g.chunks.update(-1200,-2600,340,0);
        return {touch:navigator.maxTouchPoints,terrace,attached,disposed,id,count:rails.length,landed,stopped,
          detached:!w.breakables.visuals.has(id)};
      }));
    }
    expect(visits[0].touch).toBeGreaterThan(0);
    expect(visits[0].terrace).toBeCloseTo(7.1,1);
    expect(visits[0].count).toBeGreaterThan(10);
    expect(visits[0]).toMatchObject({attached:true,disposed:3,detached:true,landed:true,stopped:true});
    expect(visits[1]).toEqual(visits[0]);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('Nové divadlo na telefonu dovolí projít portálem a pod spojovací chodbou', async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=13'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{window.__freeze(true);window.__game.player.place(-389,-121);});
    const waitForTheatre=()=>page.waitForFunction(()=>{
      const g=window.__game;
      g.chunks.update(-389,-121,340,40,g.player.y);
      return g.scene.getObjectByName('Nové divadlo')?.material.map.image?.naturalWidth>0;
    });
    await waitForTheatre();
    const result=await page.evaluate(()=>{
      const g=window.__game, dx=.06682, dz=-.99776;
      const walk=(u,v,steps)=>{
        const x=-388.66+dx*u-dz*v, z=-121.53+dz*u+dx*v;
        g.colliders.update(x,z);
        g.player.place(x,z,g.world.heightAt(x,z)+.1);
        for(let i=0;i<35;i++) g.player.update(1/60,0,0,false,false);
        for(let i=0;i<steps;i++) g.player.update(1/60,dx,dz,false,false);
        return u+(g.player.x-x)*dx+(g.player.z-z)*dz;
      };
      const door=walk(-1,-.16,220), pier=walk(-1,-1.84,160);
      const ball=walk(-1,-18.5,160), bridge=walk(10,-21.8,270);
      const mesh=g.scene.getObjectByName('Nové divadlo');
      let disposed=0;
      for(const asset of [mesh.geometry,mesh.material,mesh.material.map]) asset.addEventListener('dispose',()=>disposed++);
      g.chunks.update(-1200,-2600,340,0);
      return {door,pier,ball,bridge,disposed};
    });
    expect(result.door).toBeGreaterThan(3);
    expect(result.door).toBeLessThan(5.4);
    expect(result.pier).toBeLessThan(2.35);
    expect(result.ball).toBeGreaterThan(2.4);
    expect(result.ball).toBeLessThan(3.55);
    expect(result.bridge).toBeGreaterThan(18);
    expect(result.disposed).toBe(3);
    await waitForTheatre();
    expect(errors).toEqual([]);
  } finally {await context.close();}
});

test('radnice na dotykovém displeji ukáže herní čas také po návratu na náměstí', async ({browser}) => {
  const context = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(() => window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(() => { window.__freeze(true); window.__game.player.place(7,-46); });
    const waitForFacade = () => page.waitForFunction(() => {
      const g = window.__game;
      g.chunks.update(7,-46,340,40,g.player.y);
      return g.scene.getObjectByName('Plzeňská radnice')?.material.map.image?.naturalWidth>0;
    });
    await waitForFacade();
    const result = await page.evaluate(() => {
      const g = window.__game, facade = g.scene.getObjectByName('Plzeňská radnice');
      const clock = g.scene.getObjectByName('Radniční hodiny');
      window.__setClock(null,3.5);
      const angles = clock.children.map(hand => hand.rotation.z);
      let released = 0;
      for (const asset of [facade.geometry,facade.material,facade.material.map,...clock.children.map(hand => hand.geometry)]) {
        asset.addEventListener('dispose',() => released++);
      }
      g.chunks.update(-1200,-2600,340,0);
      window.__setClock(null,6.25);
      return {angles,released,unloaded:!g.scene.getObjectByName('Radniční hodiny')};
    });
    expect(result.angles[0]).toBeCloseTo(-3.5*Math.PI/6,6);
    expect(result.angles[1]).toBeCloseTo(-7*Math.PI,6);
    expect(result).toMatchObject({released:5,unloaded:true});
    await waitForFacade();
    const angle = await page.evaluate(() => window.__game.scene.getObjectByName('Radniční hodiny').children[0].rotation.z);
    expect(angle).toBeCloseTo(-6.25*Math.PI/6,6);
    expect(errors).toEqual([]);
  } finally {await context.close();}
});

test('katedrála i radnice ukážou stejný čas a po návratu obnoví hodiny na nízké předvolbě', async ({browser}) => {
  const context = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(() => window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(() => { window.__freeze(true); window.__game.player.place(9,42); });
    const waitForSquare = () => page.waitForFunction(() => {
      const g = window.__game;
      g.chunks.update(9,42,340,40,g.player.y);
      return g.scene.getObjectByName('Katedrála sv. Bartoloměje')?.material.map.image?.naturalWidth>0
        && g.scene.getObjectByName('Radniční hodiny');
    });
    await waitForSquare();
    const result = await page.evaluate(() => {
      const g = window.__game;
      window.__setClock(null,3.5);
      const church = g.scene.getObjectByName('Katedrála sv. Bartoloměje');
      const hands = g.scene.getObjectByName('Hodiny katedrály');
      const tip = hands.geometry.attributes.position.getY(8);
      const hour = g.scene.getObjectByName('Radniční hodiny').children[0].rotation.z;
      let disposed = 0;
      for (const asset of [church.geometry,church.material,church.material.map,hands.geometry]) {
        asset.addEventListener('dispose',() => disposed++);
      }
      g.chunks.update(-1200,-2600,340,0);
      window.__setClock(null,12);
      return {hour,tip,disposed,unloaded:!g.scene.getObjectByName('Hodiny katedrály')};
    });
    expect(result.hour).toBeCloseTo(-3.5*Math.PI/6,6);
    expect(result.tip).toBeCloseTo(51.77,2);
    expect(result).toMatchObject({disposed:4,unloaded:true});
    await waitForSquare();
    const tip = await page.evaluate(() => window.__game.scene.getObjectByName('Hodiny katedrály').geometry.attributes.position.getY(8));
    expect(tip).toBeCloseTo(54.99,2);
    expect(errors).toEqual([]);
  } finally {await context.close();}
});

test('morový sloup na nízké kvalitě má stupně, průchozí okolí a po návratu zachová poškození oplocení', async ({browser}) => {
  const context = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=340'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{ __freeze(true); __game.player.place(-23,-38); });
    const load=()=>page.waitForFunction(()=>{
      __game.chunks.update(-23,-38,340,40);
      return Boolean(__game.scene.getObjectByName('Morový sloup'));
    });
    await load();
    const result=await page.evaluate(()=>{
      const g=__game, w=g.world, site=w.plagueColumn;
      const id=site.fixtures[0].id, mesh=g.scene.getObjectByName('Morový sloup').levels[0].object.children[0];
      let released=false;
      mesh.geometry.addEventListener('dispose',()=>{released=true;});
      const top=w.roofAt(-23.31,-48.98)-site.ground, blocked=w.blocked(-14,-48.98,.35);
      const step=w.roofAt(-19.05,-48.12)-site.ground;
      // Postava jde z volné dlažby kolmo na jižní pole plotu.
      const fence=site.fixtures[2], nx=-Math.sin(fence.yaw), nz=Math.cos(fence.yaw);
      const sx=fence.x+nx*2.3, sz=fence.z+nz*2.3;
      for (let i=0;i<28;i++) g.colliders.update(sx,sz);
      g.player.place(sx,sz,w.heightAt(sx,sz)+.1);
      for (let i=0;i<35;i++) g.player.update(1/60,0,0,false,false);
      for (let i=0;i<160;i++) g.player.update(1/60,-nx,-nz,false,false);
      const distance=(g.player.x-fence.x)*nx+(g.player.z-fence.z)*nz;
      w.breakables.damage(id,'broken',g.clock.now);
      g.chunks.update(-1200,-2600,340,0);
      return {id,top,step,distance,blocked,released,unloaded:!w.breakables.visuals.has(id)};
    });
    expect(result).toMatchObject({blocked:false,released:true,unloaded:true});
    expect(result.distance).toBeGreaterThan(.2);
    expect(result.distance).toBeLessThan(.7);
    expect(result.top).toBeCloseTo(15.36,2);
    expect(result.step).toBeCloseTo(.165,2);
    await load();
    expect(await page.evaluate(id=>__game.world.breakables.visuals.has(id) && __game.world.breakables.state(id),result.id)).toBe('broken');
  } finally { await context.close(); }
});

test('muzeum na dotykovém displeji načte průčelí i po odjezdu a návratu', async ({browser}) => {
  const context = await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page = await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(() => window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(() => { window.__freeze(true); window.__game.player.place(145,315); });
    const waitForMuseum = () => page.waitForFunction(() => {
      const game = window.__game;
      game.chunks.update(145,315,340,40,game.player.y);
      return game.scene.getObjectByName('Západočeské muzeum')?.material.map.image?.naturalWidth===1536;
    });
    await waitForMuseum();
    const released = await page.evaluate(() => {
      const game = window.__game, mesh = game.scene.getObjectByName('Západočeské muzeum');
      let count = 0;
      for (const asset of [mesh.geometry,mesh.material,mesh.material.map]) asset.addEventListener('dispose',() => count++);
      game.chunks.update(-1200,-2600,340,0);
      return count;
    });
    expect(released).toBe(3);
    await waitForMuseum();
  } finally { await context.close(); }
});

test('pavilonek v parku má na nízké kvalitě rozdílné střechy a obnoví zábradlí po návratu',async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{window.__freeze(true); __game.player.place(-795,-1515);});
    const waitForSite=()=>page.waitForFunction(()=>{
      const g=window.__game;
      g.chunks.update(-795,-1515,340,40,g.player.y);
      return g.scene.getObjectByName('Lochotínský pavilonek')?.material.map.image?.naturalWidth===1024;
    });
    await waitForSite();
    const result=await page.evaluate(()=>{
      const g=window.__game,w=g.world, mesh=g.scene.getObjectByName('Lochotínský pavilonek');
      const rail=w.pavilion.rails[3], wood=g.scene.getObjectByName('Dřevěné zábradlí terasy');
      const version=wood.geometry.attributes.position.version;
      w.breakables.damage(rail.id,'broken',0);
      const broken=wood.geometry.attributes.position.version>version;
      let freed=0;
      for (const a of [mesh.material.map,mesh.material,mesh.geometry,wood.geometry]) a.addEventListener('dispose',()=>freed++);
      const diff=w.roofAt(-800,-1533)-w.roofAt(-814,-1532);
      g.chunks.update(0,0,340,0);
      return {diff,freed,broken};
    });
    expect(result.diff).toBeGreaterThan(2.5);
    expect(result).toMatchObject({freed:4,broken:true});
    await waitForSite();
    expect(await page.evaluate(()=>{
      const w=window.__game.world, rail=w.pavilion.rails[3];
      const state=w.breakables.state(rail.id);
      w.breakables.repairDue(2*86400);
      return [state,w.breakables.state(rail.id)];
    })).toEqual(['broken','intact']);
  } finally { await context.close(); }
});

test('kašny na náměstí mají čtyři mísy, pevný chrlič a po návratu se načtou znovu',async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{ __freeze(true); __game.player.place(21,92); });
    const load=()=>page.waitForFunction(()=>{
      __game.chunks.update(21,92,340,40);
      return ['Anděl','Chrtice','Velbloud'].every(n=>__game.scene.getObjectByName('Kašna '+n));
    });
    await load();
    const result=await page.evaluate(()=>{
      const g=__game,w=g.world;
      const s=[...w.fountainTiles.values()].flat().find(s=>s.id==='andel');
      const sx=s.x-2*s.sin,sz=s.z+2*s.cos;
      for (let i=0;i<28;i++) g.colliders.update(sx,sz);
      g.player.place(sx,sz,w.heightAt(sx,sz)+.1);
      for (let i=0;i<35;i++) g.player.update(1/60,0,0,false,false);
      for (let i=0;i<160;i++) g.player.update(1/60,s.sin,-s.cos,false,false);
      const distance=(g.player.z-s.z)*s.cos-(g.player.x-s.x)*s.sin;
      const count=w.fountainLand.size;
      const mesh=g.scene.getObjectByName('Kašna Anděl').levels[0].object;
      let freed=false;
      mesh.geometry.addEventListener('dispose',()=>{freed=true;});
      g.chunks.update(-1200,-2600,340,0);
      return {count,distance,freed};
    });
    expect(result.count).toBe(4);
    expect(result.freed).toBe(true);
    expect(result.distance).toBeGreaterThan(.3);
    expect(result.distance).toBeLessThan(1);
    await load();
  } finally { await context.close(); }
});

test('šest severních domů a radnice se na telefonu znovu načtou po návratu',async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{ __freeze(true); __game.player.place(18,-33); });
    const ready=()=>page.waitForFunction(()=>{
      __game.chunks.update(18,-33,340,40);
      const meshes=__game.scene.getObjectsByProperty('name','Severní průčelí náměstí');
      return meshes.length===2 && meshes.every(m=>m.material.map.image?.naturalWidth===2048)
        && !!__game.scene.getObjectByName('Plzeňská radnice');
    });
    await ready();
    const disposed=await page.evaluate(()=>{
      let count=0;
      for (const mesh of __game.scene.getObjectsByProperty('name','Severní průčelí náměstí')) {
        for (const asset of [mesh.geometry,mesh.material,mesh.material.map]) {
          asset.addEventListener('dispose',()=>count++);
        }
      }
      __game.chunks.update(-1200,-2600,340,0);
      return count;
    });
    expect(disposed).toBe(6);
    await ready();
  } finally {await context.close();}
});

test('tři další strany náměstí mají na dotykovém displeji všech 33 adres',async ({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  try {
    const page=await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{ __freeze(true); __game.player.place(0,25); });
    const ready=()=>page.waitForFunction(()=>{
      __game.chunks.update(0,25,340,40);
      const seen=[];
      __game.scene.traverse(mesh=>{
        if(mesh.geometry?.userData.squareAddresses && mesh.material.map.image?.naturalWidth===2048)
          seen.push(...mesh.geometry.userData.squareAddresses);
      });
      return seen.length===33 && new Set(seen).size===33 && seen.includes(23) && seen.includes(36);
    });
    await ready();
    const released=await page.evaluate(()=>{
      let disposed=0;
      __game.scene.traverse(mesh=>{
        if(mesh.geometry?.userData.squareAddresses)
          for(const part of [mesh.geometry,mesh.material,mesh.material.map]) part.addEventListener('dispose',()=>disposed++);
      });
      __game.chunks.update(-1200,-2600,340,0);
      return disposed;
    });
    expect(released).toBe(12);
    await ready();
  } finally { await context.close(); }
});

test('Bory na nízké kvalitě obnoví celý model i jeho kopuli po návratu z přeletu',async ({page})=>{
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
  await page.waitForFunction(()=>window.__ready);
  const ready=()=>page.waitForFunction(()=>{
    const g=__game,s=g.world.bory;
    g.chunks.update(s.cx,s.cz,340,40);
    return g.scene.getObjectByName('Historická věznice Bory')?.material.map.image?.naturalWidth===2048;
  });
  await page.evaluate(()=>{__freeze(true);});
  await ready();
  const result=await page.evaluate(()=>{
    const g=__game,w=g.world,s=w.bory,mesh=g.scene.getObjectByName('Historická věznice Bory');
    let released=0;
    for(const asset of [mesh.geometry,mesh.material,mesh.material.map]) asset.addEventListener('dispose',()=>released++);
    const roof=w.roofAt(s.cx,s.cz), peak=s.roofs.heightAt(s.cx,s.cz);
    g.chunks.update(0,0,340,0);
    return {released,roof,peak,wings:s.wings.size};
  });
  expect(result.released).toBe(3);
  expect(result.wings).toBe(7);
  expect(result.roof).toBeCloseTo(result.peak,3);
  await ready();
});
