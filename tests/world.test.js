import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

test('herní moduly používají vykreslování bez původních úprav shaderů a hlavního sestavení three.js', async () => {
  const root = new URL('../src/', import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]three['"]/u, file);
    assert.doesNotMatch(source, /\b(?:onBeforeCompile|ShaderMaterial|RawShaderMaterial|customProgramCacheKey)\b/u, file);
  }
});

// World používá konfiguraci prohlížeče, tyto testy nepotřebují renderer ani DOM.
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { World, SURF } = await import('../src/world/world.js');
const { TurnRules } = await import('../src/world/turns.js');
const { RC, RF } = await import('../src/config.js');
const { hourlyActivity } = await import('../src/game/traffic-rhythm.js');
const { Traffic } = await import('../src/game/traffic.js');
const { matchCityProfile } = await import('../src/game/traffic-profile-map.js');
const { GameClock, parseDay } = await import('../src/game/clock.js');

function emptyWorld() {
  return Object.assign(Object.create(World.prototype), {
    minX: -256, maxX: 256, minZ: -256, maxZ: 256, cols: 2, rows: 2, gcols: 9, grows: 9,
    obstacles: new Map(), b: {}, bCellStart: new Uint32Array(82), bCellItems: new Uint32Array(),
    th: new Float32Array(4), tX0: 0, tZ0: 0, tCols: 2, tRows: 2, tG: 8,
    bridgeSeg: new Float32Array(), bridgeGrid: new Map(),
  });
}

test('při parkování u koleje rozhoduje směr karoserie a výška mostu', () => {
  const world = emptyWorld();
  world._initRails({
    header: { count: 1 }, x0: [0], z0: [-200], dx: [0], dz: [400], start: [0, 1],
    cls: [0], flags: [RF.BRIDGE], bridgeOff: [0], bridgeY: [250, 250],
  });
  assert.equal(world.blocksTramTrack(3.2, 0, 5, Math.PI / 2, 5, 2), true);
  assert.equal(world.blocksTramTrack(3.2, 0, 5, 0, 5, 2), false);
  assert.equal(world.blocksTramTrack(0, 0, 0, 0, 5, 2), false);
  assert.equal(world.blocksTramTrack(0, 26, 5, 0, 5, 2), false);
});

test('výjezd z křižovatky je volný za odjíždějícím autem, před brzdícím nebo křížícím vozem je obsazený', () => {
  const traffic = Object.create(Traffic.prototype);
  let samples = 0;
  traffic.world = {
    eLen: [40],
    edgePoint(edge, s, lane, point) { samples++; Object.assign(point, { x: lane, z: s }); },
  };
  const driver = { x: 0, y: 0, z: 0, radius: 1 };
  const lead = { x: 0, y: 0, z: 10, radius: 1, halfLen: 2, yaw: 0, vx: 0, vz: 0 };
  const occupied = () => traffic.laneOccupied(driver, 0, 0, 0, 25, [lead], []);
  assert.equal(occupied(), true);
  const firstSamples = samples;
  assert.ok(firstSamples > 0);
  lead.vz = 5;
  assert.equal(occupied(), false);
  lead.physical = { input: { targetSpeed: 0 } };
  assert.equal(occupied(), true);
  Object.assign(lead, { vx: 5, vz: 0, yaw: Math.PI / 2, physical: null });
  assert.equal(occupied(), true);
  assert.equal(samples, firstSamples);
  lead.x = 100;
  assert.equal(occupied(), false);
});

test('řidič, který zastaví nárazníkem 90 cm před stopčárou, po zastavení pokračuje', () => {
  const traffic = Object.assign(Object.create(Traffic.prototype), { time: 10, conflict: () => false });
  const car = { speed: 0 };
  const stop = { kind: 'stop' };
  let speed;
  for (let i = 0; i < 42; i++) speed = traffic.drivingRule(car, stop, 0.45, 1 / 60, 9, []);
  assert.equal(speed, 9);
  assert.ok(car.trafficStop.held >= 0.65);
});

test('auto smí využít volné místo mezi křižovatkou a dalším přechodem', () => {
  const traffic = Object.create(Traffic.prototype), group = {};
  traffic.world = {
    eLen: [20, 80],
    edgePoint(edge, s, lane, p) { Object.assign(p, { x: lane, z: 20 * edge + s }); },
  };
  traffic.crossingsByEdge = new Map([[1, [{ s: 25, crossing: { group } }]]]);
  const car = { edge: 0, lane: 0, next: 1, nextLane: 0, y: 0, radius: 1, halfLen: 2.3, exitPlan: [] };
  const ahead = { x: 0, y: 0, z: 42, radius: 1, halfLen: 2, yaw: 0 };
  const blocked = () => traffic.exitBlocked(car, { edge: 0, s: 12, group }, [ahead], []);
  assert.equal(blocked(), false);
  ahead.z = 31;
  assert.equal(blocked(), true);
  // Přechod těsně za křižovatkou naopak musí zůstat celý volný.
  traffic.crossingsByEdge.get(1)[0].s = 11;
  ahead.z = 36;
  assert.equal(blocked(), true);
});

