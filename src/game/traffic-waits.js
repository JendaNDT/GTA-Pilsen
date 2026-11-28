import { getRandomSeed } from './random.js';

// Důvod čekání je platný jen krátce po příslušném rozhodnutí řidiče.
// Slabé odkazy dovolí hře vyřadit vozy, které opustily načtené město.
export function createTrafficWaits(game) {
  const traffic = game.world.traffic;
  const ids = new WeakMap();
  let nextId = 0;
  const id = object => {
    if (!ids.has(object)) ids.set(object, ++nextId);
    return ids.get(object);
  };
  const reasons = new WeakMap();
  let enabled = false;
  function wait(vehicle, reason, blocker = null) {
    const existing = reasons.get(vehicle);
    if (existing?.reason === reason && existing.blocker === blocker) existing.time = traffic.time;
    else reasons.set(vehicle, { reason, blocker, time: traffic.time });
  }
  const obstacle = (vehicle, other) => {
    if (other) wait(vehicle, 'překážka v dráze', other);
    else reasons.delete(vehicle);
  };
  const yieldTo = (vehicle, other) => wait(vehicle, 'přednost při odbočení', other);
  const ruleWait = (car, rule, color, cars, extra, checkExit) => {
    const state = car.trafficStop;
    if (color === 'red') return wait(car, 'červená');
    if (color === 'amber') return wait(car, 'žlutá');
    if (color === 'off' && state.rightBlocker) return wait(car, 'přednost zprava', state.rightBlocker);
    if (rule.kind === 'stop' && state.held < 0.65) return wait(car, 'povinné zastavení');
    const participants = [...cars, ...extra];
    if (rule.kind !== 'signal') {
      const other = participants.find(o => traffic.conflict(car, rule, [o], []));
      if (other) return wait(car, 'přednost na křižovatce', other);
    }
    if (state.yieldingTo) {
      const other = cars.find(o => o.junctionMovement === state.yieldingTo || o.trafficStop?.movement === state.yieldingTo);
      return wait(car, 'průjezd křižovatkou', other ?? state.yieldingTo);
    }
    const other = checkExit && participants.find(o => traffic.exitBlocked(car, rule, [o], []));
    if (other) return wait(car, 'obsazený výjezd', other);
    wait(car, color === 'off' ? 'vypnutý semafor' : 'řízení křižovatky');
  };
  const observer = {
    setEnabled(active) {
      if (active === enabled) return;
      enabled = active;
      game.vehicles.onObstacle = game.transit.onObstacle = active ? obstacle : null;
      game.vehicles.onYield = traffic.onTransitYield = active ? yieldTo : null;
      traffic.onRuleWait = active ? ruleWait : null;
      traffic.onCrossingWait = active ? car => wait(car, 'chodec na přechodu') : null;
    },
    chain(start) {
      const result = [], visited = new Set();
      let current = start;
      while (current) {
        const car = game.transit.vehicles.find(v => v.footprints.includes(current)) ?? current;
        const entry = { id: id(car), type: car.typeId ?? car.route?.type ?? (car === game.player ? 'hráč' : 'překážka'),
          x: car.x, z: car.z, yaw: car.yaw, edge: car.edge, next: car.next, lane: car.lane, progress: car.s,
          speed: car.speed ?? car.v, line: car.route?.ref, street: car.edge >= 0 ? game.world.roadNames[game.world.r.name[game.world.eRoad[car.edge]]] : undefined };
        result.push(entry);
        if (visited.has(car)) { entry.reason = 'cyklus'; break; }
        visited.add(car);
        const last = reasons.get(car);
        const link = enabled && last && traffic.time - last.time < 0.12 ? last : null;
        if (car.doorsOpen) entry.reason = 'pobyt na zastávce';
        else if (car.mode === 'parked' || car.mode === 'loose') entry.reason = car.crashed ? 'havarovaný vůz' : 'stojící vůz';
        else if (Math.abs(car.speed ?? car.v ?? 0) > 0.5) entry.reason = 'v pohybu';
        else if (link) entry.reason = link.reason;
        else entry.reason = 'příčina nezjištěna';
        current = entry.reason === link?.reason ? link.blocker : null;
      }
      return result;
    },
    queues(minimum = 60) {
      const seed = getRandomSeed();
      const waiting = game.vehicles.cars.filter(car => car.mode === 'ai' && car.blocked >= minimum);
      const transit = game.transit.vehicles.filter(v => v.visible && v.stoppedInTraffic >= minimum);
      const queues = [...waiting, ...transit].map(car => ({
        seed, seconds: Math.floor(car.blocked ?? car.stoppedInTraffic), chain: observer.chain(car),
      })).sort((a, b) => b.seconds - a.seconds);
      return Object.assign(queues, { seed });
    },
  };
  observer.setEnabled(true);
  return observer;
}
