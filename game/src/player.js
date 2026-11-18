// FROSTLINE — the player on foot: run, jump, camera, enter/exit cars.
import * as THREE from 'three';
import { CFG, SPAWN } from './config.js';
import { clamp, lerp } from './util.js';
import { heightAt, collide } from './world.js';

export class Player {
  constructor(G) {
    this.G = G;
    this.pos = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
    this.vel = new THREE.Vector3();
    this.angle = SPAWN.angle; // facing
    this.camYaw = SPAWN.angle + Math.PI;
    this.camPitch = 0.32;
    this.onGround = true;
    this.inCar = null; // car object when driving
    this.health = CFG.playerHealth;
    this.armor = 0;
    this.ammo = CFG.pistolAmmo;
    this.cash = CFG.startCash;
    this.moving = false;
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), coat);
    body.position.y = 1.05; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.72; head.castShadow = true;
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, 1.2), dark);
    beanie.position.y = 1.78;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), dark);
    legL.position.set(-0.17, 0.35, 0); legL.castShadow = true;
    const legR = legL.clone(); legR.position.x = 0.17;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.22), coat);
    armL.position.set(-0.42, 1.05, 0); armL.castShadow = true;
    const armR = armL.clone(); armR.position.x = 0.42;
    g.add(body, head, beanie, legL, legR, armL, armR);
    this.mesh = g;
    this.legL = legL; this.legR = legR; this.armL = armL; this.armR = armR;
    this.G.scene.add(g);
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  // On-foot step. input uses the main.js keys: forward/back/left/right/sprint/jump.
  updateOnFoot(dt, input) {
    const speed = input.sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    // Movement is relative to the camera yaw.
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    let mx = 0, mz = 0;
    if (input.forward) { mx += -sin; mz += -cos; }
    if (input.back) { mx += sin; mz += cos; }
    if (input.left) { mx += -cos; mz += sin; }
    if (input.right) { mx += cos; mz += -sin; }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (len > 0) {
      mx /= len; mz /= len;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.angle = Math.atan2(mx, mz);
    }
    // Ground and jump.
    const ground = heightAt(this.pos.x, this.pos.z);
    if (input.jump && this.onGround) { this.vel.y = CFG.jumpSpeed; this.onGround = false; }
    if (!this.onGround) {
      this.vel.y -= CFG.gravity * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground) { this.pos.y = ground; this.vel.y = 0; this.onGround = true; }
    } else this.pos.y = ground;
    // Keep inside the map and out of buildings and trees.
    this.pos.x = clamp(this.pos.x, -340, 340);
    this.pos.z = clamp(this.pos.z, -340, 340);
    const [cx, cz] = collide(this.pos.x, this.pos.z, 0.6, this.G.world.colliders);
    this.pos.x = cx; this.pos.z = cz;
    // Mesh and walk swing.
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.angle;
    const t = performance.now() / 1000;
    const swing = this.moving ? Math.sin(t * 11) * 0.55 : 0;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8; this.armR.rotation.x = swing * 0.8;
    this.mesh.visible = true;
  }

  // Third-person camera. Moves G.camera; returns nothing.
  updateCamera(dt) {
    const cam = this.G.camera;
    let tx, tz, ty, lookY;
    if (this.inCar) {
      const c = this.inCar;
      const back = 9.5, up = 4.2;
      tx = c.x - Math.sin(c.angle) * back;
      tz = c.z - Math.cos(c.angle) * back;
      ty = heightAt(tx, tz) + up;
      lookY = heightAt(c.x, c.z) + 1.6;
      cam.position.x = lerp(cam.position.x, tx, 1 - Math.pow(0.001, dt));
      cam.position.y = lerp(cam.position.y, ty, 1 - Math.pow(0.001, dt));
      cam.position.z = lerp(cam.position.z, tz, 1 - Math.pow(0.001, dt));
      cam.lookAt(c.x, lookY, c.z);
      return;
    }
    const dist = 8.5;
    const cx = this.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = this.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = this.pos.y + 2.2 + Math.sin(this.camPitch) * dist;
    const k = 1 - Math.pow(0.0001, dt);
    cam.position.x = lerp(cam.position.x, cx, k);
    cam.position.y = lerp(cam.position.y, Math.max(cy, heightAt(cx, cz) + 1.2), k);
    cam.position.z = lerp(cam.position.z, cz, k);
    cam.lookAt(this.pos.x, this.pos.y + 1.7, this.pos.z);
  }

  // Nearest stealable car within 3.5 m (never a police car, never the snowcat outside mission 3).
  nearestCar(cars) {
    let best = null, bd = 3.5;
    for (const c of cars) {
      if (c.type === 'police' || c.destroyed) continue;
      const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    this.inCar = car;
    car.driver = 'player';
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return;
    const c = this.inCar;
    this.inCar = null;
    c.driver = null;
    c.speed = 0;
    // Step out to the car's left side.
    const sx = c.x + Math.cos(c.angle) * 2.2;
    const sz = c.z - Math.sin(c.angle) * 2.2;
    const [cx, cz] = collide(sx, sz, 0.6, this.G.world.colliders);
    this.pos.set(cx, heightAt(cx, cz), cz);
    this.mesh.visible = true;
  }
}
