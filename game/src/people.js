// FROSTLINE — pedestrians and traffic: townsfolk who stroll, panic, and flee.
import * as THREE from 'three';
import { PEDS } from './config.js';
import { rand, pick, clamp, dist2 } from './util.js';
import { heightAt, collide } from './world.js';
import { Car, trafficControl } from './vehicles.js';

const COATS = [0x3a5a8a, 0x8a3a3a, 0x3a6b4a, 0x6b4a8a, 0x8a6b3a, 0x37424f];

export class People {
  constructor(G) {
    this.G = G;
    this.peds = [];
    this.traffic = [];
    const coatGeo = new THREE.BoxGeometry(0.55, 0.8, 0.32);
    const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.24);
    for (const [x, z] of PEDS) {
      const coat = new THREE.MeshStandardMaterial({ color: pick(COATS), roughness: 0.9 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.9 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(coatGeo, coat); body.position.y = 1.0; body.castShadow = true;
      const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.62; head.castShadow = true;
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, 1.1), dark);
      hat.position.y = 1.68;
      const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.14, 0.3, 0);
      const legR = legL.clone(); legR.position.x = 0.14;
      g.add(body, head, hat, legL, legR);
      const y = heightAt(x, z);
      g.position.set(x, y, z);
      G.scene.add(g);
      this.peds.push({
        mesh: g, legL, legR, x, z, y,
        angle: rand(Math.PI * 2), speed: rand(1.2, 2.2),
        panic: 0, targetX: x, targetZ: z, retarget: 0,
      });
    }
  }

  // Panic: make the peds near (x, z) flee away from it.
  scare(x, z, radius = 22, strength = 1) {
    for (const p of this.peds) {
      const d = dist2(p.x, p.z, x, z);
      if (d < radius) {
        p.panic = Math.max(p.panic, strength * (1 - d / radius) * 6);
        const a = Math.atan2(p.x - x, p.z - z);
        p.targetX = p.x + Math.sin(a) * 30;
        p.targetZ = p.z + Math.cos(a) * 30;
      }
    }
  }

  update(dt, t) {
    for (const p of this.peds) {
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.retarget = rand(4, 9);
        const a = rand(Math.PI * 2), d = rand(8, 26);
        p.targetX = clamp(p.x + Math.sin(a) * d, -180, 180);
        p.targetZ = clamp(p.z + Math.cos(a) * d, -140, 160);
      }
      const dx = p.targetX - p.x, dz = p.targetZ - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const sp = p.panic > 0 ? p.speed * 2.6 : p.speed;
        p.x += (dx / d) * sp * dt;
        p.z += (dz / d) * sp * dt;
        p.angle = Math.atan2(dx, dz);
      }
      p.panic = Math.max(0, p.panic - dt);
      const [cx, cz] = collide(p.x, p.z, 0.5, this.G.world.colliders);
      p.x = cx; p.z = cz;
      p.y = heightAt(p.x, p.z);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y = p.angle;
      const moving = d > 0.5;
      const swing = moving ? Math.sin(t * (p.panic > 0 ? 14 : 8)) * 0.5 : 0;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    }
  }

  // Traffic cars: spawn from config, drive their loops, avoid each other.
  spawnTraffic(G, list) {
    for (const c of list) {
      if (!c.traffic) continue;
      const car = new Car(G, c.type, c.x, c.z, c.angle, { traffic: true, driver: 'traffic' });
      car.wpIndex = Math.floor(rand(0, 4));
      this.traffic.push(car);
      G.cars.push(car);
    }
  }

  updateTraffic(dt) {
    for (const car of this.traffic) {
      if (car.destroyed || car.driver === 'player') continue; // never fight the player's steering
      const ctrl = trafficControl(this.G, car, dt);
      // Cap traffic speed so the town stays readable.
      car.update(dt, ctrl);
      if (car.speed > 13) car.speed = 13;
      if (car.speed < -4) car.speed = -4;
    }
    // Car-vs-car shoves (a cheap circle push so traffic never overlaps).
    const all = this.G.cars;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.destroyed || b.destroyed) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 9 && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (3 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
          a.speed *= 0.6; b.speed *= 0.6;
        }
      }
    }
  }
}
