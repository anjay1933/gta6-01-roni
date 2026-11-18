// DUSTLINE vehicles: low-poly cars built from boxes and cylinders, a simple arcade
// driving model (accel, steering, drift, damage smoke), and traffic that follows
// the road loops, keeps its lane and brakes for the car ahead.

import * as THREE from 'three';
import { CARS } from './config.js';
import { clamp, angleDiff, dist2D } from './util.js';

function bodyMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
}

/** Build one low-poly car. Returns { group, wheels[], body } — group faces +X. */
export function makeCarModel(type, colorOverride) {
  const spec = CARS[type] || CARS.sedan;
  const color = colorOverride ?? spec.color;
  const g = new THREE.Group();
  const len = spec.len;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.85, 2.0), bodyMat(color));
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.7, 1.8), new THREE.MeshStandardMaterial({
    color: 0x1a2028, roughness: 0.15, metalness: 0.7,
  }));
  cabin.position.set(-len * 0.06, 1.4, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // Headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 0.9 });
  for (const z of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.4), headMat);
    h.position.set(len / 2, 0.7, z);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.4), tailMat);
    t.position.set(-len / 2, 0.7, z);
    g.add(t);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    bar.position.set(-len * 0.06, 1.86, 0);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.set(-len * 0.06, 2.0, -0.3);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.set(-len * 0.06, 2.0, 0.3);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  if (type === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(len * 0.34, 0.5, 1.8), bodyMat(0x2a2018));
    bed.position.set(-len * 0.3, 1.15, 0);
    g.add(bed);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[len * 0.32, 0.95], [len * 0.32, -0.95], [-len * 0.32, 0.95], [-len * 0.32, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.spec = spec;
  g.userData.len = len;
  return g;
}

export class Car {
  constructor(scene, type, x, z, heading, colorOverride) {
    this.type = type;
    this.spec = CARS[type] || CARS.sedan;
    this.group = makeCarModel(type, colorOverride);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.damage = 0;      // 0..1 — smoke and sputter as it climbs
    this.driver = null;   // 'player' | 'traffic' | 'police' | null (parked)
    this.smoke = null;
    this.smokeTimer = 0;
  }

  get pos() { return { x: this.x, z: this.z }; }

  /** Arcade drive step. throttle -1..1, steer -1..1 (positive = turn right), dt seconds. */
  drive(throttle, steer, dt) {
    const s = this.spec;
    const target = throttle * s.top;
    const rate = throttle !== 0 ? s.accel : 10;
    this.speed += clamp(target - this.speed, -rate * dt, rate * dt);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    // Steering: forward is (cos h, -sin h), so turning right decreases heading.
    // Reversing flips the steering, like a real car.
    const dir = this.speed >= 0 ? 1 : -1;
    const authority = clamp(Math.abs(this.speed) / 12, 0, 1);
    this.heading -= steer * s.grip * 0.55 * authority * dir * dt;
    const drift = Math.abs(steer) > 0.7 && Math.abs(this.speed) > 18 ? 0.35 : 0;
    const fx = Math.cos(this.heading);
    const fz = -Math.sin(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    if (drift > 0) {
      this.x += -fz * this.speed * drift * dt * 0.4 * Math.sign(steer);
      this.z += fx * this.speed * drift * dt * 0.4 * Math.sign(steer);
    }
    this.sync();
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const w of this.group.userData.wheels) w.rotation.y -= spin;
    if (this.type === 'police') {
      const on = Math.floor(performance.now() / 280) % 2 === 0;
      this.group.userData.lightRed.material.emissiveIntensity = on ? 2.5 : 0.3;
      this.group.userData.lightBlue.material.emissiveIntensity = on ? 0.3 : 2.5;
    }
  }

  addDamage(amount) {
    this.damage = clamp(this.damage + amount, 0, 1);
    if (this.damage > 0.45 && !this.smoke) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(24 * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x555555, size: 1.4, transparent: true, opacity: 0.6, depthWrite: false,
      }));
      this.group.add(this.smoke);
      this.smoke.position.y = 1.4;
    }
  }

  updateSmoke(dt) {
    if (!this.smoke) return;
    this.smokeTimer += dt;
    const pos = this.smoke.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (this.smokeTimer * 0.7 + i * 0.13) % 1;
      pos.setXYZ(i, (Math.sin(i * 7.3) * 0.5) * t, 0.4 + t * 3.2, (Math.cos(i * 5.1) * 0.5) * t);
    }
    pos.needsUpdate = true;
  }

  remove(scene) {
    scene.remove(this.group);
  }
}

/** Traffic: cars looping the road network, braking for the car ahead. */
export class Traffic {
  constructor(scene, town, rng) {
    this.scene = scene;
    this.town = town;
    this.rng = rng;
    this.cars = [];
    const types = ['sedan', 'pickup', 'coupe', 'sedan', 'pickup', 'truck'];
    const colors = [0x7a8ba0, 0xa8542e, 0x2e6db0, 0xd8cdb0, 0x5a7a4a, 0x8a5a7a, 0xc0c0c0];
    for (let i = 0; i < 10; i++) {
      const route = town.roads[i % town.roads.length];
      const wp = Math.floor(rng() * route.points.length);
      const [x, z] = route.points[wp];
      const car = new Car(scene, types[Math.floor(rng() * types.length)],
        x + (rng() - 0.5) * 4, z + (rng() - 0.5) * 4, rng() * Math.PI * 2,
        colors[Math.floor(rng() * colors.length)]);
      car.driver = 'traffic';
      car.route = route;
      car.wp = wp;
      car.cruise = 9 + rng() * 7;
      this.cars.push(car);
    }
    // Parked cars the player can steal.
    this.parked = [];
    const spots = [
      ['muscle', -168, 18, 0.2], ['sedan', 60, 18, -0.1], ['pickup', -100, -40, 1.57],
      ['coupe', 150, 18, 0.05], ['sedan', -60, -44, 1.57], ['pickup', 210, 14, 0.3],
    ];
    for (const [type, x, z, h] of spots) {
      const car = new Car(scene, type, x, z, h);
      car.driver = null;
      this.parked.push(car);
    }
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      const route = car.route;
      const target = route.points[car.wp];
      const d = dist2D(car.x, car.z, target[0], target[1]);
      if (d < 6) {
        car.wp = (car.wp + 1) % route.points.length;
        continue;
      }
      const wantHeading = Math.atan2(-(target[1] - car.z), target[0] - car.x);
      const steer = clamp(angleDiff(car.heading, wantHeading) * 1.6, -1, 1);
      // Brake for the car ahead (traffic or the player's car).
      let throttle = 0.6;
      for (const other of [...this.cars, ...(playerCar ? [playerCar] : [])]) {
        if (other === car) continue;
        const od = dist2D(car.x, car.z, other.x, other.z);
        if (od < 9) {
          const ahead = Math.cos(car.heading) * (other.x - car.x) + -Math.sin(car.heading) * (other.z - car.z);
          if (ahead > 0 && od < 9) { throttle = -0.4; break; }
        }
      }
      car.drive(throttle, steer, dt);
      car.updateSmoke(dt);
    }
    for (const car of this.parked) car.updateSmoke(dt);
  }

  /** Nearest stealable car within `range` of (x,z); null when none. */
  nearestParked(x, z, range = 4) {
    let best = null;
    let bestD = range;
    for (const car of this.parked) {
      const d = dist2D(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  steal(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    car.driver = 'player';
  }
}
