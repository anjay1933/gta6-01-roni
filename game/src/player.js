// DUSTLINE player: Jax Marlowe on foot (WASD relative to the camera, sprint,
// jump, fists) and behind the wheel (WASD drives, E gets in and out). The
// third-person camera trails behind, swings with the mouse, and pulls back and
// up while driving so the road ahead stays readable.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, turnToward, angleDiff, dist2D } from './util.js';
import { makePersonModel } from './people.js';

export class Player {
  constructor(scene, town) {
    this.scene = scene;
    this.town = town;
    this.group = makePersonModel(0xc22e2e, 0xc98d68, { hat: true, pants: 0x2a3242 });
    // Jax's red jacket reads at a distance; the hat is his silhouette.
    this.group.position.set(-170, 0, 40);
    scene.add(this.group);
    this.x = -170;
    this.z = 40;
    this.heading = 0;          // model facing: forward = (cos h, -sin h)
    this.camYaw = 0;           // camera look direction, same convention
    this.camPitch = 0.32;
    this.vy = 0;
    this.y = 0;
    this.onGround = true;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.car = null;           // Car instance while driving, else null
    this.speed = 0;
    this.walkPhase = 0;
    this.camera = null;
  }

  get pos() { return { x: this.x, z: this.z }; }

  attachCamera(camera) {
    this.camera = camera;
  }

  look(dx, dy) {
    this.camYaw -= dx * 0.0032;
    this.camPitch = clamp(this.camPitch + dy * 0.0024, -0.12, 0.9);
  }

  /** Ground height under (x, z): the bridge deck sits 1.9 m up, the rest is 0. */
  groundHeight(x, z) {
    return x > 300 && x < 360 && Math.abs(z) < 6.5 ? 1.9 : 0;
  }

  /** Step the on-foot controller. `keys` is a Set of lowercase codes. */
  stepOnFoot(dt, keys) {
    // Camera-relative move direction.
    const fwd = { x: Math.cos(this.camYaw), z: -Math.sin(this.camYaw) };
    const right = { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
    let mx = 0;
    let mz = 0;
    if (keys.has('keyw') || keys.has('arrowup')) { mx += fwd.x; mz += fwd.z; }
    if (keys.has('keys') || keys.has('arrowdown')) { mx -= fwd.x; mz -= fwd.z; }
    if (keys.has('keyd') || keys.has('arrowright')) { mx += right.x; mz += right.z; }
    if (keys.has('keya') || keys.has('arrowleft')) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    const sprint = keys.has('shiftleft') || keys.has('shiftright');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(-mz, mx);
      this.heading = turnToward(this.heading, targetHeading, 10 * dt);
      this.x += mx * speed * dt;
      this.z += mz * speed * dt;
      this.speed = speed;
      this.walkPhase += dt * speed * 2.4;
      this.group.userData.legL.rotation.x = Math.sin(this.walkPhase) * 0.6;
      this.group.userData.legR.rotation.x = -Math.sin(this.walkPhase) * 0.6;
    } else {
      this.speed = 0;
      this.group.userData.legL.rotation.x *= 0.8;
      this.group.userData.legR.rotation.x *= 0.8;
    }
    // Jump + gravity, landing on the ground — or on the bridge deck.
    if (keys.has('space') && this.onGround) {
      this.vy = PLAYER.jumpSpeed;
      this.onGround = false;
    }
    const groundY = this.groundHeight(this.x, this.z);
    if (!this.onGround) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= groundY) { this.y = groundY; this.vy = 0; this.onGround = true; }
    } else {
      this.y = groundY;
    }
    // Buildings are solid; the world edge is a hard wall.
    const fixed = this.town.resolveCircle(this.x, this.z, PLAYER.radius);
    this.x = fixed.x;
    this.z = fixed.z;
    this.x = clamp(this.x, -445, 445);
    this.z = clamp(this.z, -445, 445);
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }

  /** Enter a car: hide the walker, snap the camera behind the car. */
  enterCar(car) {
    this.car = car;
    this.group.visible = false;
    this.x = car.x;
    this.z = car.z;
  }

  /** Step out on the driver's side. */
  exitCar() {
    if (!this.car) return;
    const car = this.car;
    const sx = car.x + -Math.sin(car.heading) * -2.4;
    const sz = car.z + Math.cos(car.heading) * -2.4;
    this.car = null;
    this.group.visible = true;
    this.x = sx;
    this.z = sz;
    this.y = this.groundHeight(sx, sz);
    this.heading = car.heading;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
  }

  /** Drive the current car with WASD. */
  stepDriving(dt, keys) {
    if (!this.car) return;
    let throttle = 0;
    if (keys.has('keyw') || keys.has('arrowup')) throttle = 1;
    if (keys.has('keys') || keys.has('arrowdown')) throttle = -0.7;
    let steer = 0;
    if (keys.has('keya') || keys.has('arrowleft')) steer = -1;
    if (keys.has('keyd') || keys.has('arrowright')) steer = 1;
    // Space is the handbrake: it bleeds speed without reversing.
    if (keys.has('space') && throttle >= 0) throttle *= 0.3;
    this.car.drive(throttle, steer, dt);
    // Solid buildings stop the car; the canyon gap stops it too.
    const fixed = this.town.resolveCircle(this.car.x, this.car.z, 2.2);
    if (fixed.x !== this.car.x || fixed.z !== this.car.z) {
      this.car.x = fixed.x;
      this.car.z = fixed.z;
      if (Math.abs(this.car.speed) > 6) this.car.addDamage(0.08);
      this.car.speed *= 0.4;
      this.car.sync();
    }
    this.car.x = clamp(this.car.x, -445, 445);
    this.car.z = clamp(this.car.z, -445, 445);
    // Keep the car on the bridge deck while crossing the canyon.
    if (this.car.x > 296 && this.car.x < 364) {
      this.car.z = clamp(this.car.z, -6.5, 6.5);
      this.car.sync();
    }
    this.x = this.car.x;
    this.z = this.car.z;
    this.speed = Math.abs(this.car.speed);
  }

  /** Third-person camera: behind the player (or car), easing toward its spot. */
  updateCamera(dt) {
    if (!this.camera) return;
    const driving = !!this.car;
    const dist = driving ? 11.5 : 7.5;
    const height = driving ? 4.6 : 3.4;
    const anchorX = driving ? this.car.x : this.x;
    const anchorZ = driving ? this.car.z : this.z;
    const anchorY = driving ? 1.2 : 1.6 + this.y;
    // While driving the camera follows the car's heading; on foot it follows the mouse.
    const yaw = driving ? this.car.heading : this.camYaw;
    const cx = anchorX - Math.cos(yaw) * dist;
    const cz = anchorZ + Math.sin(yaw) * dist;
    const cy = anchorY + Math.tan(this.camPitch) * dist * 0.55 + (driving ? 0.4 : 0);
    const k = 1 - Math.pow(0.0001, dt); // frame-rate independent ease
    this.camera.position.x += (cx - this.camera.position.x) * k;
    this.camera.position.y += (cy - this.camera.position.y) * k;
    this.camera.position.z += (cz - this.camera.position.z) * k;
    this.camera.lookAt(anchorX + Math.cos(yaw) * 6, anchorY + 0.4, anchorZ - Math.sin(yaw) * 6);
  }

  /** Damage the player; armor absorbs 60% of each hit. Returns true when dead. */
  damage(amount) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    return this.health <= 0;
  }
}
