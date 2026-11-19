import { layers } from '../../src/physics/world.js';

// Každý test má vlastní stránku. Ve fyzice zůstane hráč a zkušební
// vozidla či figuríny na samostatné desce vysoko nad městem.
export async function prepareCollisionLab(page) {
  await page.evaluate(layer => {
    window.__freeze(true);
    const g = window.__game, y = 1024;
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    for (const car of [...g.vehicles.cars]) {
      if (car !== g.player.lastCar) g.vehicles.remove(car);
    }
    g.transit._dispatch = () => {};
    g.transit.vehicles.length = 0;
    g.colliders.update = () => {};
    const corners = [-128,y,-128, -128,y,128, 128,y,-128, 128,y,-128, -128,y,128, 128,y,128];
    const floor = g.colliders.roadFurniture.meshBody(g.physics, Float32Array.from(corners), layer);
    // Vozy provozu přejdou na Jolt jen s připravenou podlahou v dané dlaždici.
    for (const x of [-128, 0, 128]) for (const z of [-128, 0, 128]) {
      const tile = g.world.chunkIndex(x, z);
      if (!g.colliders.tiles.has(tile)) g.colliders.tiles.set(tile, []);
    }
    g.colliders.tiles.get(g.world.chunkIndex(0, 0)).push(floor);
    g.world.heightAt = g.world.groundY = g.world.surfaceAt = g.world.roadSurfaceY = () => y;
    g.world.isWater = () => false;
    g.player.place(0, 0, y);
  }, layers.STATIC);
}
