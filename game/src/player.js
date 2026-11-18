// Rico — the getaway driver — on foot: run, aim with the mouse, shoot,
// and hop in and out of cars. When he is in a car, the car module drives.
import { PLAYER, T, LAVA } from './config.js';
import { moveCircle, tileAt, findOpenSpot } from './world.js';
import { clamp, angleTo } from './random.js';

export function createPlayer(world) {
  const start = world.places.port;
  return {
    x: start.x - 60,
    y: start.y + 40,
    angle: -Math.PI / 2,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    money: 0,
    onFoot: true,
    car: null,
    shootTimer: 0,
    regenTimer: 0,
    hurtTimer: 0,
    lavaTimer: 0,
    dead: false,
  };
}

// Try to enter the nearest car within reach; returns the car or null.
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updatePlayer(game, dt) {
  const { player, input, world, combat } = game;
  if (player.dead) return;
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.regenTimer += dt;
  if (player.regenTimer > 4 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 6 * dt);
  }

  if (!player.onFoot) {
    // Riding: the player sits in the car; the car is the body now.
    if (player.car) {
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
    }
    return;
  }

  // Aim at the mouse (screen space -> world space via the camera).
  const cam = game.camera;
  const wx = cam.x + input.mouse.x / cam.zoom;
  const wy = cam.y + input.mouse.y / cam.zoom;
  player.angle = angleTo(player.x, player.y, wx, wy);

  // Move with WASD / arrows.
  let mx = 0;
  let my = 0;
  if (input.down('w') || input.down('ArrowUp')) my -= 1;
  if (input.down('s') || input.down('ArrowDown')) my += 1;
  if (input.down('a') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('d') || input.down('ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const step = PLAYER.walkSpeed * dt;
    const moved = moveCircle(world, player.x, player.y, PLAYER.radius, (mx / len) * step, (my / len) * step, false);
    player.x = moved.x;
    player.y = moved.y;
  }

  // Lava underfoot burns.
  const tile = tileAt(world, player.x, player.y);
  if (tile === T.LAVA) {
    player.lavaTimer += dt;
    player.hp -= LAVA.footDamagePerSecond * dt;
    player.hurtTimer = 0.4;
    if (player.lavaTimer > 0.5) {
      player.lavaTimer = 0;
      game.particles.push({ x: player.x, y: player.y, vx: 0, vy: -40, life: 0.5, max: 0.5, size: 5, color: '#ff7a1a' });
    }
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
    }
  }

  // Shoot toward the mouse.
  if (input.mouseDown && player.shootTimer <= 0) {
    player.shootTimer = PLAYER.shootCooldown;
    combat.fireBullet(player.x, player.y, player.angle, PLAYER.bulletSpeed, PLAYER.bulletDamage, 'player');
    game.audio.shoot();
    game.particles.push({
      x: player.x + Math.cos(player.angle) * 22,
      y: player.y + Math.sin(player.angle) * 22,
      vx: 0,
      vy: 0,
      life: 0.08,
      max: 0.08,
      size: 10,
      color: '#ffd94a',
    });
  }

  // E: get into the nearest car.
  if (input.wasPressed('e')) {
    const car = nearestCar(game.cars, player.x, player.y, 70);
    if (car) {
      input.consume('e');
      player.onFoot = false;
      player.car = car;
      car.driver = 'player';
      game.audio.pickup();
      game.toast('You took the ' + car.name);
    }
  }
}

// Step out of the car onto the roadside.
export function exitCar(game) {
  const { player, world } = game;
  if (!player.car) return;
  const car = player.car;
  car.driver = null;
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  const spot = findOpenSpot(world, side.x, side.y, PLAYER.radius);
  player.x = spot.x;
  player.y = spot.y;
  player.onFoot = true;
  player.car = null;
  game.toast('On foot');
}

export function damagePlayer(game, amount, from) {
  const { player } = game;
  if (player.dead || !player.onFoot) return;
  player.hp -= amount;
  player.hurtTimer = 0.5;
  player.regenTimer = 0;
  if (from === 'cop' || from === 'rival' || from === 'guard') {
    game.wanted.addHeat(2);
  }
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
  }
}

export function healPlayer(player, amount) {
  player.hp = clamp(player.hp + amount, 0, player.maxHp);
  if (player.hp > 0) player.dead = false;
}
