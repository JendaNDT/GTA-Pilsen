import { panelLevels, restorePanels } from '../entities/damage.js';
import { Car } from '../entities/vehicles.js';

export const GARAGE = { x: 833, z: 254, yaw: -2.49, name: 'Garáž u hlavního nádraží' };
export const CAR_PRICE = 1350;
export const UPGRADES = {
  brakes: { label: 'Lepší brzdy', price: 325 },
  tires: { label: 'Lepší pneumatiky', price: 360 },
};

function condition(value) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
}

export class Garage {
  constructor(game) {
    this.game = game;
    this.owned = null;
    this.active = null;
  }

  load(saved) {
    if (saved?.model !== 'hatch') return;
    this.owned = {
      model: 'hatch',
      health: condition(saved.health),
      damage: panelLevels(saved.damage),
      upgrades: { brakes: saved.upgrades?.brakes === true, tires: saved.upgrades?.tires === true },
    };
  }

  snapshot() {
    return this.owned && { ...this.owned, damage: panelLevels(this.active ? this.active.damage : this.owned.damage),
      health: condition(this.active?.health ?? this.owned.health) };
  }

  get near() {
    const { focus, mode, world } = this.game;
    return (mode === 'foot' || mode === 'car')
      && Math.hypot(focus.x - GARAGE.x, focus.z - GARAGE.z) < 22
      && Math.abs(world.groundY(GARAGE.x, GARAGE.z) - focus.y) < 5;
  }

  get repairPrice() {
    const damage = 100 - (this.snapshot()?.health ?? 100);
    return damage > 0 ? Math.ceil((75 + damage * 5) / 5) * 5 : 0;
  }

  navigate() {
    this.game.jobs.setWaypoint(GARAGE.x, GARAGE.z, GARAGE.name, true);
  }

  perform(action) {
    const g = this.game;
    const owned = this.snapshot();
    if (!this.near) return 'Nejdřív přijeď ke garáži u hlavního nádraží.';
    if (g.mode !== 'foot') return 'Před použitím garáže vystup z auta.';
    if (action === 'buy' && !owned) {
      if (g.money < CAR_PRICE) return 'Na nákup nemáš dost peněz.';
      const car = { model: 'hatch', health: 100, upgrades: { brakes: false, tires: false } };
      return g.commitAccount({ money: g.money - CAR_PRICE, garage: car }) ? 'Auto je tvoje a čeká v garáži.' : g.saveError;
    }
    if (!owned) return 'Zatím nemáš vlastní auto.';
    if (action === 'retrieve' && !this.active) {
      if (!owned.health) return 'Vůz je nepojízdný. Nejdřív ho oprav.';
      if ([g.player, ...g.vehicles.cars].some((p) => Math.hypot(p.x - GARAGE.x, p.z - GARAGE.z) < 3.8)) {
        return 'Výjezd potřebuje volné místo. Odstup několik kroků a zkus to znovu.';
      }
      const car = new Car(owned.model, 0x397f70);
      car.health = owned.health;
      restorePanels(car, owned.damage);
      car.upgrades = owned.upgrades;
      car.place(GARAGE.x, GARAGE.z, GARAGE.yaw);
      this.active = g.vehicles.add(car);
      g.player.lastCar = car;
      return 'Tvoje auto stojí u garáže.';
    }
    if (action === 'store' && this.active) {
      if (!g.commitAccount({ garage: owned })) return g.saveError;
      g.vehicles.remove(this.active);
      return 'Auto je uložené v garáži.';
    }
    if (this.active) return 'Nejdřív ulož auto do garáže.';
    if (action === 'repair' && this.repairPrice) {
      const price = this.repairPrice;
      if (g.money < price) return 'Na opravu nemáš dost peněz.';
      return g.commitAccount({ money: g.money - price, garage: { ...owned, damage: {}, health: 100 } })
        ? `Opraveno za ${price} Kč.` : g.saveError;
    }
    const upgrade = Object.hasOwn(UPGRADES, action) && UPGRADES[action];
    if (upgrade && !owned.upgrades[action]) {
      if (g.money < upgrade.price) return 'Na úpravu nemáš dost peněz.';
      return g.commitAccount({
        money: g.money - upgrade.price,
        garage: { ...owned, upgrades: { ...owned.upgrades, [action]: true } },
      }) ? `${upgrade.label} jsou namontované.` : g.saveError;
    }
    return 'Tato možnost teď není k dispozici.';
  }

  onRemove(car) {
    if (car !== this.active) return;
    this.owned = this.snapshot();
    this.active = null;
  }

  markers() {
    const car = this.active;
    return [{ x: GARAGE.x, z: GARAGE.z, color: '#6be0bc', size: 5.5 },
      ...(car ? [{ x: car.x, z: car.z, color: '#6be0bc', size: 4 }] : [])];
  }
}
