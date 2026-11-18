// The HUD: health, cash, wanted stars, objective banner, mission timer,
// toasts, context prompts and the minimap in the corner.
import { TILE, WORLD_W, WORLD_H, T, TILE_COLORS } from './config.js';
import { formatMoney, formatTime, clamp } from './random.js';
import { missionObjectiveText, missionTarget } from './missions.js';

const MAP_SIZE = 168;

export function buildMinimap(world) {
  const c = document.createElement('canvas');
  c.width = MAP_SIZE;
  c.height = MAP_SIZE;
  const g = c.getContext('2d');
  const scale = MAP_SIZE / WORLD_W;
  for (let ty = 0; ty < 80; ty++) {
    for (let tx = 0; tx < 80; tx++) {
      const t = world.tiles[ty * 80 + tx];
      g.fillStyle = TILE_COLORS[t] || '#000';
      g.fillRect(tx * TILE * scale, ty * TILE * scale, TILE * scale + 0.5, TILE * scale + 0.5);
    }
  }
  // Volcano crater dot.
  g.fillStyle = '#ff5a1f';
  g.beginPath();
  g.arc(world.places.volcano.x * scale, world.places.volcano.y * scale, 4, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawStars(ctx, stars, x, y) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
}

export function drawHUD(ctx, game) {
  const { player, wanted, mission } = game;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // --- top-left: health + cash ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 14, 250, 64);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(24, 26, 150, 14);
  ctx.fillStyle = player.hp > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(24, 26, 150 * clamp(player.hp / player.maxHp, 0, 1), 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeRect(24, 26, 150, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('RICO', 180, 33);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#7ee081';
  ctx.fillText(formatMoney(player.money), 24, 60);

  // --- top-right: wanted stars ---
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 180, 14, 166, 44);
  drawStars(ctx, wanted.stars, W - 168, 36);

  // --- top-center: objective banner ---
  const objective = missionObjectiveText(game);
  if (objective) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(objective).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - tw / 2 - 14, 14, tw + 28, 34);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(objective, W / 2 - tw / 2, 32);
  }

  // --- mission timer (mission 4) ---
  if (mission && mission.index === 3 && mission.phase === 'active') {
    ctx.font = 'bold 26px monospace';
    const ts = formatTime(mission.timer);
    ctx.fillStyle = mission.timer < 30 ? '#ff5a3c' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(ts, W / 2, 78);
    ctx.textAlign = 'left';
  }

  // --- context prompt (bottom-center) ---
  const prompt = game.prompt;
  if (prompt) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(prompt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - tw / 2 - 12, H - 46, tw + 24, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(prompt, W / 2 - tw / 2, H - 30);
  }

  // --- toasts ---
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  game.toasts.forEach((t, i) => {
    ctx.globalAlpha = Math.min(1, t.life / 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const tw = ctx.measureText(t.text).width;
    ctx.fillRect(W / 2 - tw / 2 - 10, 96 + i * 30, tw + 20, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, W / 2, 108 + i * 30);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left';

  // --- damage vignette ---
  if (player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(231,76,60,${0.22 * (player.hurtTimer / 0.5)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawMinimap(ctx, game);

  // --- off-screen objective arrow ---
  const target = missionTarget(game);
  if (target) {
    const cam = game.camera;
    const sx = (target.x - cam.x) * cam.zoom;
    const sy = (target.y - cam.y) * cam.zoom;
    if (sx < 40 || sx > W - 40 || sy < 90 || sy > H - 90) {
      const cx = clamp(sx, 50, W - 50);
      const cy = clamp(sy, 100, H - 60);
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd94a';
      ctx.fillText(target.label + '  ' + Math.round(Math.hypot(target.x - player.x, target.y - player.y)) + 'm', cx + 18, cy + 4);
    }
  }
}

function drawMinimap(ctx, game) {
  const { world, player } = game;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const x0 = 14;
  const y0 = H - MAP_SIZE - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  if (game.minimapCanvas) ctx.drawImage(game.minimapCanvas, x0, y0);
  const scale = MAP_SIZE / WORLD_W;
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Markers + pickups.
  for (const mk of game.markers) {
    const pulse = 4 + Math.sin(game.time * 4) * 1.5;
    dot(mk.x, mk.y, pulse, mk.color);
  }
  for (const pk of game.pickups) {
    if (!pk.taken) dot(pk.x, pk.y, 3, pk.kind === 'gold' ? '#ffd94a' : '#7ee081');
  }
  for (const car of game.cars) {
    if (car.wrecked) continue;
    dot(car.x, car.y, car.driver === 'police' ? 3.5 : 2, car.driver === 'police' ? '#4a90ff' : '#cccccc');
  }
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (ped.kind === 'rival' || ped.kind === 'guard') dot(ped.x, ped.y, 2.5, '#ff5a3c');
    else if (ped.kind === 'cop') dot(ped.x, ped.y, 2.5, '#4a90ff');
  }
  // Player: white ring.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + player.x * scale, y0 + player.y * scale, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  // North + label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', x0 + MAP_SIZE / 2 - 4, y0 - 8 + 4);
  ctx.fillText('EMBER ISLE', x0, y0 + MAP_SIZE + 12);
}
