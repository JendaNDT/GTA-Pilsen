import { makeBeacon } from '../entities/models.js';
import { ACTIVITY_COLOR, ACTIVITY_SITES, atActivityPoint } from './activity-sites.js';

export class Activities {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.interrupted = null;
  }

  get path() { return this.active?.site.trial.path; }

  snapshot() { return this.active?.site.id ?? null; }

  load(id) {
    this.interrupted = ACTIVITY_SITES.find(site => site.id === id) ?? null;
    return this.interrupted?.returnPoint;
  }

  choice() {
    const { player, mode, jobs, shifts, world } = this.game;
    if (mode !== 'foot') return null;
    if (this.active) {
      const reached = atActivityPoint(player, this.active.site.trial.target);
      return reached ? { result: 'completed', label: 'Dokončit zkušební trasu' }
        : { result: 'cancelled', label: 'Ukončit zkušební trasu' };
    }
    if (jobs.job || shifts.active) return null;
    const site = ACTIVITY_SITES.find(site => atActivityPoint(player, site));
    return site && !world.onCarriageway(player.x, player.z, player.y) ? { site, label: site.startLabel } : null;
  }

  act(choice) {
    if (choice.result) {
      this.end(choice.result);
      return;
    }
    const { site } = choice, g = this.game;
    this.active = { site, elapsed: 0 };
    if (!g.save()) {
      this.active = null;
      g.hud.toast(g.saveError, 'bad');
    }
  }

  end(result, save = true) {
    if (!this.active) return;
    const { elapsed } = this.active, g = this.game;
    this.active = null;
    if (this.beacon) this.beacon.visible = false;
    g.hud.mission(null);
    if (!save) return;
    const message = result === 'completed' ? `Zkušební trasa dokončena za ${Math.max(1, Math.ceil(elapsed))} s.`
      : 'Zkušební trasa ukončena.';
    g.hud.toast(message, 'big');
    if (!g.save()) g.hud.toast(g.saveError, 'bad');
  }

  update(dt) {
    const { active, game } = this, { focus, jobs, shifts } = game;
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
