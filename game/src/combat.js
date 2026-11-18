// FROSTLINE — combat: pistol, fists, drive-by, tracers, pickups, rival shooters.
import * as THREE from 'three';
import { PICKUPS } from './config.js';
import { rand, pick, clamp, dist2 } from './util.js';
import { heightAt } from './world.js';

export class Combat {
  constructor(G) {
    this.G = G;
    this.tracers = [];
    this.pickups = [];
    this.rivals = [];
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.buildPickups();
  }

  buildPickups() {
    const mats = {
      health: new THREE.MeshBasicMaterial({ color: 0x30e070 }),
      armor: new THREE.MeshBasicMaterial({ color: 0x3a90ff }),
      ammo: new THREE.MeshBasicMaterial({ color: 0xffc030 }),
    };
    for (const pk of PICKUPS) {
      const y = heightAt(pk.x, pk.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mats[pk.kind]);
      mesh.position.set(pk.x, y + 0.9, pk.z);
      mesh.rotation.y = Math.PI / 4;
      this.G.scene.add(mesh);
      this.pickups.push({ ...pk, mesh, taken: false, respawn: 0 });
    }
  }

  // A short-lived glowing line from muzzle to hit point.
  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 }));
    this.G.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  // Fire the pistol from the player toward the aim point (camera forward on the ground plane).
  shoot() {
    const G = this.G, p = G.player;
    if (this.shootCooldown > 0 || p.ammo <= 0) return false;
    this.shootCooldown = 0.28;
    p.ammo--;
    G.audio.gunshot();
    // Aim from the player's facing (camYaw), not the lagging third-person camera:
    // the player aims with the mouse, so the assist follows their intent.
    const dir = new THREE.Vector3(-Math.sin(p.camYaw), 0, -Math.cos(p.camYaw));
    const from = p.inCar
      ? new THREE.Vector3(p.inCar.x, heightAt(p.inCar.x, p.inCar.z) + 1.6, p.inCar.z)
      : new THREE.Vector3(p.x, p.pos.y + 1.5, p.z);
    // Aim assist: snap to the nearest rival or police car inside a generous cone.
    let target = null, bestScore = 0.80;
    const aimAt = (x, z, y) => {
      const v = new THREE.Vector3(x - from.x, y - from.y, z - from.z).normalize();
      return v.dot(dir);
    };
    for (const r of this.rivals) {
      if (r.dead) continue;
      const s = aimAt(r.x, r.z, r.y + 1.2);
      if (s > bestScore) { bestScore = s; target = { x: r.x, y: r.y + 1.2, z: r.z, rival: r }; }
    }
    for (const c of G.wanted.police) {
      if (c.destroyed) continue;
      const s = aimAt(c.x, c.z, c.y + 1.0);
      if (s > bestScore) { bestScore = s; target = { x: c.x, y: c.y + 1.0, z: c.z, car: c }; }
    }
    let end;
    if (target) {
      end = new THREE.Vector3(target.x, target.y, target.z);
      if (target.rival) this.hitRival(target.rival, 34);
      if (target.car) { target.car.damage(22); if (target.car.destroyed) G.wanted.addStars(0, ''); }
    } else {
      // Miss: the tracer runs forward along the aim direction.
      end = from.clone().addScaledVector(dir, 60);
      end.y = Math.max(end.y, heightAt(end.x, end.z) + 0.2);
    }
    this.tracer(from, end);
    // Firing near police draws attention.
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    for (const c of G.wanted.police) {
      if (!c.destroyed && dist2(c.x, c.z, px, pz) < 45) { G.wanted.addStars(1, 'shots fired'); break; }
    }
    G.people.scare(px, pz, 26, 1);
    return true;
  }

  punch() {
    const G = this.G, p = G.player;
    if (this.punchCooldown > 0 || p.inCar) return false;
    this.punchCooldown = 0.45;
    let hit = false;
    for (const r of this.rivals) {
      if (r.dead) continue;
      if (dist2(r.x, r.z, p.x, p.z) < 2.2) { this.hitRival(r, 12); hit = true; }
    }
    for (const ped of G.people.peds) {
      if (dist2(ped.x, ped.z, p.x, p.z) < 2.0) {
        G.people.scare(p.x, p.z, 10, 1);
        G.wanted.addStars(1, 'assault');
        hit = true;
      }
    }
    return hit;
  }

  hitRival(r, dmg) {
    r.hp -= dmg;
    r.flash = 0.12;
    if (r.hp <= 0 && !r.dead) {
      r.dead = true;
      r.mesh.visible = false;
      this.G.missions.onRivalDown();
      this.G.audio.pickup();
    }
  }

  // Spawn armed rivals around a point (mission 5).
  spawnRivals(cx, cz, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), d = rand(8, 20);
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      const y = heightAt(x, z);
      const g = new THREE.Group();
      const coat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.85 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xc9a586, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), coat);
      body.position.y = 1.05; body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
      head.position.y = 1.72;
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x11131a }));
      gun.position.set(0.3, 1.15, 0.4);
      g.add(body, head, gun);
      g.position.set(x, y, z);
      this.G.scene.add(g);
      this.rivals.push({ mesh: g, x, z, y, hp: 60, dead: false, shootTimer: rand(1, 2.5), flash: 0 });
    }
  }

  clearRivals() {
    for (const r of this.rivals) this.G.scene.remove(r.mesh);
    this.rivals = [];
  }

  update(dt) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09);
    }
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) { this.G.scene.remove(t.line); return false; }
      return true;
    });
    // Pickups: bob, spin, collect, respawn.
    const p = this.G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    for (const pk of this.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) { pk.taken = false; pk.mesh.visible = true; }
        continue;
      }
      pk.mesh.rotation.y += dt * 1.5;
      pk.mesh.position.y = heightAt(pk.x, pk.z) + 0.9 + Math.sin(performance.now() / 400 + pk.x) * 0.15;
      if (dist2(px, pz, pk.x, pk.z) < 2.4) {
        pk.taken = true; pk.respawn = 25; pk.mesh.visible = false;
        if (pk.kind === 'health') p.health = clamp(p.health + 40, 0, 100);
        if (pk.kind === 'armor') p.armor = clamp(p.armor + 50, 0, 100);
        if (pk.kind === 'ammo') p.ammo += 24;
        this.G.audio.pickup();
        this.G.hud.flash(pk.kind === 'health' ? '+40 health' : pk.kind === 'armor' ? '+50 armor' : '+24 ammo');
      }
    }
    // Rivals shoot back.
    for (const r of this.rivals) {
      if (r.dead) continue;
      r.flash = Math.max(0, r.flash - dt);
      r.shootTimer -= dt;
      const d = dist2(r.x, r.z, px, pz);
      if (d < 42) {
        r.mesh.lookAt(px, r.y + 1.2, pz);
        if (r.shootTimer <= 0) {
          r.shootTimer = rand(1.8, 3.0);
          const from = new THREE.Vector3(r.x, r.y + 1.4, r.z);
          const to = new THREE.Vector3(px, (p.inCar ? heightAt(px, pz) + 1.2 : p.pos.y + 1.2), pz);
          this.tracer(from, to);
          this.G.audio.gunshot();
          // Hit chance falls off with distance; armor absorbs first.
          if (Math.random() < clamp(0.45 - d / 100, 0.05, 0.35)) this.G.damagePlayer(rand(4, 8));
        }
      }
    }
  }
}
