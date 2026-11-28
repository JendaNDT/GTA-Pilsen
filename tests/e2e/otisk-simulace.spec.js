import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const directory = new URL('./otisk/', import.meta.url);
const fixture = new URL('zakladni.json', directory);

function runScenario(particles) {
  const game = window.__game;
  const starter = game.player.lastCar;
  const dt = 1 / 60;
  const millimetres = value => Math.round(value * 1000) || 0;
  const position = object => [object.x, object.y, object.z].map(millimetres);
  const snapshots = [];

  game.fullscreenEnabled = false;
  game.particles.enabled = particles;
  window.__play();
  window.__freeze(true);
  const alongX = Math.sin(starter.yaw), alongZ = Math.cos(starter.yaw);
  // Začni na stejné straně ulice jako vůz, před pevně dlouhou chůzí k jeho dveřím.
  game.player.place(starter.x + alongZ * 2 - alongX * 15.5, starter.z - alongX * 2 - alongZ * 15.5);
  game.camYaw = starter.yaw;

  function pressAction() {
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
  }

  function snapshot(second) {
    return {
      second,
      player: { position: position(game.player), mode: game.mode, money: game.money },
      car: position(starter),
      // Správce aut přidává vozidla na konec a při odebrání pořadí ostatních zachovává.
      traffic: game.vehicles.cars.filter(car => car.mode === 'ai').slice(0, 20).map(car => ({
        position: position(car), speed: millimetres(car.speed),
      })),
      transit: game.transit.vehicles.filter(vehicle => vehicle.visible).map(vehicle => ({
        trip: vehicle.event.trip.id, position: position(vehicle),
      })),
      pedestrians: game.peds.peds.length,
    };
  }

  snapshots.push(snapshot(0));
  window.__setInput(0, 0.65);
  for (let second = 5; second <= 60; second += 5) {
    if (second === 15 || second === 55) pressAction();
    if (second > 10 && second <= 50) {
      const steer = second <= 25 ? -0.04 : second <= 35 ? 0.02 : 0;
      window.__setInput(steer, second === 50 ? 0 : 0.24);
    }
    if (second >= 55) window.__setInput(0, 0);
    window.__step(dt, 300);
    snapshots.push(snapshot(second));
    if (second >= 15 && second <= 50 && game.car !== starter) {
      throw new Error(`Ve ${second}. sekundě hráč neřídí startovní auto.`);
    }
    if (second === 55 && game.mode !== 'foot') {
      throw new Error('Po čtyřiceti sekundách jízdy se nepodařilo vystoupit.');
    }
  }
  return snapshots;
}

test('adresa zkoušky má výchozí semínko a respektuje jeho volbu', () => {
  const seed = (path, options) => new URL(gameUrl(path, options)).searchParams.get('seed');
  expect(seed('/')).toBe('1');
  expect(seed('/', { seed: 42 })).toBe('42');
  expect(seed('/?seed=0', { seed: 42 })).toBe('0');
  expect(seed('/', { seed: null })).toBeNull();
});

test('otisk simulace po minutě chůze a jízdy odpovídá vzoru', async ({ page }, info) => {
  await page.goto(gameUrl('/?debug&seed=1&date=2026-11-09&hour=7.5&weather=clear&quality=low&adapt=0'));
  await waitForGame(page);
  const webgpu = info.project.name === 'webgpu';
  expect(await page.evaluate(() => window.__game.renderer.backend.isWebGPUBackend === true)).toBe(webgpu);
  const actual = await page.evaluate(runScenario, webgpu);
  const [startX, , startZ] = actual[0].car;
  const [endX, , endZ] = actual.at(-1).car;
  expect(Math.hypot(endX - startX, endZ - startZ)).toBeGreaterThan(20_000);

  if (process.env.OTISK_ZAPSAT === '1' && info.project.name === 'webgl2') {
    await mkdir(directory, { recursive: true });
    await writeFile(fixture, JSON.stringify(actual, null, 2) + '\n');
  }
  const expected = JSON.parse(await readFile(fixture, 'utf8'));
  expect(actual).toEqual(expected);
});