test('hodinový profil plynule přechází z pracovní doby na víkend i přes půlnoc', () => {
  const friday = parseDay('2026-11-13');
  const clock = new GameClock(friday);
  const profile = { weekday: Array(24).fill(1), weekend: Array(24).fill(0.2) };
  clock.set(friday, 23.5);
  assert.equal(hourlyActivity(profile, clock), 1);
  clock.add(30 * 60 - 1);
  const beforeMidnight = hourlyActivity(profile, clock);
  clock.add(1);
  const midnight = hourlyActivity(profile, clock);
  assert.equal(clock.day, friday + 1);
  assert.ok(Math.abs(midnight - 0.6) < 1e-8);
  assert.ok(Math.abs(beforeMidnight - midnight) < 0.001);
  clock.add(30 * 60);
  assert.equal(hourlyActivity(profile, clock), 0.2);
});

test('městský profil používá azimut detektoru i při opačně zapsané čáře', () => {
  const world = emptyWorld();
  world.meta = { origin: { lat: 0, lon: 0, kx: 1, ky: 1 } };
  world._initRoads({
    header: { count: 2 },
    x0: [0, 1000], z0: [0, 40], dx: [1000, -1000], dz: [0, 0], start: [0, 1, 2],
    cls: [RC.PRIMARY, RC.PRIMARY], flags: [RF.ONEWAY, RF.ONEWAY], w: [6, 6],
  });
  world._initGraph();
  const geometry = { line: [[0, 0], [100, 0]], point: [50, 0] };
  const roads = (heading) => [...matchCityProfile(world, { ...geometry, heading }).keys()].map((edge) => world.eRoad[edge]);
  assert.deepEqual(roads(270), [1]);
  assert.deepEqual(roads(90), [0]);
  assert.deepEqual(roads(0), []);
});

test('odebrání dlaždice zachová kolize ostatních překážek ve sdílené buňce', () => {
  const world = emptyWorld();
  world.addObstacles([1, 1, 0.2]);
  world.addObstacles([2, 2, 0.3]);
  world.removeObstacles([1, 1, 0.2]);
  assert.equal(world.collideCircle(1.05, 1, 0.1, 0.2, 1.7), false);
  assert.equal(world.collideCircle(2.1, 2, 0.35, 0.2, 1.7), true);
  assert.ok(Math.abs(world.hit.x - 2.65) < 1e-6);
  world.removeObstacles([2, 2, 0.3]);
  assert.equal(world.obstacles.size, 0);
});

test('překážky se stejnými souřadnicemi se odebírají jednotlivě včetně poloměru', () => {
  const world = emptyWorld();
  world.addObstacles([-1, -1, 0.2, -1, -1, 0.2]);
  world.addObstacles([-1, -1, 0.3]);
  world.removeObstacles([-1, -1, 0.2]);
  assert.deepEqual([...world.obstacles.values()], [[-1, -1, 0.2, -1, -1, 0.3]]);
  world.removeObstacles([-1, -1, 0.7, 50, 50, 1]);
  assert.equal(world.collideCircle(-1.1, -1, 0.1, 0.2, 1.7), true);
  world.removeObstacles([-1, -1, 0.2, -1, -1, 0.3]);
  assert.equal(world.obstacles.size, 0);
});

test('výška terénu odpovídá oběma trojúhelníkům vykreslené sítě', () => {
  const world = emptyWorld();
  world.th.set([0, 0, 0, 8]);
  assert.equal(world.heightAt(2, 2), 0);
  assert.equal(world.heightAt(6, 6), 4);
  assert.equal(world.heightAt(4, 4), 0);
  assert.equal(world.heightAt(-20, -20), 0);
});

test('jemný terén interpoluje odchylku stejnou úhlopříčkou jako vykreslená síť', () => {
  const world = emptyWorld();
  world.minX = 0; world.minZ = 0;
  const offsets = new Int8Array(65 ** 2);
  offsets[1] = 30;
  offsets[65] = 50;
  offsets[66] = -20;
  world._initTerrainDetail({ header: { g: 4, q: 0.05, x0: 0, z0: 0, cols: 2 },
    tiles: Uint32Array.of(0), offsets });
  assert.equal(world.heightAt(1, 1), 1);
  assert.equal(world.heightAt(3, 3), 0.5);
  assert.equal(world.heightAt(257, 1), 0);
});

