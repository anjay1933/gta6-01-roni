// The wanted level: heat rises with crimes, stars follow thresholds, and
// the island's police answer with cruisers and foot cops.
import { WANTED, POLICE } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './people.js';
import { clamp, dist } from './random.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0,
    lastCrimeAt: -999,
    time: 0,
    addHeat(amount) {
      this.heat = Math.min(320, this.heat + amount);
      this.lastCrimeAt = this.time;
      const next = this.starsFromHeat();
      if (next > this.stars) {
        this.stars = next;
      }
    },
    starsFromHeat() {
      let s = 0;
      for (let i = 0; i < WANTED.thresholds.length; i++) {
        if (this.heat >= WANTED.thresholds[i]) s = i;
      }
      return Math.min(WANTED.maxStars, s);
    },
    setStars(n) {
      this.stars = clamp(n, 0, WANTED.maxStars);
      this.heat = WANTED.thresholds[this.stars] || 0;
      this.lastCrimeAt = this.time;
    },
    clear() {
      this.stars = 0;
      this.heat = 0;
    },
  };
}

export function updateWanted(game, dt) {
  const w = game.wanted;
  w.time += dt;
  // Heat cools off when the player has been quiet for a while.
  if (w.time - w.lastCrimeAt > WANTED.graceAfterCrime && w.heat > 0) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt);
    const s = w.starsFromHeat();
    if (s < w.stars) w.stars = s;
  }

  // Police presence follows the stars.
  const wantCars = POLICE.carsPerStar[w.stars];
  const wantCops = POLICE.footCopsPerStar[w.stars];
  const p = game.player;
  const policeCars = game.cars.filter((c) => c.driver === 'police' && !c.wrecked);
  const footCops = game.peds.filter((x) => x.kind === 'cop' && !x.dead);

  if (policeCars.length < wantCars) {
    const car = spawnPoliceCar(game);
    if (car) game.cars.push(car);
  }
  if (footCops.length < wantCops && w.stars >= 2) {
    const a = Math.random() * Math.PI * 2;
    const cop = makePed(game.world, p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320, 'cop');
    game.peds.push(cop);
  }
  // Despawn police that fell far behind, and all of them once the heat is off.
  // Wrecked cruisers go as soon as they are out of sight, so they never pile up.
  game.cars = game.cars.filter((c) => !(c.driver === 'police' && w.stars === 0 && dist(c.x, c.y, p.x, p.y) > 600));
  game.cars = game.cars.filter((c) => !(c.wrecked && c.driver === 'police' && dist(c.x, c.y, p.x, p.y) > 300));
}

function spawnPoliceCar(game) {
  const { world, player, rng } = game;
  // Spawn on a road node some distance from the player, never on top of him.
  const nodes = world.roadNodes.filter((n) => {
    const d = dist(n.x, n.y, player.x, player.y);
    return d > 500 && d < 1100;
  });
  const spot = nodes.length > 0 ? rng.pick(nodes) : { x: player.x + 700, y: player.y };
  const car = makeCar(world, spot.x + rng.range(-30, 30), spot.y + rng.range(-30, 30), 'police', 'police');
  car.angle = Math.atan2(player.y - car.y, player.x - car.x);
  return car;
}
