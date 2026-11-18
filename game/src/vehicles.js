// FROSTLINE — cars: mesh building, arcade driving on ice, traffic autopilot.
import * as THREE from 'three';
import { CAR_TYPES } from './config.js';
import { clamp, lerp, angleDiff, pick } from './util.js';
import { heightAt, surfaceGrip, collide } from './world.js';

let carId = 0;

export function makeCarMesh(type, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1622, roughness: 0.1, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9 });
  const isSnowcat = type === 'snowcat';
  const L = isSnowcat ? 4.6 : 4.2, W = isSnowcat ? 2.4 : 1.9, H = isSnowcat ? 1.1 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), paint);
  body.position.y = 0.75; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.62, L * 0.45), glass);
  cabin.position.set(0, 1.4, -0.2); cabin.castShadow = true;
  g.add(cabin);
  if (isSnowcat) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.7, 0.25), dark);
    blade.position.set(0, 0.5, L / 2 + 0.2);
    g.add(blade);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.8, 1.1), paint);
    cab.position.set(0, 1.7, 0.6); cab.castShadow = true;
    g.add(cab);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-W / 2, L / 2 - 0.8], [W / 2, L / 2 - 0.8], [-W / 2, -L / 2 + 0.8], [W / 2, -L / 2 + 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  // Headlights: two small emissive discs up front.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const wx of [-W / 2 + 0.35, W / 2 - 0.35]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
    hl.position.set(wx, 0.85, L / 2 + 0.02);
    g.add(hl);
  }
  return { group: g, wheels };
}

export function makePoliceExtras(group) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x11131a }));
  bar.position.set(0, 1.85, -0.2);
  group.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(-0.28, 1.98, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  blue.position.set(0.28, 1.98, -0.2);
  group.add(red, blue);
  return { red, blue };
}

export class Car {
  constructor(G, type, x, z, angle, opts = {}) {
    this.G = G;
    this.id = ++carId;
    this.type = type;
    this.def = CAR_TYPES[type];
    this.color = opts.color ?? pick(this.def.colors);
    const { group, wheels } = makeCarMesh(type, this.color);
    this.mesh = group;
    this.wheels = wheels;
    if (type === 'police') this.lightBar = makePoliceExtras(group);
    this.x = x; this.z = z;
    this.y = heightAt(x, z);
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.driver = opts.driver ?? null; // 'player' | 'traffic' | 'police' | null
    this.traffic = !!opts.traffic;
    this.health = 100 * this.def.tough;
    this.maxHealth = this.health;
    this.destroyed = false;
    this.smoke = 0;
    this.waypoints = opts.waypoints || null;
    this.wpIndex = 0;
    this.waitAt = 0;
    this.mesh.position.set(x, this.y, z);
    this.mesh.rotation.y = angle;
    G.scene.add(group);
  }

  // Arcade drive step. ctrl: {f, b, l, r, handbrake} — player or autopilot.
  update(dt, ctrl) {
    if (this.destroyed) return;
    const grip = surfaceGrip(this.x, this.z) * this.def.grip;
    const accel = this.def.accel;
    if (ctrl.f) this.speed += accel * dt;
    if (ctrl.b) this.speed -= (this.speed > 0.5 ? accel * 1.4 : accel * 0.6) * dt;
    if (!ctrl.f && !ctrl.b) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    if (ctrl.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 22 * dt);
    this.speed = clamp(this.speed, -this.def.topSpeed * 0.45, this.def.topSpeed);
    // Steering bites less on ice; at standstill nothing turns.
    const steerAuthority = clamp(Math.abs(this.speed) / 6, 0, 1) * (0.55 + 0.45 * grip);
    const steerTarget = (ctrl.l ? 1 : 0) - (ctrl.r ? 1 : 0);
    this.steer = lerp(this.steer, steerTarget * 0.55, 1 - Math.pow(0.001, dt));
    this.angle += this.steer * (this.speed >= 0 ? 1 : -1) * steerAuthority * 1.9 * dt * Math.sign(this.speed || 1);
    // Ice slide: velocity keeps a lateral component.
    const fx = Math.sin(this.angle), fz = Math.cos(this.angle);
    const slide = (1 - grip) * 0.55;
    this.x += fx * this.speed * dt + (this.slideX || 0) * slide * dt;
    this.z += fz * this.speed * dt + (this.slideZ || 0) * slide * dt;
    this.slideX = lerp(this.slideX || 0, fx * this.speed * 0.35, 0.1);
    this.slideZ = lerp(this.slideZ || 0, fz * this.speed * 0.35, 0.1);
    this.x = clamp(this.x, -340, 340);
    this.z = clamp(this.z, -340, 340);
    const [cx, cz] = collide(this.x, this.z, 1.4, this.G.world.colliders);
    if (cx !== this.x || cz !== this.z) { this.speed *= 0.4; this.x = cx; this.z = cz; }
    this.y = heightAt(this.x, this.z);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.angle;
    // Wheel spin + front steer visual.
    const spin = this.speed * dt * 2.4;
    for (const w of this.wheels) w.rotation.x += spin;
    if (this.wheels[0]) this.wheels[0].rotation.y = this.steer * 0.4;
    if (this.wheels[1]) this.wheels[1].rotation.y = this.steer * 0.4;
    // Damage smoke.
    if (this.health < this.maxHealth * 0.45) this.smoke += dt;
    // Police light bar flash.
    if (this.lightBar) {
      const on = Math.floor(performance.now() / 280) % 2 === 0;
      this.lightBar.red.material.color.setHex(on ? 0xff2020 : 0x551010);
      this.lightBar.blue.material.color.setHex(on ? 0x2040ff : 0x101055);
    }
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.destroyed) {
      this.destroyed = true;
      this.mesh.visible = false;
    }
  }
}

// Traffic loops: simple rectangular/loop waypoint circuits around town.
export const TRAFFIC_LOOPS = [
  [[-160, 3], [160, 3], [160, -3], [-160, -3]],
  [[3, -130], [3, 130], [-3, 130], [-3, -130]],
  [[-40, 4], [-180, 56], [-170, 66], [-30, -4]],
];

export function trafficControl(G, car, dt) {
  const loop = TRAFFIC_LOOPS[car.id % TRAFFIC_LOOPS.length];
  const target = loop[car.wpIndex % loop.length];
  const dx = target[0] - car.x, dz = target[1] - car.z;
  const d = Math.hypot(dx, dz);
  if (d < 6) { car.wpIndex++; return { f: false, b: false, l: false, r: false, handbrake: false }; }
  const wantAngle = Math.atan2(dx, dz);
  const diff = angleDiff(car.angle, wantAngle);
  // Slow down if another car is close ahead.
  let slow = false;
  for (const o of G.cars) {
    if (o === car || o.destroyed) continue;
    const ox = o.x - car.x, oz = o.z - car.z;
    const ahead = ox * Math.sin(car.angle) + oz * Math.cos(car.angle);
    const side = Math.abs(ox * Math.cos(car.angle) - oz * Math.sin(car.angle));
    if (ahead > 0 && ahead < 9 && side < 3) { slow = true; break; }
  }
  return {
    f: !slow && Math.abs(diff) < 1.2,
    b: false,
    l: diff > 0.12,
    r: diff < -0.12,
    handbrake: false,
  };
}
