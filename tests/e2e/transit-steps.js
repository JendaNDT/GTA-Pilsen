import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

export async function boot(page, options = 'view=620&shadows=0', normalTraffic = false) {
  await page.goto(gameUrl('/?debug&' + options));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(normalTraffic => {
    window.__freeze(true);
    const game = window.__game;
    window.__normalTransitTraffic = normalTraffic;
    if (!normalTraffic) {
      for (const car of [...game.vehicles.cars]) game.vehicles.remove(car);
      game.vehicles.spawnTimer = 100_000;
      game.peds.timer = 100_000;
    }
    // Dlouhé intervaly zrychlíme bez přestavování viditelných dlaždic.
    window.__advanceTransit = () => {
      const dt = 0.05, onFoot = game.mode === 'foot';
      game.clock.tick(dt);
      game.world.traffic.tick(dt, onFoot ? game.player : null);
      game.transit.update(dt, game.focus, game.vehicles.cars, onFoot, game.clock);
      // Chodci musí i při zrychleném čekání dokončit přechod a uvolnit jízdní pruh.
      game.peds.update(dt, game.focus, game.camInfo, game.vehicles.cars);
    };
  }, normalTraffic);
}

export async function action(page, code = 'KeyF') {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.__step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }, code);
}

export async function approach(page, id, station, date = '2026-11-09') {
  return page.evaluate(({ id, station, date }) => {
    const g = window.__game, table = g.transit.timetable;
    const day = Date.parse(date) / 86_400_000;
    const event = table.events(day).find(({ trip, day: serviceDay }) => trip.id === id && serviceDay === day);
    const { trip } = event;
    const index = trip.stops.findIndex(({ target }) => target[1] === station);
    const time = index === 0 ? trip.times[1] - 2 : trip.times[index * 2];
    const point = trip.route.posAt(trip.stops[index].target[0], 2.5, {});
    g.player.place(point.x, point.z);
    window.__setClock(date, time / 3600);
    if (!window.__normalTransitTraffic) g.vehicles.spawnTimer = 100_000;
    const vehicle = g.transit.active.get(event.key);
    for (let tick = 0; tick < 440 && !vehicle.visible; tick++) window.__advanceTransit();
    for (let i = 0; i < 7 && vehicle.doorFraction < 0.85; i++) window.__advanceTransit();
    const door = g.transit.exitPoint(vehicle, {});
    g.player.place(door.x, door.z, vehicle.y);
    g.promptTimer = 0;
    window.__step(1 / 60, 2);
    g.updateDepartures();
    return { ref: vehicle.route.ref, doorOpen: vehicle.doorsOpen, boardable: g.transit.boardable(door.x, door.z, vehicle.y) === vehicle };
  }, { id, station, date });
}