test('pod mostem zůstává hráč na terénu, na mostě se drží mostovky', () => {
  const world = emptyWorld();
  world.bridgeSeg = Float32Array.from([0, 0, 8, 16, 0, 8, 2, 0]);
  world.bridgeGrid.set(0, [0]);
  assert.equal(world.groundY(8, 0, 0), SURF);
  assert.equal(world.groundY(8, 0, 8), 8);
  assert.equal(world.groundY(8, 4, 8), SURF);
});

test('navigace respektuje jednosměrku a nezařazuje pěšiny do silničního grafu', () => {
  const world = emptyWorld();
  world._initRoads({
    header: { count: 4 },
    x0: [-1000, 0, 0, 0], z0: [0, 0, 0, 0],
    dx: [1000, 1000, 0, 0], dz: [0, 0, -1000, 1000], start: [0, 1, 2, 3, 4],
    cls: [RC.RESIDENTIAL, RC.RESIDENTIAL, RC.PATH, RC.SERVICE],
    flags: [RF.ONEWAY, 0, 0, 0], w: [6, 6, 2, 4],
  });
  world._initGraph();
  const west = world.nearestNode(-100, 0, 10), east = world.nearestNode(100, 0, 10);
  const path = world.findPath(west, east);
  assert.equal(path.length, 2);
  assert.equal(path.reduce((sum, edge) => sum + world.eLen[edge], 0), 200);
  assert.equal(world.findPath(east, west), null);
  assert.equal(world.nearestNode(0, -100, 10), -1);
  assert.deepEqual(world.findPath(east, east), []);
  assert.equal(world.findPath(-1, east), null);
});

test('zákaz přes mezilehlý úsek platí jen po příjezdu z určené silnice', () => {
  const world = emptyWorld();
  world._initRoads({
    header: { count: 4 },
    x0: [-1000, 0, 1000, 0], z0: [0, 0, 0, -1000],
    dx: [1000, 1000, 0, 0], dz: [0, 0, 1000, 1000], start: [0, 1, 2, 3, 4],
    cls: [RC.RESIDENTIAL, RC.RESIDENTIAL, RC.RESIDENTIAL, RC.RESIDENTIAL],
    flags: [RF.ONEWAY, RF.ONEWAY, RF.ONEWAY, RF.ONEWAY], w: [6, 6, 6, 6],
  });
  world._initGraph();
  world.turns = new TurnRules(world, [{ kind: 'no_right_turn', from: [0], via: [[1]], to: [2] }]);
  const [from, via, to, side] = [0, 1, 2, 3].map((road) => world.eRoad.indexOf(road));
  const context = world.turnContext(from, via);
  assert.ok(context > 0);
  assert.equal(world.turnContext(via, to, context), -1);
  assert.equal(world.turnContext(via, to, world.turnContext(side, via)), 0);
  assert.equal(world.findPath(world.eFrom[from], world.eTo[to]), null);
  assert.deepEqual(world.findPath(world.eFrom[side], world.eTo[to]), [side, via, to]);
});

test('pěší kapsle se u země vysune od sloupu a nad sloupem má volno', () => {
  const world = emptyWorld();
  world.addObstacles([2, 1, 0.15]);
  const hit = { x: 2.1, z: 1, depth: 0 };
  assert.equal(world.collideStreetObjects(hit, 0.35, 0.15), true);
  assert.equal(hit.x, 2.5);
  hit.x = 2.1;
  assert.equal(world.collideStreetObjects(hit, 0.35, 3), false);
  assert.equal(hit.x, 2.1);
});
test('před levým odbočením řidič nechá projet rozjetý protisměr a vedlejší průběžný pruh zůstává volný', () => {
  const traffic = Object.create(Traffic.prototype), group = {};
  const head = { group, tx: 0, tz: 1 }, opposite = { group, tx: 0, tz: -1 };
  const first = { control: head, lane: -1.8, left: true };
  const leader = { mode: 'ai', junctionMovement: first };
  const driver = { type: { wid: 1.8 } };
  const waiting = (control, lane, left) => traffic.turnInProgress(driver, { control, lane, left }, [leader]);
  assert.equal(waiting(opposite, 1.8, true), first);
  assert.equal(waiting(head, -1.8, false), first);
  assert.equal(waiting(head, 1.8, false), undefined);
  assert.equal(waiting(opposite, 1.8, false), undefined);
  Object.assign(leader, { edge: 2, s: 1, plannedTurn: { from: 2, to: 3, sign: -1, entry: 2 } });
  assert.equal(waiting(opposite, 1.8, false), undefined);
  leader.s = 2.1;
  assert.equal(waiting(opposite, 1.8, false), first);
  leader.junctionMovement = null;
  assert.equal(waiting(opposite, 1.8, true), undefined);
});

