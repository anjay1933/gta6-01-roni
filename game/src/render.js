// Everything the eye sees: the island from above, its cars and people, the
// lava's glow, and every screen around the game (title, briefing, pause,
// mission results, game over).
import { TILE, MAP_W, MAP_H, T, TILE_COLORS, VIEW } from './config.js';
import { hash2, clamp, lerp, formatMoney } from './random.js';

export function updateCamera(game, dt) {
  const cam = game.camera;
  const zoom = game.zoomOverride || 1;
  const tx = game.player.x - VIEW.width / 2 / zoom;
  const ty = game.player.y - VIEW.height / 2 / zoom;
  const k = 1 - Math.pow(0.001, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  cam.zoom = lerp(cam.zoom, zoom, k);
  const vw = VIEW.width / zoom;
  const vh = VIEW.height / zoom;
  if (vw < 3200) cam.x = clamp(cam.x, 0, 3200 - vw);
  else cam.x = (3200 - vw) / 2;
  if (vh < 3200) cam.y = clamp(cam.y, 0, 3200 - vh);
  else cam.y = (3200 - vh) / 2;
}

function tileColor(world, tx, ty, time) {
  const t = world.tiles[ty * MAP_W + tx];
  let c = TILE_COLORS[t];
  if (t === T.LAVA) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + tx * 0.7 + ty);
    return pulse > 0.5 ? '#ff6a1a' : '#e2481d';
  }
  if (t === T.OCEAN) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.8 + tx * 0.3 + ty * 0.5);
    return pulse > 0.75 ? '#0f4a75' : '#0d3b5e';
  }
  return c;
}

