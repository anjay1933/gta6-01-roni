// The autopilot: it plays EMBER ISLE through the same virtual keys a human
// presses, so the verify run and the screenshot scenes are real play, not
// scripted teleports. It walks, steals cars, drives, kites and shoots.
// Driving plans an A* route over the island's driveable tiles (roads cheap,
// jungle dear, buildings blocked) because steering straight at a target
// ploughs into buildings and wedges the car between them.
import { missionTarget } from './missions.js';
import { dist, angleTo, angleDiff, clamp } from './random.js';
import { nearestCar } from './player.js';
import { TILE, MAP_W, MAP_H, T } from './config.js';
import { tileDriveable } from './world.js';

// --- A* over the tile grid, for cars ---

function tileCost(t) {
  if (t === T.ROAD || t === T.TOWN || t === T.DOCK) return 1;
  if (t === T.GRASS) return 2;
  if (t === T.BEACH) return 2.5;
  return 3; // jungle: slow going
}

// A route from (fromX, fromY) to (toX, toY) as pixel waypoints: only the
// tiles where the direction changes, plus the goal tile and the exact
// target. Returns just the target when no route exists.
function astarPath(world, fromX, fromY, toX, toY) {
  // Buildings block tiles: a tile whose centre falls in a building rect
  // (grown by a car's half-width) is not driveable.
  const blocked = new Set();
  for (const b of world.buildings) {
    const x0 = Math.floor((b.x - 12) / TILE);
    const x1 = Math.floor((b.x + b.w + 12) / TILE);
    const y0 = Math.floor((b.y - 12) / TILE);
    const y1 = Math.floor((b.y + b.h + 12) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) blocked.add(ty * MAP_W + tx);
      }
    }
  }
  const driveable = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    const i = ty * MAP_W + tx;
    return !blocked.has(i) && tileDriveable(world.tiles[i]);
  };
  const sx = clamp(Math.floor(fromX / TILE), 0, MAP_W - 1);
  const sy = clamp(Math.floor(fromY / TILE), 0, MAP_H - 1);
  let gx = clamp(Math.floor(toX / TILE), 0, MAP_W - 1);
  let gy = clamp(Math.floor(toY / TILE), 0, MAP_H - 1);
  // If the goal tile itself is blocked, aim at the nearest open tile.
  if (!driveable(gx, gy)) {
    let best = null;
    let bestD = Infinity;
    for (let r = 1; r <= 5 && !best; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (!driveable(nx, ny)) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestD) {
            bestD = d;
            best = [nx, ny];
          }
        }
      }
    }
    if (!best) return [{ x: toX, y: toY }];
    [gx, gy] = best;
  }
  const key = (x, y) => y * MAP_W + x;
  const heur = (x, y) => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.41],
    [1, -1, 1.41],
    [-1, 1, 1.41],
    [-1, -1, 1.41],
  ];
  const open = [{ x: sx, y: sy, g: 0, f: heur(sx, sy) }];
  const gScore = new Map([[key(sx, sy), 0]]);
  const parent = new Map();
  const closed = new Set();
  let found = false;
  let guard = 0;
  while (open.length > 0 && guard++ < 20000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === gx && cur.y === gy) {
      found = true;
      break;
    }
    for (const [dx, dy, step] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!driveable(nx, ny)) continue;
      // No cutting corners: a diagonal needs both orthogonal neighbours open.
      if (dx !== 0 && dy !== 0 && (!driveable(nx, cur.y) || !driveable(cur.x, ny))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = cur.g + step * tileCost(world.tiles[ny * MAP_W + nx]);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        parent.set(nk, ck);
        open.push({ x: nx, y: ny, g: ng, f: ng + heur(nx, ny) });
      }
    }
  }
  if (!found) return [{ x: toX, y: toY }];
  const tiles = [];
  let ck = key(gx, gy);
  while (ck !== key(sx, sy)) {
    tiles.unshift(ck);
    ck = parent.get(ck);
    if (ck === undefined) break;
  }
  const pts = [];
  let prevDir = null;
  let prev = { x: sx, y: sy };
  for (const k of tiles) {
    const tx = k % MAP_W;
    const ty = Math.floor(k / MAP_W);
    const dir = [Math.sign(tx - prev.x), Math.sign(ty - prev.y)];
    if (prevDir && (dir[0] !== prevDir[0] || dir[1] !== prevDir[1])) {
      pts.push({ x: prev.x * TILE + TILE / 2, y: prev.y * TILE + TILE / 2 });
    }
    prevDir = dir;
    prev = { x: tx, y: ty };
  }
  pts.push({ x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 });
  pts.push({ x: toX, y: toY });
  return pts;
}

