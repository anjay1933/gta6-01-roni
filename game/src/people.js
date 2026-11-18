// DUSTLINE people: pedestrians strolling the sidewalks who panic when trouble
// starts, foot cops who chase at low wanted levels, and armed rivals for the
// main-street shootout. All low-poly figures, all driven by the same walker.

import * as THREE from 'three';
import { clamp, dist2D, turnToward } from './util.js';

const SKINS = [0xc98d68, 0x8a5a3a, 0xe8b88a, 0x6a4028];
const SHIRTS = [0xd8d0c0, 0x5a7a9a, 0x9a4a3a, 0x4a7a4a, 0x8a6a9a, 0xc0a040];

/** A simple articulated figure: torso, head, hat or cap, two swinging legs. */
export function makePersonModel(shirtColor, skinColor, opts = {}) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 }));
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 }));
  head.position.y = 1.9;
  head.castShadow = true;
  g.add(head);
  if (opts.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.9 }));
    hat.position.y = 2.12;
    g.add(hat);
  }
  if (opts.cap) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.8 }));
    cap.position.y = 1.95;
    g.add(cap);
  }
  const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);
  const legMat = new THREE.MeshStandardMaterial({ color: opts.pants ?? 0x2a3242, roughness: 0.9 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.geometry = legGeo.clone();
  legL.geometry.translate(0, -0.42, 0);
  legL.position.set(0, 0.85, 0.18);
  const legR = legL.clone();
  legR.position.z = -0.18;
  g.add(legL);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.walkPhase = 0;
  return g;
}

export class Walker {
  constructor(scene, x, z, opts = {}) {
    this.scene = scene;
    this.group = makePersonModel(opts.shirt ?? 0xd8d0c0, opts.skin ?? 0xc98d68, opts);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.x = x;
    this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.health = opts.health ?? 100;
    this.kind = opts.kind ?? 'ped';
    this.dead = false;
    this.panic = 0;        // seconds of panic left
    this.wanderTarget = null;
    this.shootCooldown = 0;
    this.walkSpeed = opts.walkSpeed ?? 1.6;
  }

  get alive() { return !this.dead; }

  move(dt, tx, tz, speed) {
    const d = dist2D(this.x, this.z, tx, tz);
    if (d < 0.2) return;
    const want = Math.atan2(-(tz - this.z), tx - this.x);
    this.heading = turnToward(this.heading, want, 5 * dt);
    this.speed = speed;
    this.x += Math.cos(this.heading) * speed * dt;
    this.z += -Math.sin(this.heading) * speed * dt;
    this.group.userData.walkPhase += dt * speed * 3.2;
    const ph = this.group.userData.walkPhase;
    this.group.userData.legL.rotation.x = Math.sin(ph) * 0.55;
    this.group.userData.legR.rotation.x = -Math.sin(ph) * 0.55;
    this.sync();
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  damage(amount) {
    if (this.dead) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.group.rotation.x = -Math.PI / 2; // fall flat
      this.group.position.y = 0.35;
      return true;
    }
    return false;
  }

  remove() {
    this.scene.remove(this.group);
  }
}

/** The crowd: pedestrians wandering the sidewalks, fleeing gunfire and cars. */
export class Crowd {
  constructor(scene, town, rng) {
    this.scene = scene;
    this.town = town;
    this.rng = rng;
    this.peds = [];
    const spots = [
      [-100, -60], [0, -60], [80, -60], [-60, -140], [60, -140],
      [-160, 14], [-40, 14], [120, 14], [-180, 40], [30, -200],
    ];
    for (let i = 0; i < 14; i++) {
      const [sx, sz] = spots[i % spots.length];
      const w = new Walker(scene, sx + (rng() - 0.5) * 20, sz + (rng() - 0.5) * 8, {
        shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
        skin: SKINS[Math.floor(rng() * SKINS.length)],
        hat: rng() < 0.35,
        walkSpeed: 1.2 + rng() * 0.9,
      });
      w.wanderTarget = { x: w.x, z: w.z };
      this.peds.push(w);
    }
  }

  /** Scare everyone near (x, z): they run away from it for a few seconds. */
  scare(x, z, radius, seconds = 5) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (dist2D(p.x, p.z, x, z) >= radius) continue;
      p.panic = Math.max(p.panic, seconds);
      const away = Math.atan2(-(p.z - z), p.x - x);
      p.wanderTarget = { x: p.x + Math.cos(away) * 40, z: p.z - Math.sin(away) * 40 };
    }
  }

  update(dt, playerX, playerZ, playerCar) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (p.panic > 0) {
        p.panic -= dt;
        p.move(dt, p.wanderTarget.x, p.wanderTarget.z, p.walkSpeed * 2.6);
        continue;
      }
      // Wander: pick a new nearby target when the old one is reached.
      if (!p.wanderTarget || dist2D(p.x, p.z, p.wanderTarget.x, p.wanderTarget.z) < 2) {
        const rx = this.rng() * 2 - 1;
        const rz = this.rng() * 2 - 1;
        p.wanderTarget = {
          x: clamp(p.x + rx * 40, -220, 220),
          z: clamp(p.z + rz * 30, -230, 60),
        };
      }
      // Flee a fast car mounting the curb.
      if (playerCar && dist2D(p.x, p.z, playerCar.x, playerCar.z) < 7 && Math.abs(playerCar.speed) > 12) {
        this.scare(playerCar.x, playerCar.z, 12, 4);
        continue;
      }
      p.move(dt, p.wanderTarget.x, p.wanderTarget.z, p.walkSpeed);
      // Buildings are solid for pedestrians too — never walk through a wall.
      const fixed = this.town.resolveCircle(p.x, p.z, 0.6);
      if (fixed.x !== p.x || fixed.z !== p.z) {
        p.x = fixed.x;
        p.z = fixed.z;
        p.sync();
        p.wanderTarget = { x: p.x, z: p.z };
      }
    }
  }

  /** Nearest living ped within range of (x, z). */
  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = dist2D(x, z, p.x, p.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}

