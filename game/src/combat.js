// DUSTLINE combat: pistol shooting by raycast, fists at arm's length, drive-by
// fire from the car window, and health / armor / ammo pickups scattered around
// town that respawn over time. No hitscan magic — every shot is a ray from the
// camera through the crosshair, with a tracer and a muzzle flash you can see.

import * as THREE from 'three';
import { PLAYER, PICKUPS } from './config.js';
import { dist2D } from './util.js';

export class Combat {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.ammo = PLAYER.pistolAmmoStart;
    this.cooldown = 0;
    this.punchCooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.muzzle = new THREE.PointLight(0xffc46a, 0, 18);
    this.scene.add(this.muzzle);
    this.pickups = [];
    this.spawnedAt = new Map();
  }

  /** Place the pickup props from the town's spots. */
  buildPickups(spots) {
    for (const spot of spots) {
      const color = PICKUPS[spot.kind].color;
      const group = new THREE.Group();
      // A floating gem, not a box: it reads as a pickup at a glance.
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.3 }));
      gem.castShadow = true;
      group.add(gem);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.9;
      group.add(ring);
      group.position.set(spot.x, 1.4, spot.z);
      this.scene.add(group);
      this.pickups.push({ kind: spot.kind, x: spot.x, z: spot.z, mesh: group, taken: false, timer: 0 });
    }
  }

  /**
   * Fire the pistol. `origin` is the camera position, `dir` the aim direction,
   * `targets` an array of Walker-likes with .group/.alive/.damage(). Returns the
   * Walker hit (or null) and always spends one bullet + one cooldown.
   */
  shoot(origin, dir, targets) {
    if (this.cooldown > 0 || this.ammo <= 0) return null;
    this.cooldown = PLAYER.shootCooldown;
    this.ammo -= 1;
    this.sound.gunshot();
    this.muzzle.position.copy(origin).addScaledVector(dir, 1.2);
    this.muzzle.intensity = 60;
    this.raycaster.set(origin, dir);
    this.raycaster.far = 90;
    const meshes = [];
    for (const t of targets) {
      if (t.alive) t.group.traverse((o) => { if (o.isMesh) { o.userData.target = t; meshes.push(o); } });
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    const end = origin.clone().addScaledVector(dir, 90);
    let hitTarget = null;
    if (hits.length > 0) {
      const h = hits[0];
      end.copy(h.point);
      hitTarget = h.object.userData.target;
      if (hitTarget) hitTarget.damage(PLAYER.pistolDamage);
    }
    // Tracer: a bright line that fades in a tenth of a second.
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
    return hitTarget;
  }

  /** A swing at arm's length. Returns the Walker hit, if any. */
  punch(px, pz, heading, targets) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = PLAYER.punchCooldown;
    this.sound.punch();
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    for (const t of targets) {
      if (!t.alive) continue;
      const d = dist2D(px, pz, t.x, t.z);
      if (d > PLAYER.punchRange) continue;
      const dot = ((t.x - px) * fx + (t.z - pz) * fz) / Math.max(0.001, d);
      if (dot > 0.35) {
        t.damage(PLAYER.punchDamage);
        return t;
      }
    }
    return null;
  }

  /** Drive-by: auto-aim at the nearest living target within 40 m of the car. */
  driveBy(car, targets) {
    if (this.cooldown > 0 || this.ammo <= 0) return null;
    let best = null;
    let bestD = 40;
    for (const t of targets) {
      if (!t.alive) continue;
      const d = dist2D(car.x, car.z, t.x, t.z);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return null;
    const origin = new THREE.Vector3(car.x, 1.6, car.z);
    const dir = new THREE.Vector3(best.x - car.x, 0.2, best.z - car.z).normalize();
    return this.shoot(origin, dir, targets);
  }

  /** Walk-over pickups. Returns the kind collected, or null. */
  collect(px, pz, state) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (dist2D(px, pz, p.x, p.z) < 2.4) {
        p.taken = true;
        p.timer = PICKUPS[p.kind].respawn;
        p.mesh.visible = false;
        this.sound.pickup();
        if (p.kind === 'health') state.health = Math.min(100, state.health + PICKUPS.health.amount);
        if (p.kind === 'armor') state.armor = Math.min(100, state.armor + PICKUPS.armor.amount);
        if (p.kind === 'ammo') this.ammo += PICKUPS.ammo.amount;
        return p.kind;
      }
    }
    return null;
  }

  update(dt, t) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 500);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / 0.12);
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (const p of this.pickups) {
      if (p.taken) {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.taken = false;
          p.mesh.visible = true;
        }
      } else {
        p.mesh.rotation.y += dt * 1.2;
        p.mesh.position.y = 1.4 + Math.sin(t * 2 + p.x) * 0.15;
      }
    }
  }
}
