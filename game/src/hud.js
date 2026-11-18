// DUSTLINE HUD: the DOM panels (stars, cash, objective, health/armor, ammo,
// speed) and the round minimap drawn on a 2D canvas — roads, town blocks, the
// player arrow, cop blips, the mission beacon and the respray garage.

import { fmtCash, clamp01 } from './util.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.starsEl = document.getElementById('stars');
    this.cashEl = document.getElementById('cash');
    this.objLabel = document.getElementById('obj-label');
    this.objText = document.getElementById('obj-text');
    this.objDist = document.getElementById('obj-dist');
    this.healthFill = document.getElementById('healthfill');
    this.armorFill = document.getElementById('armorfill');
    this.ammoEl = document.getElementById('ammo');
    this.speedEl = document.getElementById('speed');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.crosshair = document.getElementById('crosshair');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = 0;
    this.lastStars = -1;
  }

  show() { this.root.classList.add('on'); }
  hide() { this.root.classList.remove('on'); }

  toast(main, sub = '') {
    this.toastEl.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
    this.toastEl.style.opacity = '1';
    this.toastTimer = 2.6;
  }

  update(dt, s) {
    // s: { stars, cash, health, armor, ammo, speedMph, inCar, label, objective, dist, hint }
    if (s.stars !== this.lastStars) {
      this.lastStars = s.stars;
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += `<span class="${i < s.stars ? 'lit' : 'dim'}">&#9733;</span>`;
      }
      this.starsEl.innerHTML = html;
    }
    this.cashEl.innerHTML = `${fmtCash(s.cash)} <small>CASH</small>`;
    this.objLabel.textContent = s.label;
    this.objText.textContent = s.objective;
    this.objDist.textContent = s.dist > 0 ? `${s.dist} m — follow the gold beacon` : '';
    this.healthFill.style.width = `${clamp01(s.health / 100) * 100}%`;
    this.armorFill.style.width = `${clamp01(s.armor / 100) * 100}%`;
    this.ammoEl.innerHTML = `&#128481; PISTOL <b>${s.ammo}</b> &nbsp;|&nbsp; FISTS READY`;
    this.speedEl.innerHTML = s.inCar ? `${Math.round(s.speedMph)} <small>MPH</small>` : `ON FOOT`;
    this.hintEl.textContent = s.hint;
    this.crosshair.style.display = s.inCar ? 'none' : 'block';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
  }

  /** Draw the minimap. World is 900 across; the map shows the whole town. */
  drawMap(px, pz, heading, cops, target, garage, roads) {
    const g = this.mapCtx;
    const W = 190;
    const H = 190;
    const scale = W / 920;
    const toMap = (x, z) => [95 + x * scale, 95 + z * scale];
    g.clearRect(0, 0, W, H);
    // Desert background.
    g.fillStyle = '#b98a52';
    g.fillRect(0, 0, W, H);
    // Canyon gap.
    g.fillStyle = '#6e3a20';
    g.fillRect(95 + 300 * scale, 0, 60 * scale, H);
    // Roads.
    g.strokeStyle = '#2e2a28';
    g.lineCap = 'round';
    g.lineWidth = 5;
    for (const road of roads) {
      g.beginPath();
      road.points.forEach(([x, z], i) => {
        const [mx, mz] = toMap(x, z);
        if (i === 0) g.moveTo(mx, mz); else g.lineTo(mx, mz);
      });
      if (road.loop) g.closePath();
      g.stroke();
    }
    // Downtown blocks.
    g.fillStyle = '#8a6a4a';
    g.fillRect(95 - 170 * scale, 95 - 230 * scale, 340 * scale, 190 * scale);
    // Garage (respray) — blue wrench square.
    const [gx, gz] = toMap(garage.x, garage.z);
    g.fillStyle = '#4fa8ff';
    g.fillRect(gx - 5, gz - 5, 10, 10);
    // Mission beacon — pulsing gold diamond.
    if (target) {
      const [tx, tz] = toMap(target.x, target.z);
      const pulse = 6 + Math.sin(performance.now() / 220) * 2;
      g.fillStyle = '#ffd76a';
      g.beginPath();
      g.moveTo(tx, tz - pulse);
      g.lineTo(tx + pulse, tz);
      g.lineTo(tx, tz + pulse);
      g.lineTo(tx - pulse, tz);
      g.closePath();
      g.fill();
    }
    // Cop blips — red/blue flashing dots.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    g.fillStyle = flash ? '#ff4444' : '#4488ff';
    for (const c of cops) {
      const [cx, cz] = toMap(c.x, c.z);
      g.beginPath();
      g.arc(cx, cz, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow — white triangle pointing along the heading.
    const [mx, mz] = toMap(px, pz);
    g.save();
    g.translate(mx, mz);
    g.rotate(Math.atan2(-Math.sin(heading), Math.cos(heading)) + Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1a0f08';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5.5, 6);
    g.lineTo(-5.5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // Round frame.
    g.strokeStyle = 'rgba(255, 190, 110, 0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(95, 95, 93, 0, Math.PI * 2);
    g.stroke();
  }
}