/** Armed rivals for the main-street shootout: they take cover and shoot back. */
export class Rivals {
  constructor(scene, town) {
    this.scene = scene;
    this.town = town;
    this.fighters = [];
  }

  spawn(x, z, count, rng) {
    for (let i = 0; i < count; i++) {
      const w = new Walker(this.scene, x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 16, {
        shirt: 0x2a2a2a, skin: 0xc98d68, cap: true, health: 70, kind: 'rival',
        walkSpeed: 2.4,
      });
      // Give each rival a visible pistol.
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 }));
      gun.position.set(0.5, 1.25, 0.25);
      w.group.add(gun);
      this.fighters.push(w);
    }
  }

  update(dt, playerX, playerZ, onShoot) {
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const d = dist2D(f.x, f.z, playerX, playerZ);
      f.shootCooldown -= dt;
      if (d > 26) {
        f.move(dt, playerX, playerZ, f.walkSpeed);
      } else if (d < 8) {
        // Too close: back off while shooting.
        const away = Math.atan2(-(f.z - playerZ), f.x - playerX);
        f.move(dt, f.x + Math.cos(away) * 10, f.z - Math.sin(away) * 10, f.walkSpeed);
      } else {
        f.heading = turnToward(f.heading, Math.atan2(-(playerZ - f.z), playerX - f.x), 4 * dt);
        f.sync();
      }
      // Rivals respect walls as well.
      const fixed = this.town.resolveCircle(f.x, f.z, 0.6);
      if (fixed.x !== f.x || fixed.z !== f.z) {
        f.x = fixed.x;
        f.z = fixed.z;
        f.sync();
      }
      if (d < 30 && f.shootCooldown <= 0) {
        f.shootCooldown = 1.1 + Math.random() * 0.9;
        onShoot(f);
      }
    }
  }

  get aliveCount() {
    return this.fighters.filter((f) => f.alive).length;
  }

  clear() {
    for (const f of this.fighters) f.remove();
    this.fighters = [];
  }
}
