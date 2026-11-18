// FROSTLINE — wanted level, ski-patrol police, roadblocks, heat decay, respray.
import * as THREE from 'three';
import { CFG, GARAGE } from './config.js';
import { clamp, rand, dist2 } from './util.js';
import { heightAt } from './world.js';
import { Car } from './vehicles.js';

export class Wanted {
  constructor(G) {
    this.G = G;
    this.stars = 0;
    this.heat = 0; // seconds since the last crime / police sighting
    this.police = []; // police Car objects
    this.roadblock = null; // {cars: [Car, Car], x, z, until}
    this.bustedTimer = 0;
    this.spawnTimer = 0;
  }

  addStars(n, reason) {
    if (this.stars >= 5) return;
    this.stars = clamp(this.stars + n, 0, 5);
    this.heat = 0;
    this.G.hud.flash(`WANTED +${n} — ${reason}`);
    this.G.audio.siren(this.stars > 0);
    if (this.stars >= 3 && !this.roadblock) this.makeRoadblock();
  }

  setStars(n) {
    this.stars = clamp(n, 0, 5);
    this.heat = 0;
    this.G.audio.siren(this.stars > 0);
    if (this.stars >= 3 && !this.roadblock) this.makeRoadblock();
  }

  clear(reason) {
    this.stars = 0;
    this.heat = 0;
    this.G.audio.siren(false);
    this.despawnPolice();
    if (reason) this.G.hud.flash(reason);
  }

  // Block the road ahead of the player's heading (main street, east side).
  makeRoadblock() {
    const p = this.G.player;
    const bx = clamp(p.x + 45, -140, 140), bz = 0;
    const cars = [];
    for (const off of [-4, 4]) {
      const c = new Car(this.G, 'police', bx + off, bz + (off > 0 ? 3 : -3), Math.PI / 2, { driver: 'police' });
      c.speed = 0;
      cars.push(c);
      this.G.cars.push(c);
    }
    this.roadblock = { cars, x: bx, z: bz, until: performance.now() / 1000 + 60 };
    this.G.hud.flash('ROADBLOCK AHEAD');
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    for (const c of this.roadblock.cars) { c.destroyed = true; c.mesh.visible = false; }
    this.roadblock = null;
  }

  despawnPolice() {
    for (const c of this.police) { c.destroyed = true; c.mesh.visible = false; }
    this.police = [];
    this.clearRoadblock();
  }

  // How many patrol cars the current wanted level fields.
  wantedCarCount() {
    return this.stars <= 1 ? 1 : this.stars === 2 ? 2 : this.stars === 3 ? 3 : 4;
  }

  spawnPolice() {
    const p = this.G.player;
    const want = this.wantedCarCount();
    const alive = this.police.filter((c) => !c.destroyed);
    if (alive.length >= want) return;
    // Spawn on the road, some distance from the player in a random direction.
    const a = rand(Math.PI * 2);
    const sx = clamp(p.x + Math.sin(a) * 55, -200, 200);
    const sz = clamp(p.z + Math.cos(a) * 55, -150, 200);
    const car = new Car(this.G, 'police', sx, sz, Math.atan2(p.x - sx, p.z - sz), { driver: 'police' });
    this.police.push(car);
    this.G.cars.push(car);
  }

  update(dt) {
    const p = this.G.player;
    this.spawnTimer -= dt;
    if (this.stars > 0 && this.spawnTimer <= 0) { this.spawnPolice(); this.spawnTimer = 1.2; }
    // Heat decay: no crime and no police nearby for a while cools one star off.
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    let nearest = 1e9;
    for (const c of this.police) if (!c.destroyed) nearest = Math.min(nearest, dist2(c.x, c.z, px, pz));
    if (this.stars > 0) {
      if (nearest > 70) {
        this.heat += dt;
        if (this.heat > CFG.heatDecaySeconds) {
          this.stars--;
          this.heat = 0;
          this.G.hud.flash(this.stars === 0 ? 'HEAT OFF — you are clean' : `Wanted down to ${this.stars} star${this.stars > 1 ? 's' : ''}`);
          this.G.audio.siren(this.stars > 0);
          if (this.stars < 3) this.clearRoadblock();
          if (this.stars === 0) this.despawnPolice();
        }
      } else this.heat = 0;
    }
    // Busted: a police car touching the player on foot while wanted and slow.
    if (this.stars > 0) {
      const speed = p.inCar ? Math.abs(p.inCar.speed) : 0;
      if (nearest < 3.2 && speed < 2 && !p.inCar) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) { this.bustedTimer = 0; this.G.gameOver('busted'); }
      } else this.bustedTimer = 0;
    }
    // Chase steering for each patrol car.
    for (const c of this.police) {
      if (c.destroyed) continue;
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 260) { c.destroyed = true; c.mesh.visible = false; continue; }
      const wantAngle = Math.atan2(dx, dz);
      const diff = ((wantAngle - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const ctrl = {
        f: d > 6,
        b: false,
        l: diff > 0.15,
        r: diff < -0.15,
        handbrake: false,
      };
      c.update(dt, ctrl);
      // Ram: shove and damage the player's car on contact.
      if (p.inCar && d < 4.2) {
        p.inCar.speed *= 0.92;
        p.inCar.damage(2 * dt * 10);
        if (p.inCar.health <= 0) this.G.gameOver('wasted');
      }
    }
    // Roadblock expiry.
    if (this.roadblock && performance.now() / 1000 > this.roadblock.until) this.clearRoadblock();
    // Respray: at the garage, press G to clear wanted for cash.
    if (this.stars > 0 && dist2(px, pz, GARAGE.x, GARAGE.z) < 10 && this.G.input.g) {
      if (p.cash >= CFG.resprayCost) {
        p.cash -= CFG.resprayCost;
        this.clear('RESPRAYED — wanted cleared');
        this.G.audio.pickup();
      } else this.G.hud.flash('Not enough cash for a respray ($150)');
      this.G.input.g = false;
    }
  }
}
