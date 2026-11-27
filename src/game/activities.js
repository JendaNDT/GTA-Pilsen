import { makeBeacon } from '../entities/models.js';
import { ACTIVITY_COLOR, ACTIVITY_SITES, atActivityPoint } from './activity-sites.js';
import { Minigolf } from './minigolf.js';
import { TargetPractice } from './target-practice.js';
import { Bowling } from './bowling.js';

const GOLF_SAVE_ID = 'skodaland-minigolf-kolo';

export class Activities {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.interrupted = null;
    this.interruptedGolf = false;
    this.golf = new Minigolf(game);
    this.bowling = new Bowling(game);
  }

  get playingGolf() { return this.active?.kind === 'minigolf'; }

  get playingBowling() { return this.active?.kind === 'bowling'; }

  get playingTargets() { return this.active?.kind === 'targets'; }

  get title() { return this.playingGolf ? 'Škodaland · minigolf' : this.active?.site.title; }

  get blockingMessage() {
    if (this.playingTargets) return 'Nejdřív ukonči trénink v Lobzích.';
    if (this.playingBowling) return 'Nejdřív odejdi z bowlingu.';
    return this.playingGolf ? 'Nejdřív odejdi z minigolfu.' : 'Nejdřív ukonči zkušební trasu.';
  }

  get path() { return this.playingGolf ? undefined : this.active?.site.trial?.path; }

  snapshot() {
    if (this.playingGolf) return this.golf.saved ? null : GOLF_SAVE_ID;
    if (this.playingBowling && this.bowling.saved) return null;
    return this.active?.site.id ?? null;
  }

  load(id) {
    this.interruptedGolf = id === GOLF_SAVE_ID || id === 'skodaland-minigolf-prvni-jamka';
    this.interrupted = ACTIVITY_SITES.find(site => site.id === id || (this.interruptedGolf && site.golf)) ?? null;
    return this.interrupted?.returnPoint;
  }

  choice() {
    const { player, mode, jobs, shifts, world } = this.game;
    if (mode !== 'foot' || this.playingBowling || this.playingTargets) return null;
    if (this.playingGolf) {
      const entry = this.golf.nextEntry;
      if (!entry || !atActivityPoint(player, entry, 1.55) || world.onCarriageway(player.x, player.z, player.y)) return null;
      const next = this.golf.round.scores.length + 1;
      return { nextHole: true, label: `Hrát jamku ${next}` };
    }
    if (this.active) {
      const reached = atActivityPoint(player, this.active.site.trial.target);
      return reached ? { result: 'completed', label: 'Dokončit zkušební trasu' }
        : { result: 'cancelled', label: 'Ukončit zkušební trasu' };
    }
    if (jobs.job || shifts.active) return null;
    const golf = ACTIVITY_SITES.find(site => site.golf && atActivityPoint(player, site.golf, 2.35));
    const site = golf ?? ACTIVITY_SITES.find(site => atActivityPoint(player, site));
    if (!site || world.onCarriageway(player.x, player.z, player.y)) return null;
    if (golf) return { site, kind: 'minigolf', label: 'Zahrát minigolf' };
    return { site, kind: site.bowling ? 'bowling' : site.targets ? 'targets' : undefined, label: site.startLabel };
  }

  act(choice) {
    if (choice.nextHole) return this.golf.enterHole();
    if (choice.result) {
      this.end(choice.result);
      return;
    }
    const { site } = choice, g = this.game;
    this.active = { site, kind: choice.kind, elapsed: 0 };
    if (!g.save()) {
      this.active = null;
      g.hud.toast(g.saveError, 'bad');
    } else if (this.playingTargets) {
      this.targets ??= new TargetPractice(() => this.end('cancelled'));
      this.targets.start();
    } else if (this.playingGolf) {
      this.golf.start();
    } else if (this.playingBowling) {
      this.bowling.start();
    }
  }

  end(result, save = true) {
    if (!this.active) return;
    const { elapsed } = this.active, g = this.game;
    const minigolf = this.playingGolf, bowling = this.playingBowling;
    const targets = this.playingTargets;
    if (targets) this.targets.end();
    if (minigolf) this.golf.end();
    if (bowling) this.bowling.end();
    this.active = null;
    if (this.beacon) this.beacon.visible = false;
    g.hud.mission(null);
    if (!save) return;
    if (!minigolf && !bowling && !targets) {
      const message = result === 'completed' ? `Zkušební trasa dokončena za ${Math.max(1, Math.ceil(elapsed))} s.`
        : 'Zkušební trasa ukončena.';
      g.hud.toast(message, 'big');
    }
    if (!g.save()) g.hud.toast(g.saveError, 'bad');
  }

  update(dt) {
    if (this.playingBowling || this.playingTargets) return;
    const { active, game } = this, { focus, jobs, shifts } = game;
    this.golf.nearby(focus);
    const golf = this.playingGolf;
    if (golf) this.golf.refresh();
    const point = golf ? this.golf.nextEntry : active?.site.trial.target ??
      (jobs.job || shifts.active ? null : ACTIVITY_SITES.find(site =>
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
    if (active && !golf) {
      active.elapsed += dt;
      game.hud.mission(`<b>${active.site.title}</b><br>Dojdi k fialové značce a potvrď cíl.`);
    }
  }
}
