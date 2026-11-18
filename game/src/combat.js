// Bullets, explosions and particles. Bullets know who fired them so the
// player can be hurt by enemies and enemies by the player, never by friends.
import { T } from './config.js';
import { tileAt } from './world.js';
import { dist } from './random.js';
import { damagePed } from './people.js';
import { damagePlayer } from './player.js';
import { wreckCar } from './vehicles.js';

export function createCombat(game) {
  return {
    bullets: [],
    recentShot: false,
    recentShotTimer: 0,
    fireBullet(x, y, angle, speed, damage, from) {
      this.bullets.push({
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        from,
        life: 1.4,
      });
      if (from === 'player') {
        this.recentShot = true;
        this.recentShotTimer = 1.5;
        game.wanted.addHeat(1.5);
      }
    },
    update(dt) {
      this.recentShotTimer -= dt;
      if (this.recentShotTimer <= 0) this.recentShot = false;
      const keep = [];
      for (const b of this.bullets) {
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.life <= 0) continue;
        const t = tileAt(game.world, b.x, b.y);
        if (t === T.OCEAN || t === T.ROCK) {
          game.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 4, color: '#bdc3c7' });
          continue;
        }
        // Hit a building?
        let hitWall = false;
        for (const bd of game.world.buildings) {
          if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) continue;

        let consumed = false;
        if (b.from === 'player') {
          for (const ped of game.peds) {
            if (ped.dead) continue;
            if (dist(b.x, b.y, ped.x, ped.y) < 16) {
              damagePed(game, ped, b.damage);
              consumed = true;
              break;
            }
          }
          if (!consumed) {
            for (const car of game.cars) {
              if (car.wrecked || car.driver === 'player') continue;
              if (dist(b.x, b.y, car.x, car.y) < 24) {
                car.hp -= b.damage;
                if (car.hp <= 0) wreckCar(game, car);
                consumed = true;
                break;
              }
            }
          }
        } else {
          // Enemy bullet: hurts the player on foot, or his car.
          const p = game.player;
          if (!p.dead && dist(b.x, b.y, p.x, p.y) < (p.onFoot ? 15 : 26)) {
            if (p.onFoot) damagePlayer(game, b.damage, b.from);
            else if (p.car) {
              p.car.hp -= b.damage;
              if (p.car.hp <= 0) wreckCar(game, p.car);
            }
            consumed = true;
          }
        }
        if (!consumed) keep.push(b);
      }
      this.bullets = keep;
    },
  };
}

export function updateParticles(game, dt) {
  const keep = [];
  for (const p of game.particles) {
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.life > 0) keep.push(p);
  }
  game.particles = keep;
  const exKeep = [];
  for (const e of game.explosions) {
    e.life -= dt;
    e.r = e.maxR * (1 - e.life / e.max);
    if (e.life > 0) exKeep.push(e);
  }
  game.explosions = exKeep;
}
