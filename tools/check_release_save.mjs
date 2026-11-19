// Tři spuštění na stejném originu používají skutečný zápis hry v odděleném profilu Chromia.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { webgpuFlags } from '../tests/e2e/browser-flags.js';

const [oldAddress,newAddress] = process.argv.slice(2);
if (!oldAddress || !newAddress || new URL(oldAddress).origin !== new URL(newAddress).origin)
  throw Error('Zadej adresu předchozího a nového vydání pod stejným originem.');
const browser = await chromium.launch({channel:'chromium',args:process.env.PLZEN_SOFTWARE_WEBGPU ? webgpuFlags : []});
try {
  const session = await browser.newContext({viewport:{width:480,height:320}});
  const page=await session.newPage();
  page.setDefaultTimeout(300000);
  const open = async address => {
    const url=new URL(address);
    for(const [key,value] of Object.entries({debug:'',quality:'low',view:'350',adapt:'0',hour:'10'})) url.searchParams.set(key,value);
    await page.goto(url.href);
    await page.waitForFunction(() => window.__ready);
  };
  const state = () => page.evaluate(() => {
    const g=window.__game, owned=g.garage.snapshot();
    return {money:g.money, completed:g.stats.deliveries, discoveries:g.jobs.landmarks.filter(l=>l.found).map(l=>l.name),
      model:owned?.model, health:owned?.health, upgrades:owned?.upgrades};
  });
  await open(oldAddress);
  await page.evaluate(() => {
    const g=window.__game;
    g.player.place(841,254);
    g.money=6000;
    for(const action of ['buy','brakes','tires'])g.garage.perform(action);
    g.jobs.landmarks[4].found=true;
    g.stats.deliveries=7;
    if(!g.save())throw Error('Původní vydání neuložilo postup.');
  });
  const previous=await state();
  assert.equal(previous.model,'hatch');
  assert.deepEqual(previous.upgrades,{brakes:true,tires:true});
  assert.equal(previous.completed,7);
  await open(newAddress);
  assert.deepEqual(await state(),previous);
  const updated=await page.evaluate(() => {
    const g=window.__game;
    g.addMoney(120);
    g.jobs.landmarks[6].found=true;
    if(!g.save())throw Error('Nové vydání neuložilo postup.');
    return g.money;
  });
  const candidate=await state();
  assert.equal(updated,previous.money+120);
  assert.ok(candidate.discoveries.length>previous.discoveries.length);
  await open(newAddress);
  assert.deepEqual(await state(),candidate);
  await open(oldAddress);
  assert.deepEqual(await state(),candidate);
  console.log(JSON.stringify({previous,candidate,rollback:await state(),browser:browser.version()}));
} finally { await browser.close(); }
