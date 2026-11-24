// Počítadla pro desetiminutové pozorování v Chromiu.
export function installTrafficMonitor() {
  window.observeTraffic = game => {
    const traffic = game.world.traffic;
    const ids = new WeakMap();
    let nextId = 0;
    const id = object => {
      if (!ids.has(object)) ids.set(object, ++nextId);
      return ids.get(object);
    };
    const signals = new Map(traffic.controls.filter(head => head.directedHead && head.group &&
      Math.hypot(head.x - game.player.x, head.z - game.player.z) <= 200).map(head =>
      [head, { green: false, count: 0, entries: 0, cars: new Set() }]));
    const enter = traffic.enterJunction.bind(traffic);
    traffic.enterJunction = (vehicle, head) => {
      const signal = signals.get(head);
      if (signal && vehicle.mode === 'ai' && traffic.light(head) === 'green' && !signal.cars.has(vehicle)) {
        signal.cars.add(vehicle);
        signal.entries++;
      }
      enter(vehicle, head);
    };
    let incidents = 0;
    const lastHit = new Map(), damaged = new Set();
    const crash = game.onCrash.bind(game);
    game.onCrash = (car, impact, other) => {
      if ((car.mode === 'ai' || car.wasAI === 'ai' || other?.mode === 'ai' || other?.wasAI === 'ai') &&
          Math.hypot(car.x - game.player.x, car.z - game.player.z) <= 200) {
        const a = id(car), b = other ? id(other) : 0;
        const key = Math.min(a, b) + '/' + Math.max(a, b);
        if (traffic.time - (lastHit.get(key) ?? -Infinity) > 1) incidents++;
        lastHit.set(key, traffic.time);
        damaged.add(a);
        if (b) damaged.add(b);
      }
      crash(car, impact, other);
    };
    return {
      lights() {
        for (const [head, signal] of signals) {
          const green = traffic.light(head) === 'green';
          if (green && !signal.green) signal.count++;
          if (!green && signal.green) signal.cars.clear();
          signal.green = green;
        }
      },
      totals() {
        const heads = [...signals].map(([head, s]) => ({ id: head.id, edge: head.edge, greens: s.count, entries: s.entries }));
        return { heads, incidents, damagedVehicles: damaged.size };
      },
    };
  };
}