// The nearest car worth stealing: a civilian car first, a police cruiser
// only when nothing else is around.
function nearestStealableCar(cars, x, y) {
  let best = null;
  let bestD = 4000;
  for (const car of cars) {
    if (car.wrecked || car.driver === 'police') continue;
    const d = dist(car.x, car.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best || nearestCar(cars, x, y, 4000);
}

const SIDE_DIRS = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
];

export function createAutopilot(game) {
  let reverseTimer = 0;
  let stuckCheckTimer = 0;
  let lastPos = { x: 0, y: 0 };
  let sideTimer = 0;
  let sideIdx = 0;
  let drivePath = null;
  let drivePathKey = '';
  let driveWp = 0;
  let lastMissionIndex = -1;

  function clearDriveKeys(input) {
    for (const k of ['w', 'a', 's', 'd', ' ']) input.setVirtual(k, false);
  }

  // Hands off every control: used whenever the autopilot is not actively
  // playing, so no virtual key stays held from the last thing it did.
  function idle(input) {
    clearDriveKeys(input);
    input.setVirtualMouse(input.mouse.x, input.mouse.y, false);
  }

  function walkToward(input, fromX, fromY, tx, ty) {
    const dx = tx - fromX;
    const dy = ty - fromY;
    input.setVirtual('w', dy < -12);
    input.setVirtual('s', dy > 12);
    input.setVirtual('a', dx < -12);
    input.setVirtual('d', dx > 12);
  }

  // Steer the car toward a point. Reversing flips the steering keys,
  // because a reversing car turns its nose the other way.
  function driveToward(input, car, tx, ty) {
    const want = angleTo(car.x, car.y, tx, ty);
    const diff = angleDiff(car.angle, want);
    const d = dist(car.x, car.y, tx, ty);
    let reversing = false;
    if (reverseTimer > 0) {
      reverseTimer -= 1 / 60;
      reversing = true;
    } else if (Math.abs(diff) > 2.4 && d > 120) {
      reversing = true; // facing away: swing the nose around
    }
    if (reversing) {
      input.setVirtual('w', false);
      input.setVirtual('s', true);
      input.setVirtual('a', diff > 0.12);
      input.setVirtual('d', diff < -0.12);
    } else {
      // Ease in close to the target: a fast car cannot turn tightly
      // enough to hit a small marker, so it orbits forever. Brake first.
      if (d < 130 && Math.abs(car.speed) > 110) {
        input.setVirtual('w', false);
        input.setVirtual('s', true);
      } else {
        input.setVirtual('w', true);
        input.setVirtual('s', false);
      }
      input.setVirtual('a', diff < -0.12);
      input.setVirtual('d', diff > 0.12);
    }
  }

  // The next A* waypoint on the way to (tx, ty), or the target itself
  // when it is close. Re-plans when the target or the mission changes.
  function driveWaypoint(game, tx, ty) {
    const p = game.player;
    const key = game.mission.index + ':' + Math.round(tx / 100) + ',' + Math.round(ty / 100);
    if (!drivePath || drivePathKey !== key || lastMissionIndex !== game.mission.index) {
      drivePathKey = key;
      lastMissionIndex = game.mission.index;
      drivePath = astarPath(game.world, p.x, p.y, tx, ty);
      driveWp = 0;
    }
    while (driveWp < drivePath.length - 1 && dist(p.x, p.y, drivePath[driveWp].x, drivePath[driveWp].y) < 70) {
      driveWp++;
    }
    const last = drivePath[drivePath.length - 1];
    if (dist(p.x, p.y, last.x, last.y) < 200) return last;
    return drivePath[driveWp];
  }

  function aimAtNearestEnemy(input, game) {
    const p = game.player;
    let best = null;
    let bestD = 520;
    for (const ped of game.peds) {
      if (ped.dead || (ped.kind !== 'guard' && ped.kind !== 'rival' && ped.kind !== 'cop')) continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (!best) {
      input.setVirtualMouse(input.mouse.x, input.mouse.y, false);
      return null;
    }
    const cam = game.camera;
    const sx = (best.x - cam.x) * cam.zoom;
    const sy = (best.y - cam.y) * cam.zoom;
    input.setVirtualMouse(sx, sy, true);
    return best;
  }

  return {
    // One frame of play. Called before the world's step.
    update(game, dt) {
      const input = game.input;
      const p = game.player;
      const m = game.mission;
      // A virtual E tap lasts one step: release it before pressing anything new.
      input.setVirtual('e', false);

      // Menus first: start briefings, advance past results, retry failures.
      if (game.screen === 'title') {
        idle(input);
        input.pressVirtual('Enter');
        return;
      }
      if (m && m.phase === 'brief') {
        idle(input);
        input.pressVirtual('Enter');
        return;
      }
      if (m && (m.phase === 'done' || m.phase === 'failed')) {
        idle(input);
        input.pressVirtual('Enter');
        return;
      }
      if (m && m.phase === 'complete') {
        idle(input);
        return; // the run is over; the verify harness reads the result
      }
      if (game.screen !== 'play' || !m || m.phase !== 'active') return;

      const target = missionTarget(game);
      if (!target) {
        idle(input);
        return;
      }

      // Stuck detection: if the player barely moved in 2s, back out.
      stuckCheckTimer += dt;
      if (stuckCheckTimer > 2) {
        stuckCheckTimer = 0;
        const moved = dist(p.x, p.y, lastPos.x, lastPos.y);
        lastPos = { x: p.x, y: p.y };
        if (moved < 24 && !p.onFoot && p.car) {
          reverseTimer = 0.8;
          drivePath = null; // re-plan the route from the new position
        } else if (moved < 24 && p.onFoot) {
          // Wedged on foot: try the next compass direction.
          sideTimer = 0.8;
          sideIdx = (sideIdx + 1) % SIDE_DIRS.length;
        }
      }

      // Combat: always shoot the nearest enemy in range. Kiting — backing
      // away while firing — only kicks in when Rico is hurt (< 50 hp):
      // kiting at full health lets the guards herd him away from his
      // objective forever, because every step toward a crate closes the
      // distance and every step back re-opens it. Healthy Rico pushes
      // through the fire and grabs the crate; hurt Rico falls back to heal.
      const enemy = aimAtNearestEnemy(input, game);
      const kiting = enemy && dist(p.x, p.y, enemy.x, enemy.y) < 200 && p.onFoot && p.hp < 50;

      if (target.needCar && p.onFoot) {
        // On foot but the job needs wheels: steal the nearest car.
        const car = nearestStealableCar(game.cars, p.x, p.y);
        if (car) {
          if (dist(p.x, p.y, car.x, car.y) < 60) {
            input.pressVirtual('e');
            clearDriveKeys(input);
          } else {
            walkToward(input, p.x, p.y, car.x, car.y);
          }
        }
        return;
      }

      if (!target.needCar && !p.onFoot) {
        // The job is on foot: get out of the car.
        input.pressVirtual('e');
        clearDriveKeys(input);
        return;
      }

      if (!p.onFoot && p.car) {
        const wp = driveWaypoint(game, target.x, target.y);
        driveToward(input, p.car, wp.x, wp.y);
      } else if (kiting) {
        // Back away from the shooter while firing.
        const away = angleTo(enemy.x, enemy.y, p.x, p.y);
        walkToward(input, p.x, p.y, p.x + Math.cos(away) * 120, p.y + Math.sin(away) * 120);
      } else if (sideTimer > 0) {
        // Sidestep out of whatever corner the walk ran into.
        sideTimer -= dt;
        const [sx, sy] = SIDE_DIRS[sideIdx];
        input.setVirtual('w', sy < 0);
        input.setVirtual('s', sy > 0);
        input.setVirtual('a', sx < 0);
        input.setVirtual('d', sx > 0);
      } else {
        walkToward(input, p.x, p.y, target.x, target.y);
      }
    },
  };
}

// The verify run: play all six missions with the autopilot at high speed
// and report the result on window.__verify for the harness to read.
export function createVerifyRun(game) {
  const results = [];
  let current = -1;
  let retries = 0;
  let startedAt = performance.now();
  let logged = new Set();

  function log(msg) {
    console.log('[VERIFY] ' + msg);
  }

  return {
    results,
    update(dt) {
      const m = game.mission;
      if (!m) return;
      if (m.index !== current) {
        current = m.index;
        retries = 0;
        log('mission ' + (m.index + 1) + ' started: ' + m.def.title);
      }
      if (m.phase === 'done' && !logged.has('done' + m.index)) {
        logged.add('done' + m.index);
        results.push({ mission: m.index + 1, title: m.def.title, ok: true, retries });
        log('mission ' + (m.index + 1) + ' COMPLETE (' + m.def.title + ')');
      }
      if (m.phase === 'failed' && !logged.has('fail' + m.index + ':' + retries)) {
        logged.add('fail' + m.index + ':' + retries);
        retries++;
        log('mission ' + (m.index + 1) + ' FAILED, retry ' + retries + ': ' + (m.failReason || ''));
      }
      if (m.phase === 'complete' && !window.__verify) {
        results.push({ mission: 6, title: m.def.title, ok: true, retries });
        const elapsed = Math.round((performance.now() - startedAt) / 1000);
        log('ALL 6 MISSIONS COMPLETE in ' + elapsed + 's');
        window.__verify = { done: true, ok: true, results, seconds: elapsed };
      }
      // Safety valve: 7 minutes of real time and the run reports partial.
      if (!window.__verify && performance.now() - startedAt > 7 * 60 * 1000) {
        log('VERIFY TIMEOUT — partial results');
        window.__verify = { done: true, ok: false, results, timeout: true };
      }
    },
  };
}
