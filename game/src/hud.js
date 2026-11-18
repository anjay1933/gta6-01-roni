// FROSTLINE — HUD: cash, objective, wanted stars, health/armor, ammo, speed, minimap.
import { ROADS, BUILDINGS, LAKE } from './config.js';

// Minimap geometry: the 700 m-wide world (-350..350) fits a 168 px square.
const MAP_PX = 168;
const MAP_SPAN = 700;

export class HUD {
  constructor(G) {
    this.G = G;
    this.flashTimer = 0;
    // Grab every HUD node once; the ids are fixed by index.html.
    const $ = (id) => document.getElementById(id);
    this.el = {
      cash: $('hud-cash'), objective: $('hud-objective'), distance: $('hud-distance'),
      stars: $('hud-stars'), health: $('hud-health'), armor: $('hud-armor'),
      ammo: $('hud-ammo'), speed: $('hud-speed'), flash: $('hud-flash'),
      minimap: $('minimap'), missionCard: $('mission-card'),
      missionTitle: $('mission-title'), missionText: $('mission-text'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
  }

  // World (x, z) -> minimap (px, py).
  project(x, z) {
    return [(x + 350) / MAP_SPAN * MAP_PX, (z + 350) / MAP_SPAN * MAP_PX];
  }

  update(dt) {
    const G = this.G, p = G.player;
    this.el.cash.textContent = `$${p.cash}`;
    this.el.objective.textContent = G.missions.objectiveText();
    const d = G.missions.objectiveDistance();
    this.el.distance.textContent = G.missions.active ? `${d} m` : '';
    const filled = '★'.repeat(G.wanted.stars), empty = '☆'.repeat(5 - G.wanted.stars);
    this.el.stars.textContent = filled + empty;
    this.el.stars.style.color = G.wanted.stars > 0 ? '#ff5040' : '#8a93a8';
    this.el.health.style.width = `${Math.max(0, p.health)}%`;
    this.el.armor.style.width = `${Math.max(0, p.armor)}%`;
    this.el.ammo.textContent = p.inCar ? 'DRIVE-BY [R]' : `AMMO ${p.ammo}`;
    const kmh = p.inCar ? Math.abs(p.inCar.speed) * 3.6 : 0;
    this.el.speed.textContent = `${Math.round(kmh)} km/h`;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.el.flash.style.opacity = '0';
    }
    this.drawMinimap();
  }

  flash(text) {
    this.el.flash.textContent = text;
    this.el.flash.style.opacity = '1';
    this.flashTimer = 3;
  }

  showMission(m) {
    this.el.missionTitle.textContent = `Mission ${m.id} — ${m.title} ($${m.pay})`;
    this.el.missionText.textContent = m.intro;
    this.el.missionCard.style.opacity = '1';
    setTimeout(() => { this.el.missionCard.style.opacity = '0'; }, 7000);
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    ctx.clearRect(0, 0, MAP_PX, MAP_PX);
    ctx.fillStyle = 'rgba(10,14,28,0.82)';
    ctx.fillRect(0, 0, MAP_PX, MAP_PX);
    this.drawLake(ctx);
    this.drawRoads(ctx);
    this.drawBuildings(ctx);
    this.drawObjective(ctx);
    this.drawPolice(ctx);
    this.drawPlayer(ctx);
  }

  drawLake(ctx) {
    ctx.fillStyle = '#7fc4de';
    ctx.beginPath();
    const [lx, lz] = this.project(LAKE.x, LAKE.z);
    ctx.ellipse(lx, lz, LAKE.rx / MAP_SPAN * MAP_PX, LAKE.rz / MAP_SPAN * MAP_PX, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRoads(ctx) {
    ctx.strokeStyle = '#5a6274';
    ctx.lineWidth = 3;
    for (const r of ROADS) {
      const [ax, az] = this.project(r.ax, r.az);
      const [bx, bz] = this.project(r.bx, r.bz);
      ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke();
    }
  }

  drawBuildings(ctx) {
    ctx.fillStyle = '#c8a06a';
    for (const b of BUILDINGS) {
      const [bx, bz] = this.project(b.x, b.z);
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    }
  }

  drawObjective(ctx) {
    const pt = this.G.missions.objectivePoint();
    if (!pt || !this.G.missions.active) return;
    const [mx, mz] = this.project(pt[0], pt[1]);
    ctx.fillStyle = '#ffc030';
    ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffc030'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, mz, 8 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  drawPolice(ctx) {
    ctx.fillStyle = '#ff5040';
    for (const c of this.G.wanted.police) {
      if (c.destroyed) continue;
      const [cx, cz] = this.project(c.x, c.z);
      ctx.beginPath(); ctx.arc(cx, cz, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawPlayer(ctx) {
    const p = this.G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const pa = p.inCar ? p.inCar.angle : p.angle;
    const [ux, uz] = this.project(px, pz);
    ctx.save();
    ctx.translate(ux, uz);
    ctx.rotate(Math.PI - pa);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