function drawTerrain(ctx, game) {
  const { world, camera } = game;
  const zoom = camera.zoom;
  const x0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((camera.x + VIEW.width / zoom) / TILE) + 1);
  const y1 = Math.min(MAP_H - 1, Math.ceil((camera.y + VIEW.height / zoom) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = world.tiles[ty * MAP_W + tx];
      const sx = (tx * TILE - camera.x) * zoom;
      const sy = (ty * TILE - camera.y) * zoom;
      const s = TILE * zoom;
      ctx.fillStyle = tileColor(world, tx, ty, world.time);
      ctx.fillRect(sx, sy, s + 0.5, s + 0.5);
      const h = hash2(tx, ty, 99);
      // Speckle: darker dots on beach and jungle, lighter on grass.
      if ((t === T.BEACH || t === T.JUNGLE || t === T.GRASS) && h < 0.5) {
        ctx.fillStyle = t === T.BEACH ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx + h * s, sy + (hash2(tx, ty, 7) * s), 3 * zoom + 1, 3 * zoom + 1);
      }
      if (t === T.JUNGLE && h > 0.55) {
        // A tree canopy dot.
        ctx.fillStyle = '#0c3d1e';
        ctx.beginPath();
        ctx.arc(sx + s * 0.3 + h * s * 0.4, sy + s * 0.3 + hash2(tx, ty, 5) * s * 0.4, 7 * zoom + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t === T.ROAD) {
        // Centre dashes: horizontal when the road runs left-right.
        const left = tx > 0 && world.tiles[ty * MAP_W + tx - 1] === T.ROAD;
        const right = tx < MAP_W - 1 && world.tiles[ty * MAP_W + tx + 1] === T.ROAD;
        const up = ty > 0 && world.tiles[(ty - 1) * MAP_W + tx] === T.ROAD;
        ctx.fillStyle = '#d8c95a';
        if (left && right && !up) ctx.fillRect(sx + s * 0.15, sy + s / 2 - 1, s * 0.7, 2);
        else if (up) ctx.fillRect(sx + s / 2 - 1, sy + s * 0.15, 2, s * 0.7);
      }
      if (t === T.DOCK) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(sx, sy + s / 2 - 1, s, 2);
      }
      if (t === T.LAVA && h > 0.6) {
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.arc(sx + s * 0.5, sy + s * 0.5, 3 * zoom + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawBuildings(ctx, game) {
  const { world, camera } = game;
  const zoom = camera.zoom;
  for (const b of world.buildings) {
    const sx = (b.x - camera.x) * zoom;
    const sy = (b.y - camera.y) * zoom;
    if (sx > VIEW.width || sy > VIEW.height || sx + b.w * zoom < 0 || sy + b.h * zoom < 0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 4 * zoom, sy + 5 * zoom, b.w * zoom, b.h * zoom);
    ctx.fillStyle = b.color;
    ctx.fillRect(sx, sy, b.w * zoom, b.h * zoom);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(sx + 5 * zoom, sy + 5 * zoom, b.w * zoom - 10 * zoom, b.h * zoom - 10 * zoom);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(sx + b.w * zoom / 2 - 3 * zoom, sy + b.h * zoom - 8 * zoom, 6 * zoom, 8 * zoom);
  }
}

function drawProps(ctx, game) {
  const { world, camera } = game;
  const zoom = camera.zoom;
  for (const p of world.props) {
    const sx = (p.x - camera.x) * zoom;
    const sy = (p.y - camera.y) * zoom;
    if (sx < -30 || sy < -30 || sx > VIEW.width + 30 || sy > VIEW.height + 30) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 3 * zoom;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 3 * zoom, sy - 8 * zoom);
      ctx.stroke();
      ctx.fillStyle = '#1d7a37';
      ctx.beginPath();
      ctx.arc(sx + 3 * zoom, sy - 10 * zoom, 9 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#27a34a';
      ctx.beginPath();
      ctx.arc(sx + 3 * zoom - 4 * zoom, sy - 12 * zoom, 5 * zoom, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'rock') {
      ctx.fillStyle = '#6e6560';
      ctx.beginPath();
      ctx.arc(sx, sy, p.r * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a807a';
      ctx.beginPath();
      ctx.arc(sx - 3 * zoom, sy - 3 * zoom, p.r * zoom * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'crate') {
      ctx.fillStyle = '#8a6a3b';
      ctx.fillRect(sx - 8 * zoom, sy - 8 * zoom, 16 * zoom, 16 * zoom);
      ctx.strokeStyle = '#5d4526';
      ctx.lineWidth = 1.5 * zoom;
      ctx.strokeRect(sx - 8 * zoom, sy - 8 * zoom, 16 * zoom, 16 * zoom);
      ctx.beginPath();
      ctx.moveTo(sx - 8 * zoom, sy - 8 * zoom);
      ctx.lineTo(sx + 8 * zoom, sy + 8 * zoom);
      ctx.moveTo(sx + 8 * zoom, sy - 8 * zoom);
      ctx.lineTo(sx - 8 * zoom, sy + 8 * zoom);
      ctx.stroke();
    }
  }
}

function drawMarkers(ctx, game) {
  const { camera } = game;
  const zoom = camera.zoom;
  for (const mk of game.markers) {
    const sx = (mk.x - camera.x) * zoom;
    const sy = (mk.y - camera.y) * zoom;
    const pulse = 1 + 0.15 * Math.sin(game.time * 4);
    const r = mk.r * zoom * pulse;
    ctx.fillStyle = 'rgba(255,217,74,0.10)';
    ctx.fillRect(sx - 3, 0, 6, VIEW.height);
    ctx.strokeStyle = mk.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = mk.color;
    ctx.font = `bold ${Math.round(15 * zoom) + 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(mk.label, sx, sy - r - 8);
    ctx.textAlign = 'left';
  }
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    const sx = (pk.x - camera.x) * zoom;
    const sy = (pk.y - camera.y) * zoom;
    const bob = Math.sin(game.time * 3 + pk.x) * 3;
    if (pk.kind === 'crate') {
      ctx.fillStyle = '#8a6a3b';
      ctx.fillRect(sx - 10, sy - 10 + bob, 20, 20);
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 10, sy - 10 + bob, 20, 20);
    } else if (pk.kind === 'gold') {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(sx, sy + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6a00';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', sx, sy + bob + 4);
      ctx.textAlign = 'left';
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 11, sy - 11 + bob, 22, 22);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(sx - 3, sy - 9 + bob, 6, 18);
      ctx.fillRect(sx - 9, sy - 3 + bob, 18, 6);
    }
  }
  // The getaway boat at the dock.
  const boat = game.world.places.boat;
  const bx = (boat.x - camera.x) * zoom;
  const by = (boat.y - camera.y) * zoom;
  ctx.save();
  ctx.translate(bx, by);
  ctx.fillStyle = '#f5f0e6';
  ctx.beginPath();
  ctx.ellipse(0, 0, 34 * zoom, 13 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-14 * zoom, -8 * zoom, 22 * zoom, 12 * zoom);
  ctx.restore();
}

export function drawWorld(ctx, game) {
  const { camera } = game;
  const zoom = camera.zoom;
  // Everything draws in screen space: world coords are mapped by hand.
  drawTerrain(ctx, game);
  drawBuildings(ctx, game);
  drawProps(ctx, game);
  drawMarkers(ctx, game);
  // Cars and people, sorted so the player draws last.
  const zoom2 = camera.zoom;
  for (const car of game.cars) {
    const sx = (car.x - camera.x) * zoom2;
    const sy = (car.y - camera.y) * zoom2;
    if (sx < -80 || sy < -80 || sx > VIEW.width + 80 || sy > VIEW.height + 80) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle);
    ctx.scale(zoom2, zoom2);
    const specW = car.kind === 'truck' ? 58 : car.kind === 'pickup' ? 50 : 46;
    const specH = car.kind === 'truck' ? 28 : 26;
    ctx.fillStyle = '#111';
    ctx.fillRect(-specW / 2 + 4, -specH / 2 - 3, 12, 5);
    ctx.fillRect(-specW / 2 + 4, specH / 2 - 2, 12, 5);
    ctx.fillRect(specW / 2 - 16, -specH / 2 - 3, 12, 5);
    ctx.fillRect(specW / 2 - 16, specH / 2 - 2, 12, 5);
    ctx.fillStyle = car.wrecked ? '#222' : car.color;
    ctx.beginPath();
    ctx.roundRect(-specW / 2, -specH / 2, specW, specH, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(specW / 2 - 16, -specH / 2 + 4, 8, specH - 8);
    if (car.kind === 'police' && !car.wrecked) {
      const flash = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-8, -specH / 2 - 1, 7, 5);
      ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(1, -specH / 2 - 1, 7, 5);
    }
    ctx.restore();
    if (car.hp < car.maxHp && !car.wrecked) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx - 18, sy - 24 * zoom2, 36, 5);
      ctx.fillStyle = car.hp > car.maxHp * 0.4 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(sx - 18, sy - 24 * zoom2, 36 * (car.hp / car.maxHp), 5);
    }
  }
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const sx = (ped.x - camera.x) * zoom2;
    const sy = (ped.y - camera.y) * zoom2;
    if (sx < -40 || sy < -40 || sx > VIEW.width + 40 || sy > VIEW.height + 40) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(zoom2, zoom2);
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'guard' || ped.kind === 'rival' || ped.kind === 'cop') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
    }
    ctx.restore();
    if ((ped.kind === 'guard' || ped.kind === 'rival' || ped.kind === 'cop') && ped.hp < ped.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx - 14, sy - 24, 28, 4);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(sx - 14, sy - 24, 28 * (ped.hp / ped.maxHp), 4);
    }
  }
  // The player (on foot: a driver in a red jacket; in a car: the car itself).
  const p = game.player;
  if (!p.dead) {
    const sx = (p.x - camera.x) * zoom2;
    const sy = (p.y - camera.y) * zoom2;
    if (p.onFoot) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(zoom2, zoom2);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d7a1';
      ctx.beginPath();
      ctx.arc(4, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Bullets.
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2.5;
  for (const b of game.combat.bullets) {
    const sx = (b.x - camera.x) * zoom2;
    const sy = (b.y - camera.y) * zoom2;
    const len = 14;
    const n = Math.hypot(b.vx, b.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - (b.vx / n) * len, sy - (b.vy / n) * len);
    ctx.stroke();
  }
  // Particles.
  for (const pt of game.particles) {
    const sx = (pt.x - camera.x) * zoom2;
    const sy = (pt.y - camera.y) * zoom2;
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(sx, sy, pt.size * zoom2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Explosions.
  for (const e of game.explosions) {
    const sx = (e.x - camera.x) * zoom2;
    const sy = (e.y - camera.y) * zoom2;
    const a = e.life / e.max;
    ctx.fillStyle = `rgba(255,122,26,${0.55 * a})`;
    ctx.beginPath();
    ctx.arc(sx, sy, e.r * zoom2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,217,74,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, e.r * zoom2 * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- screens ----------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,10,14,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,217,74,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export function drawTitle(ctx, game) {
  // The island from high above, darkened, behind the title.
  const cam = game.camera;
  const savedZoom = game.zoomOverride;
  game.zoomOverride = 0.24;
  cam.x = (3200 - VIEW.width / 0.24) / 2;
  cam.y = (3200 - VIEW.height / 0.24) / 2 - 200;
  cam.zoom = 0.24;
  drawWorld(ctx, game);
  game.zoomOverride = savedZoom;
  ctx.fillStyle = 'rgba(5,8,12,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6a1a';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('EMBER ISLE', VIEW.width / 2, 200);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('A GTA-style open world on a volcano island', VIEW.width / 2, 248);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Rico, getaway driver. Six jobs. Five stars. One boat out.', VIEW.width / 2, 290);
  panel(ctx, VIEW.width / 2 - 330, 340, 660, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(game.save && game.save.unlocked > 0 ? 'ENTER — Continue  (mission ' + (game.save.unlocked + 1) + ' unlocked)' : 'ENTER — New game', VIEW.width / 2, 380);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('WASD / arrows — move & drive      Mouse — aim      Click — shoot', VIEW.width / 2, 420);
  ctx.fillText('E — enter / exit car      Space — handbrake      P — pause      M — mute', VIEW.width / 2, 448);
  ctx.fillText('Steal cars, outrun the police, finish all 6 missions.', VIEW.width / 2, 486);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Progress saves automatically after every mission.', VIEW.width / 2, 516);
  ctx.textAlign = 'left';
}

export function drawBrief(ctx, game) {
  const m = game.mission;
  if (!m) return;
  ctx.fillStyle = 'rgba(5,8,12,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 360, 180, 720, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('MISSION ' + m.def.id + ' OF 6', VIEW.width / 2, 222);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(m.def.title, VIEW.width / 2, 268);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ddd';
  wrapText(ctx, m.def.brief, VIEW.width / 2, 306, 640, 24);
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Reward: ' + formatMoney(m.def.reward), VIEW.width / 2, 388);
  ctx.fillStyle = '#ffd94a';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER to start — or wait a moment', VIEW.width / 2, 416);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5,8,12,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
  ctx.font = '18px sans-serif';
  ctx.fillText('P — resume      R — restart mission', VIEW.width / 2, VIEW.height / 2 + 30);
  ctx.textAlign = 'left';
}

export function drawMissionEnd(ctx, game) {
  const m = game.mission;
  if (!m) return;
  ctx.fillStyle = 'rgba(5,8,12,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 340, 200, 680, 240);
  ctx.textAlign = 'center';
  if (m.phase === 'done') {
    ctx.fillStyle = '#7ee081';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('MISSION COMPLETE', VIEW.width / 2, 258);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText(m.def.title + '  —  +' + formatMoney(m.def.reward), VIEW.width / 2, 300);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('ENTER — next mission', VIEW.width / 2, 352);
    ctx.fillStyle = '#ccc';
    ctx.fillText('Cash: ' + formatMoney(game.player.money), VIEW.width / 2, 388);
  } else if (m.phase === 'failed') {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('MISSION FAILED', VIEW.width / 2, 258);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(m.failReason || 'Try again.', VIEW.width / 2, 300);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('ENTER — retry mission', VIEW.width / 2, 352);
  } else if (m.phase === 'complete') {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('EMBER ISLE COMPLETE', VIEW.width / 2, 258);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Rico got away with the gold. All 6 missions done.', VIEW.width / 2, 300);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#7ee081';
    ctx.fillText('Total cash: ' + formatMoney(game.player.money), VIEW.width / 2, 344);
    ctx.fillStyle = '#ccc';
    ctx.fillText('ENTER — free roam the island', VIEW.width / 2, 388);
  }
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx, game) {
  ctx.fillStyle = 'rgba(20,4,4,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a3c';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('WASTED', VIEW.width / 2, VIEW.height / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Rico went down on mission ' + (game.mission ? game.mission.def.id : '?') + ' — ' + (game.mission ? game.mission.def.title : ''), VIEW.width / 2, VIEW.height / 2 + 24);
  ctx.fillStyle = '#ffd94a';
  ctx.font = '17px sans-serif';
  ctx.fillText('ENTER — retry the mission', VIEW.width / 2, VIEW.height / 2 + 62);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, yy);
}
