// Cars: the player's ride, island traffic and the police.
// Traffic cruises between road nodes; police chase the player and ram.
import { CAR_KINDS, CAR_COLORS, T, LAVA } from './config.js';
import { moveCircle, tileAt, findOpenSpot, circleHitsBuilding } from './world.js';
import { clamp, angleDiff, angleTo, dist } from './random.js';

let carId = 0;

export function makeCar(world, x, y, kind, driver, name) {
  const spec = CAR_KINDS[kind];
  const car = {
    id: ++carId,
    x,
    y,
    angle: 0,
    speed: 0,
    kind,
    name: name || (kind === 'police' ? 'Police Cruiser' : 'Island ' + kind),
    color: kind === 'police' ? '#1d4ed8' : CAR_COLORS[carId % CAR_COLORS.length],
    driver, // 'player' | 'traffic' | 'police' | null
    hp: spec.hp,
    maxHp: spec.hp,
    wrecked: false,
    target: null,
    stuckTimer: 0,
    lastX: x,
    lastY: y,
    progressTimer: 0,
    smokeTimer: 0,
  };
  if (driver === 'traffic') pickTrafficTarget(world, car);
  return car;
}

function pickTrafficTarget(world, car) {
  const nodes = world.roadNodes;
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = dist(car.x, car.y, n.x, n.y);
    if (d > 120 && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  car.target = { x: best.x, y: best.y };
}

// Steer a car toward a point: returns {throttle, steer} in -1..1.
export function steerToward(car, tx, ty, reverse) {
  const want = angleTo(car.x, car.y, tx, ty);
  const diff = angleDiff(car.angle, want);
  const steer = clamp(diff * 2.2, -1, 1);
  let throttle = 1;
  if (Math.abs(diff) > 2.2) throttle = reverse ? -0.7 : 0.25;
  return { throttle, steer };
}

export function updateCar(game, car, dt) {
  const spec = CAR_KINDS[car.kind];
  if (car.wrecked) return;
  const { input, world } = game;

  // Safety net: a car must never sit inside a building — a hard ram can
  // shove one through a corner, and moveCircle then blocks every
  // direction, wedging it there for good. Pop it out to the nearest
  // open spot instead of leaving it trapped.
  if (circleHitsBuilding(world, car.x, car.y, 15)) {
    const spot = findOpenSpot(world, car.x, car.y, 15);
    car.x = spot.x;
    car.y = spot.y;
    car.speed *= 0.3;
  }

  let throttle = 0;
  let steer = 0;
  let handbrake = false;

  if (car.driver === 'player') {
    if (input.down('w') || input.down('ArrowUp')) throttle = 1;
    if (input.down('s') || input.down('ArrowDown')) throttle = -0.7;
    if (input.down('a') || input.down('ArrowLeft')) steer = -1;
    if (input.down('d') || input.down('ArrowRight')) steer = 1;
    handbrake = input.down(' ');
  } else if (car.driver === 'traffic') {
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 60) pickTrafficTarget(world, car);
    const s = steerToward(car, car.target.x, car.target.y, false);
    throttle = s.throttle * 0.55;
    steer = s.steer;
  } else if (car.driver === 'police') {
    const p = game.player;
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 60) {
      // Ram: push through the player.
      const s = steerToward(car, p.x, p.y, false);
      throttle = 0.9;
      steer = s.steer;
    } else if (d < 900) {
      const s = steerToward(car, p.x, p.y, true);
      throttle = s.throttle;
      steer = s.steer;
    } else {
      throttle = 0;
      steer = 0;
    }
  }

  // Off-road slows the car; lava burns it.
  const tile = tileAt(world, car.x, car.y);
  const offRoad = tile !== T.ROAD && tile !== T.TOWN && tile !== T.DOCK;
  const topSpeed = spec.maxSpeed * (offRoad ? 0.55 : 1);
  if (tile === T.LAVA) {
    car.hp -= LAVA.carDamagePerSecond * dt;
    if (car.hp <= 0) {
      wreckCar(game, car);
      return;
    }
  }

  const prevSpeed = car.speed;
  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) car.speed += spec.accel * throttle * dt * 0.8;
  else car.speed -= Math.sign(car.speed) * spec.accel * 0.45 * dt;
  if (Math.abs(car.speed) < 6 && throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -spec.reverse, topSpeed);
  if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);

  const turnRate = spec.turn * (Math.abs(car.speed) > 4 ? clamp(Math.abs(car.speed) / 120, 0.35, 1) : 0);
  car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);

  const step = car.speed * dt;
  const moved = moveCircle(world, car.x, car.y, 15, Math.cos(car.angle) * step, Math.sin(car.angle) * step, true);
  if ((moved.hitX || moved.hitY) && Math.abs(car.speed) > 90) {
    car.speed *= 0.45;
    game.audio.crash();
    game.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 14, color: '#f1c40f' });
    if (car.driver === 'player') game.wanted.addHeat(1);
  }
  car.x = moved.x;
  car.y = moved.y;

  // Stuck detection (used by the autopilot's reverse-out).
  car.progressTimer += dt;
  if (car.progressTimer > 1.2) {
    car.progressTimer = 0;
    const movedDist = dist(car.x, car.y, car.lastX, car.lastY);
    car.lastX = car.x;
    car.lastY = car.y;
    car.stuckTimer = movedDist < 12 && Math.abs(car.speed) < 30 ? car.stuckTimer + 1.2 : 0;
  }

  // Smoke when badly hurt.
  if (car.hp < car.maxHp * 0.4) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      game.particles.push({
        x: car.x - Math.cos(car.angle) * 14,
        y: car.y - Math.sin(car.angle) * 14,
        vx: 0,
        vy: -26,
        life: 0.9,
        max: 0.9,
        size: 9,
        color: '#555555',
      });
    }
  }
  if (prevSpeed !== 0 && car.driver === 'player') {
    game.audio.setEngine(Math.abs(car.speed) / spec.maxSpeed, true);
  }
}

