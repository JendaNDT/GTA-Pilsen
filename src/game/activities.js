import { makeBeacon } from '../entities/models.js';
import { ACTIVITY_COLOR, ACTIVITY_SITES, atActivityPoint } from './activity-sites.js';
import { Minigolf } from './minigolf.js';

const GOLF_SAVE_ID = 'skodaland-minigolf-prvni-jamka';

export class Activities {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.interrupted = null;
    this.interruptedGolf = false;
    this.golf = new Minigolf(game);
  }

  get playingGolf() { return this.active?.kind === 'minigolf'; }

  get title() { return this.playingGolf ? 'Škodaland · minigolf' : this.active?.site.title; }

  get blockingMessage() {
    return this.playingGolf ? 'Nejdřív odejdi z minigolfu.' : 'Nejdřív ukonči zkušební trasu.';
  }

  get path() { return this.playingGolf ? undefined : this.active?.site.trial.path; }

  snapshot() { return this.playingGolf ? GOLF_SAVE_ID : this.active?.site.id ?? null; }

  load(id) {
    this.interruptedGolf = id === GOLF_SAVE_ID;
    this.interrupted = ACTIVITY_SITES.find(site => site.id === id || (this.interruptedGolf && site.golf)) ?? null;
    return this.interrupted?.returnPoint;
  }

  choice() {
    const { player, mode, jobs, shifts, world } = this.game;
    if (mode !== 'foot' || this.playingGolf) return null;
    if (this.active) {
      const reached = atActivityPoint(player, this.active.site.trial.target);
      return reached ? { result: 'completed', label: 'Dokončit zkušební trasu' }
        : { result: 'cancelled', label: 'Ukončit zkušební trasu' };
    }
    if (jobs.job || shifts.active) return null;
    const golf = ACTIVITY_SITES.find(site => site.golf && atActivityPoint(player, site.golf, 2.35));
    const site = golf ?? ACTIVITY_SITES.find(site => atActivityPoint(player, site));
    if (!site || world.onCarriageway(player.x, player.z, player.y)) return null;
    return golf ? { site, kind: 'minigolf', label: 'Zahrát minigolf' } : { site, label: site.startLabel };
  }

  act(choice) {
    if (choice.result) {
      this.end(choice.result);
      return;
    }
    const { site } = choice, g = this.game;
    this.active = { site, kind: choice.kind, elapsed: 0 };
    if (!g.save()) {
      this.active = null;
      g.hud.toast(g.saveError, 'bad');
    } else if (this.playingGolf) {
      const { x, y, z } = g.player;
      g.player.place(x, z, y);
      g.hud.prompt('');
      this.golf.start();
    }
  }

  end(result, save = true) {
    if (!this.active) return;
    const { elapsed } = this.active, g = this.game;
    const minigolf = this.playingGolf;
    if (minigolf) this.golf.end();
    this.active = null;
    if (this.beacon) this.beacon.visible = false;
    g.hud.mission(null);
    if (!save) return;
    if (!minigolf) {
      const message = result === 'completed' ? `Zkušební trasa dokončena za ${Math.max(1, Math.ceil(elapsed))} s.`
        : 'Zkušební trasa ukončena.';
      g.hud.toast(message, 'big');
    }
    if (!g.save()) g.hud.toast(g.saveError, 'bad');
  }

  update(dt) {
    const { active, game } = this, { focus, jobs, shifts } = game;
    this.golf.nearby(focus);
    if (this.playingGolf) {
      if (this.beacon) this.beacon.visible = false;
      this.golf.refresh();
      return;
    }
    const point = active?.site.trial.target ?? (jobs.job || shifts.active ? null : ACTIVITY_SITES.find(site =>
      Math.abs(site.y - focus.y) < 8 && Math.hypot(site.x - focus.x, site.z - focus.z) < 45));
    if (point) {
      if (!this.beacon) {
        this.beacon = makeBeacon(ACTIVITY_COLOR);
        const { beam, ring } = this.beacon.userData;
        beam.scale.set(0.65, 0.05, 0.65);
        beam.position.y = 1.5;
        ring.scale.setScalar(0.44);
        game.scene.add(this.beacon);
      }
      const { position } = this.beacon;
      if (position.x !== point.x || position.z !== point.z) {
        position.set(point.x, game.world.groundY(point.x, point.z), point.z);
      }
    }
    if (this.beacon) this.beacon.visible = Boolean(point);
    if (active) {
      active.elapsed += dt;
      game.hud.mission(`<b>${active.site.title}</b><br>Dojdi k fialové značce a potvrď cíl.`);
    }
  }
}
