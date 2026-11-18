// FROSTLINE — HUD: cash, objective, wanted stars, health/armor, ammo, speed, minimap.
import { ROADS, BUILDINGS, LAKE } from './config.js';

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {
      cash: document.getElementById('hud-cash'),
      objective: document.getElementById('hud-objective'),
      distance: document.getElementById('hud-distance'),
      stars: document.getElementById('hud-stars'),
      health: document.getElementById('hud-health'),
      armor: document.getElementById('hud-armor'),
      ammo: document.getElementById('hud-ammo'),
      speed: document.getElementById('hud-speed'),
      flash: document.getElementById('hud-flash'),
      minimap: document.getElementById('minimap'),
      missionCard: document.getElementById('mission-card'),
      missionTitle: document.getElementById('mission-title'),
      missionText: document.getElementById('mission-text'),
    };
    this.flashTimer = 0;
    this.mapCtx = this.el.minimap.getContext('2d');
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

  update(dt) {
    const G = this.G, p = G.player;
    this.el.cash.textContent = `$${p.cash}`;
    this.el.objective.textContent = G.missions.objectiveText();
    const d = G.missions.objectiveDistance();
    this.el.distance.textContent = G.missions.active ? `${d} m` : '';
    const stars = '★'.repeat(G.wanted.stars) + '☆'.repeat(5 - G.wanted.stars);
    this.el.stars.textContent = stars;
    this.el.stars.style.color = G.wanted.stars > 0 ? '#ff5040' : '#8a93a8';
    this.el.health.style.width = `${Math.max(0, p.health)}%`;
    this.el.armor.style.width = `${Math.max(0, p.armor)}%`;
    this.el.ammo.textContent = p.inCar ? 'DRIVE-BY [R]' : `AMMO ${p.ammo}`;
    const speed = p.inCar ? Math.abs(p.inCar.speed) * 3.6 : 0;
    this.el.speed.textContent = `${Math.round(speed)} km/h`;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.el.flash.style.opacity = '0';
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 168, W = 700; // world -350..350 maps to 0..168
    const toMap = (x, z) => [(x + 350) / W * S, (z + 350) / W * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10,14,28,0.82)';
    ctx.fillRect(0, 0, S, S);
    // Frozen lake.
    ctx.fillStyle = '#7fc4de';
    ctx.beginPath();
    const [lx, lz] = toMap(LAKE.x, LAKE.z);
    ctx.ellipse(lx, lz, LAKE.rx / W * S, LAKE.rz / W * S, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roads.
    ctx.strokeStyle = '#5a6274';
    ctx.lineWidth = 3;
    for (const r of ROADS) {
      const [ax, az] = toMap(r.ax, r.az), [bx, bz] = toMap(r.bx, r.bz);
      ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#c8a06a';
    for (const b of BUILDINGS) {
      const [bx, bz] = toMap(b.x, b.z);
      ctx.fillRect(bx - 2, bz - 2, 4, 4);
    }
    // Mission marker.
    const pt = this.G.missions.objectivePoint();
    if (pt && this.G.missions.active) {
      const [mx, mz] = toMap(pt[0], pt[1]);
      ctx.fillStyle = '#ffc030';
      ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffc030'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, mz, 8 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Police blips.
    ctx.fillStyle = '#ff5040';
    for (const c of this.G.wanted.police) {
      if (c.destroyed) continue;
      const [cx, cz] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(cx, cz, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const p = this.G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const pa = p.inCar ? p.inCar.angle : p.angle;
    const [ux, uz] = toMap(px, pz);
    ctx.save();
    ctx.translate(ux, uz);
    ctx.rotate(Math.PI - pa);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
