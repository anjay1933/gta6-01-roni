// DUSTLINE wanted system: 1–5 stars, police cars that chase and ram, foot cops
// at low heat, roadblocks at 3+ stars, stars that decay when the law loses sight
// of you, and a respray garage that washes the heat away for cash.

import { Car } from './vehicles.js';
import { WANTED } from './config.js';
import { clamp, dist2D, angleDiff } from './util.js';

export class Wanted {
  constructor(scene, town, rng, sound) {
    this.scene = scene;
    this.town = town;
    this.rng = rng;
    this.sound = sound;
    this.stars = 0;
    this.outOfSight = 0;   // seconds since any cop last saw the player
    this.cops = [];        // police Car instances
    this.footCops = [];    // Walker instances (created by main, updated here)
    this.spawnTimer = 0;
    this.roadblockCars = [];
    this.roadblockAt = null;
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, WANTED.maxStars);
    if (this.stars > before) this.outOfSight = 0;
    return this.stars;
  }

  clear() {
    this.stars = 0;
    this.outOfSight = 0;
    this.despawnAll();
  }

  despawnAll() {
    for (const c of this.cops) c.remove(this.scene);
    this.cops = [];
    for (const c of this.roadblockCars) c.remove(this.scene);
    this.roadblockCars = [];
    this.roadblockAt = null;
  }

  nearestCopDist(px, pz) {
    let best = Infinity;
    for (const c of [...this.cops, ...this.roadblockCars]) {
      best = Math.min(best, dist2D(px, pz, c.x, c.z));
    }
    return best;
  }

  /** Spawn a police car on the highway near (but not on top of) the player. */
  spawnCop(px, pz) {
    const angle = this.rng() * Math.PI * 2;
    const d = 55 + this.rng() * 35;
    let x = clamp(px + Math.cos(angle) * d, -440, 440);
    let z = clamp(pz + Math.sin(angle) * d, -220, 220);
    // Keep cops on a road: snap to the highway when close to it.
    if (Math.abs(z) < 40) z = this.rng() < 0.5 ? 3.5 : -3.5;
    const car = new Car(this.scene, 'police', x, z, this.rng() * Math.PI * 2);
    car.driver = 'police';
    this.cops.push(car);
    return car;
  }

  /** A roadblock: two police cars parked across the highway ahead of the player. */
  setRoadblock(px, pz, heading) {
    this.clearRoadblock();
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    const bx = px + fx * 70;
    const bz = pz + fz * 70;
    const rx = -fz;
    const rz = fx;
    for (const off of [-4, 4]) {
      const car = new Car(this.scene, 'police', bx + rx * off, bz + rz * off, heading + Math.PI / 2);
      car.driver = 'police';
      this.roadblockCars.push(car);
    }
    this.roadblockAt = { x: bx, z: bz };
  }

  clearRoadblock() {
    for (const c of this.roadblockCars) c.remove(this.scene);
    this.roadblockCars = [];
    this.roadblockAt = null;
  }

  /**
   * Per-frame update. `player` is { x, z, car|null, speed } and `onBusted` fires
   * when a cop catches the player on foot, `onRam` when one rams the player's car.
   * The HUD reads this.stars directly.
   */
  update(dt, player, onBusted, onRam) {
    const targetCops = this.stars === 0 ? 0 : Math.min(1 + this.stars, 5);
    this.spawnTimer -= dt;
    if (this.cops.length < targetCops && this.spawnTimer <= 0) {
      this.spawnCop(player.x, player.z);
      this.spawnTimer = 2.5;
    }
    // Too many cops (stars fell): send the extras home.
    while (this.cops.length > targetCops) {
      const c = this.cops.pop();
      c.remove(this.scene);
    }
    // Roadblocks at 3+ stars, parked across the player's heading.
    if (this.stars >= WANTED.roadblockAt && !this.roadblockAt) {
      const heading = player.car ? player.car.heading : player.heading;
      this.setRoadblock(player.x, player.z, heading);
    } else if (this.stars < WANTED.roadblockAt && this.roadblockAt) {
      this.clearRoadblock();
    }
    // Chase: each cop steers at the player and rams.
    for (const cop of this.cops) {
      const d = dist2D(cop.x, cop.z, player.x, player.z);
      const want = Math.atan2(-(player.z - cop.z), player.x - cop.x);
      const steer = clamp(angleDiff(cop.heading, want) * 1.8, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      cop.drive(throttle, steer, dt);
      cop.updateSmoke(dt);
      if (d < 4.2) {
        if (player.car) {
          onRam(cop);
        } else if (this.stars >= 1) {
          onBusted();
          return;
        }
      }
    }
    // Decay: stars drop when no cop can see the player for a while.
    const nearest = this.nearestCopDist(player.x, player.z);
    if (this.stars > 0 && nearest > 60) {
      this.outOfSight += dt;
      if (this.outOfSight > WANTED.decaySeconds) {
        this.stars -= 1;
        this.outOfSight = 0;
      }
    } else {
      this.outOfSight = 0;
    }
    this.sound.siren(this.stars > 0 && nearest < 120, dt);
  }
}