test('před zúžením do jednoho pruhu řidič nechá místo sousednímu autu, které už vjíždí', () => {
  const traffic = Object.create(Traffic.prototype);
  const control = { group: {}, edge: 1, s: 40, tx: 0, tz: 1 };
  const entering = { control, edge: 2, lane: 1.8, exitLane: 0, left: false };
  const other = { mode: 'ai', edge: 1, s: 37, halfLen: 2, trafficStop: { entering: true, movement: entering } };
  const driver = { type: { wid: 1.8 } };
  const waiting = exitLane => traffic.turnInProgress(driver, { ...entering, lane: -1.8, exitLane }, [other]);
  assert.equal(waiting(0), entering);
  assert.equal(waiting(-1.8), undefined);
  other.trafficStop.entering = false;
  assert.equal(waiting(0), undefined);
  other.junctionMovement = entering;
  assert.equal(waiting(0), entering);
});

test('po obnovení dlaždice má každý semafor a značka stejné vlastní ID a zachová poškození', async () => {
  const { Breakables } = await import('../src/physics/breakables.js');
  const registry = new Breakables();
  const rebuild = (tiles) => {
    const traffic = Object.create(Traffic.prototype);
    traffic.world = { chunkIndex: x => x };
    traffic.chunks = new Map();
    for (const tile of tiles) {
      for (const kind of ['signs', 'heads', 'signs']) {
        traffic.addVisual(tile, 0, kind, { x: tile + 1, z: 0 });
      }
    }
    return traffic.chunks;
  };
  const ids = tile => [...tile.signs, ...tile.heads].map(entry => entry.breakableId);
  const initial = rebuild([7, 8]);
  const [first, second, head] = ids(initial.get(7));
  assert.equal(new Set([...ids(initial.get(7)), ...ids(initial.get(8))]).size, 6);
  const hour = 3600;
  assert.equal(registry.damage(first, 'bent', 2 * hour), true);
  assert.equal(registry.damage(first, 'broken', 3 * hour), true);
  assert.equal(registry.damage(first, 'bent', 4 * hour), false);
  assert.equal(registry.damage(first, 'broken', 27 * hour), false);
  const restored = ids(rebuild([8, 7]).get(7));
  assert.deepEqual(restored, [first, second, head]);
  assert.deepEqual(restored.map(id => registry.state(id)), ['broken', 'intact', 'intact']);
  assert.deepEqual(registry.repairDue(28 * hour - 1), []);
  assert.deepEqual(registry.repairDue(28 * hour), [first]);
  assert.equal(registry.state(first), 'intact');
  assert.deepEqual(registry.repairDue(29 * hour), []);
});

test('po zhasnutí semaforů řidič zpomalí a dá přednost zprava až do opravy', async () => {
  const { Breakables } = await import('../src/physics/breakables.js');
  const registry = new Breakables(), traffic = Object.create(Traffic.prototype);
  Object.assign(traffic, { time: 3, users: new Map(), world: { breakables: registry }, exitBlocked: () => false });
  const group = { x: 0, z: 0, greenTime: 15, hasSecond: true, crossings: [], clearance: 0, timeOffset: 0,
    fixtures: ['signal/1/0', 'signal/1/1'] };
  const approach = { kind: 'signal', group, axis: 0, tx: 0, tz: -1, edge: 1 };
  const rightHead = { kind: 'signal', group, axis: 1 };
  const driver = { x: 0, y: 0, z: 12, speed: 0 };
  const fromRight = { x: 10, y: 0, z: 0, vx: -4, vz: 0 };
  const fromLeft = { x: -10, y: 0, z: 0, vx: 4, vz: 0 };
  const solve = other => traffic.drivingRule(driver, approach, 0, 1 / 60, 12, [other]);
  assert.equal(solve(fromRight), 12);
  assert.equal(traffic.light(rightHead), 'red');
  registry.damage('signal/1/1', 'broken', 0);
  assert.equal(traffic.light(approach), 'off');
  assert.equal(traffic.light(rightHead), 'off');
  assert.equal(solve(fromRight), 0);
  assert.equal(solve({ ...fromRight, vx: 4 }), 5.5);
  assert.equal(solve(fromLeft), 5.5);
  assert.equal(solve({ ...fromLeft, x: -1 }), 0);
  registry.repairDue(28 * 3600);
  assert.equal(solve(fromRight), 12);
  assert.equal(traffic.light(approach), 'green');
});