export function wreckCar(game, car) {
  if (car.wrecked) return;
  car.wrecked = true;
  car.speed = 0;
  game.audio.explosion();
  game.explosions.push({ x: car.x, y: car.y, r: 0, maxR: 90, life: 0.5, max: 0.5 });
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    game.particles.push({
      x: car.x,
      y: car.y,
      vx: Math.cos(a) * 160,
      vy: Math.sin(a) * 160,
      life: 0.7,
      max: 0.7,
      size: 6,
      color: i % 2 ? '#ff7a1a' : '#ffd94a',
    });
  }
  const p = game.player;
  if (p.car === car) {
    p.car = null;
    p.onFoot = true;
    const spot = findOpenSpot(game.world, car.x + 40, car.y, 13);
    p.x = spot.x;
    p.y = spot.y;
    damagePlayerCheck(game);
  }
}

function damagePlayerCheck(game) {
  const p = game.player;
  if (!p.onFoot) return;
  p.hp -= 18;
  p.hurtTimer = 0.6;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
  }
}

// Player car bumping a police car (or the reverse) hurts both a little.
export function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        // A ram never shoves a car into a building: once a circle is
        // inside a rect, moveCircle blocks every direction and the car
        // is wedged there for good. Skip the side that would enter one.
        if (!circleHitsBuilding(game.world, a.x - nx * push, a.y - ny * push, 15)) {
          a.x -= nx * push;
          a.y -= ny * push;
        }
        if (!circleHitsBuilding(game.world, b.x + nx * push, b.y + ny * push, 15)) {
          b.x += nx * push;
          b.y += ny * push;
        }
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120) {
          // Two police cars on the same chase never damage each other,
          // or they pile up, wreck each other and respawn without end.
          if (!(a.driver === 'police' && b.driver === 'police')) {
            // The hero car is tougher than the island's cruisers: a ram
            // costs Rico 2 hp and the rammer 6, so a chase can be
            // outlasted instead of ending in a wrecked ride every time.
            const dmgA = a.driver === 'player' ? 2 : 6;
            const dmgB = b.driver === 'player' ? 2 : 6;
            a.hp -= dmgA;
            b.hp -= dmgB;
            if (a.hp <= 0) wreckCar(game, a);
            if (b.hp <= 0) wreckCar(game, b);
          }
          if (a.driver === 'player' || b.driver === 'player') game.audio.crash();
        }
        if ((a.driver === 'police' && b.driver === 'player') || (b.driver === 'police' && a.driver === 'player')) {
          const p = game.player;
          if (impact > 60 && p.onFoot === false) {
            // Ramming the player while he drives shakes the car, not his body.
          }
        }
      }
    }
  }
}
