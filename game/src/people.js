// The island's people: civilians who stroll and flee, observatory guards,
// jungle rivals and foot cops. Enemies shoot when the player gets close.
import { ENEMY, T } from './config.js';
import { moveCircle, tileAt } from './world.js';
import { clamp, angleTo, dist } from './random.js';

let pedId = 0;

export function makePed(world, x, y, kind) {
  const hp = kind === 'guard' ? ENEMY.guardHp : kind === 'rival' ? ENEMY.rivalHp : kind === 'cop' ? ENEMY.copHp : 50;
  return {
    id: ++pedId,
    x,
    y,
    angle: 0,
    kind, // 'civilian' | 'guard' | 'rival' | 'cop'
    hp,
    maxHp: hp,
    speed: ENEMY.walkSpeed,
    shootTimer: Math.random() * 0.5,
    wanderTimer: 0,
    tx: x,
    ty: y,
    dead: false,
    fleeing: false,
    color:
      kind === 'guard'
        ? '#c0392b'
        : kind === 'rival'
          ? '#8e44ad'
          : kind === 'cop'
            ? '#1d4ed8'
            : ['#e67e22', '#16a085', '#f1c40f', '#ecf0f1', '#e74c3c'][pedId % 5],
  };
}

export function spawnCivilians(game, n) {
  const { world, rng } = game;
  const town = world.places.town;
  for (let i = 0; i < n; i++) {
    const x = town.x + rng.range(-260, 260);
    const y = town.y + rng.range(-180, 180);
    if (tileAt(world, x, y) === T.OCEAN) continue;
    game.peds.push(makePed(world, x, y, 'civilian'));
  }
}

function isEnemy(ped) {
  return ped.kind === 'guard' || ped.kind === 'rival' || ped.kind === 'cop';
}

export function updatePed(game, ped, dt) {
  if (ped.dead) return;
  const { player, world } = game;
  const d = dist(ped.x, ped.y, player.x, player.y);
  const hostile = isEnemy(ped) && !player.dead;

  if (hostile && d < ENEMY.shootRange) {
    // Face the player and shoot.
    ped.angle = angleTo(ped.x, ped.y, player.x, player.y);
    ped.shootTimer -= dt;
    // Close in a little when far, hold ground when near.
    if (d > 260) {
      const step = ped.speed * 0.7 * dt;
      const moved = moveCircle(world, ped.x, ped.y, 12, Math.cos(ped.angle) * step, Math.sin(ped.angle) * step, false);
      ped.x = moved.x;
      ped.y = moved.y;
    }
    if (ped.shootTimer <= 0) {
      ped.shootTimer = ENEMY.shootCooldown * (0.85 + Math.random() * 0.4);
      // Wide spread at range: most shots miss a moving target.
      const spread = (Math.random() - 0.5) * 0.55;
      game.combat.fireBullet(ped.x, ped.y, ped.angle + spread, ENEMY.bulletSpeed, ENEMY.bulletDamage, ped.kind);
      game.audio.enemyShoot();
    }
    return;
  }

  if (ped.kind === 'civilian') {
    // Flee from gunfire and from the player's car.
    const threat = d < 130 || game.combat.recentShot;
    if (threat) {
      ped.fleeing = true;
      const away = angleTo(player.x, player.y, ped.x, ped.y);
      const step = ped.speed * 1.25 * dt;
      const moved = moveCircle(world, ped.x, ped.y, 12, Math.cos(away) * step, Math.sin(away) * step, false);
      ped.x = moved.x;
      ped.y = moved.y;
      ped.angle = away;
      return;
    }
    ped.fleeing = false;
    ped.wanderTimer -= dt;
    if (ped.wanderTimer <= 0) {
      ped.wanderTimer = 2 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2;
      ped.tx = ped.x + Math.cos(a) * 90;
      ped.ty = ped.y + Math.sin(a) * 90;
    }
    const td = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (td > 12) {
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      const step = ped.speed * 0.5 * dt;
      const moved = moveCircle(world, ped.x, ped.y, 12, Math.cos(a) * step, Math.sin(a) * step, false);
      ped.x = moved.x;
      ped.y = moved.y;
      ped.angle = a;
    }
    return;
  }

  // Hostile but player out of range: drift back to a guard post.
  ped.wanderTimer -= dt;
  if (ped.wanderTimer <= 0) {
    ped.wanderTimer = 2.5;
    const a = Math.random() * Math.PI * 2;
    ped.tx = clamp(ped.x + Math.cos(a) * 70, 60, 3140);
    ped.ty = clamp(ped.y + Math.sin(a) * 70, 60, 3140);
  }
  const td = dist(ped.x, ped.y, ped.tx, ped.ty);
  if (td > 10) {
    const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    const step = ped.speed * 0.55 * dt;
    const moved = moveCircle(world, ped.x, ped.y, 12, Math.cos(a) * step, Math.sin(a) * step, false);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.angle = a;
  }
}

export function damagePed(game, ped, amount) {
  if (ped.dead) return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.hp = 0;
    ped.dead = true;
    game.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -30, life: 0.6, max: 0.6, size: 8, color: '#e74c3c' });
    if (ped.kind === 'cop') game.wanted.addHeat(40);
    else if (ped.kind === 'civilian') game.wanted.addHeat(15);
    else game.wanted.addHeat(8);
  }
}
