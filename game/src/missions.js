// FROSTLINE — six story missions: markers, objectives, payoffs, progression.
import * as THREE from 'three';
import { MISSIONS, GARAGE } from './config.js';
import { clamp, dist2 } from './util.js';
import { heightAt } from './world.js';
import { Car } from './vehicles.js';

export class Missions {
  constructor(G) {
    this.G = G;
    this.index = 0; // current mission (0-based)
    this.step = 0;
    this.done = []; // completed mission ids
    this.active = false;
    this.defeated = 0;
    this.timer = 0;
    this.pendingStart = 0; // game-time delay before the next mission starts
    this.snowcat = null;
    this.marker = null;
    this.beacon = null;
    this.buildMarker();
  }

  buildMarker() {
    // A tall amber beacon column + a floating ring at the current objective.
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc030, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    this.G.scene.add(this.beacon);
    const ringGeo = new THREE.TorusGeometry(3, 0.22, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc030 });
    this.marker = new THREE.Mesh(ringGeo, ringMat);
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.G.scene.add(this.marker);
  }

  current() { return MISSIONS[this.index] || null; }
  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  start() {
    const m = this.current();
    if (!m) return;
    this.active = true;
    this.pendingStart = 0;
    this.step = 0;
    this.defeated = 0;
    this.timer = 0;
    if (m.id === 3) this.spawnSnowcat();
    if (m.id === 4) this.G.wanted.setStars(3);
    if (m.id === 5) this.G.combat.spawnRivals(70, -62, 5);
    if (m.id === 6) { this.timer = 150; this.G.blizzard = true; }
    this.G.hud.showMission(m);
    this.G.audio.mission();
    this.updateMarker();
  }

  spawnSnowcat() {
    if (this.snowcat && !this.snowcat.destroyed) return;
    this.snowcat = new Car(this.G, 'snowcat', 48, -138, 0.4, {});
    this.G.cars.push(this.snowcat);
  }

  onRivalDown() {
    if (this.current()?.id !== 5) return;
    this.defeated++;
    const s = this.currentStep();
    if (s && s.kind === 'defeat') {
      this.G.hud.flash(`${this.defeated}/${s.count} rivals down`);
      if (this.defeated >= s.count) this.advanceStep();
    }
  }

  advanceStep() {
    const m = this.current();
    this.step++;
    this.G.audio.pickup();
    if (this.step >= m.steps.length) this.completeMission();
    else this.updateMarker();
  }

  completeMission() {
    const m = this.current();
    const G = this.G;
    G.player.cash += m.pay;
    this.done.push(m.id);
    this.active = false;
    this.marker.visible = false;
    this.beacon.visible = false;
    if (m.id === 3 && this.snowcat) { this.snowcat.destroyed = true; this.snowcat.mesh.visible = false; }
    if (m.id === 5) G.combat.clearRivals();
    if (m.id === 6) { G.blizzard = false; G.gameComplete(); return; }
    G.hud.flash(`MISSION COMPLETE — $${m.pay}`);
    G.audio.mission();
    G.save();
    this.index++;
    const next = this.current();
    if (next) this.pendingStart = 2.5; // next mission starts on game time, not a wall-clock timer
  }

  updateMarker() {
    const s = this.currentStep();
    if (!s) { this.marker.visible = false; this.beacon.visible = false; return; }
    const y = heightAt(s.at[0], s.at[1]);
    this.marker.position.set(s.at[0], y + 1.2, s.at[1]);
    this.beacon.position.set(s.at[0], y + 30, s.at[1]);
    this.marker.visible = true;
    this.beacon.visible = true;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return 'All missions complete — free roam Frostline Pass.';
    const s = this.currentStep();
    if (!s) return m.title;
    let text = `${m.id}. ${m.title} — ${s.text}`;
    if (s.kind === 'defeat') text = `${m.id}. ${m.title} — Clear out the rivals at the lodge (${this.defeated}/${s.count})`;
    if (s.kind === 'timed') text = `${m.id}. ${m.title} — Reach the South Gate — ${Math.ceil(this.timer)}s left`;
    return text;
  }

  objectiveDistance() {
    const s = this.currentStep();
    if (!s) return 0;
    const p = this.G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    return Math.round(dist2(px, pz, s.at[0], s.at[1]));
  }

  objectivePoint() {
    const s = this.currentStep();
    return s ? s.at : null;
  }

  update(dt) {
    // Chain to the next mission on game time (robust to slow frames / throttled timers).
    if (this.pendingStart > 0) {
      this.pendingStart -= dt;
      if (this.pendingStart <= 0) {
        this.pendingStart = 0;
        if (this.index < MISSIONS.length) this.start();
      }
      return;
    }
    if (!this.active) return;
    const m = this.current();
    const s = this.currentStep();
    if (!s) return;
    const p = this.G.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const d = dist2(px, pz, s.at[0], s.at[1]);
    if (s.kind === 'timed') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.G.hud.flash('Too slow — the whiteout closed the pass. Try again.');
        this.timer = s.seconds;
        const start = MISSIONS[5].steps[0];
        // Reset the player to the lodge start of the escape.
        if (p.inCar) { p.inCar.x = 70; p.inCar.z = -90; p.inCar.speed = 0; }
        p.pos.set(70, heightAt(70, -90), -90);
        return;
      }
      // Reaching the gate in time completes the escape.
      if (d < s.radius) { this.advanceStep(); return; }
    }
    if (s.kind === 'pickup' && d < s.radius) {
      // Mission 3 pickup means stealing the snowcat: require being in it.
      if (m.id === 3) {
        if (p.inCar === this.snowcat) this.advanceStep();
        else this.G.hud.flash('Get in the snowcat (E)');
      } else this.advanceStep();
      return;
    }
    if ((s.kind === 'goto' || s.kind === 'deliver') && d < s.radius) {
      // Mission 2 + 3 deliveries want the player in a car.
      if ((m.id === 2 || m.id === 3) && s.kind === 'deliver' && !p.inCar) {
        this.G.hud.flash('Bring the car in to deliver');
        return;
      }
      this.advanceStep();
      return;
    }
    // Marker pulse.
    const t = performance.now() / 500;
    this.marker.position.y = heightAt(s.at[0], s.at[1]) + 1.2 + Math.sin(t) * 0.4;
    this.marker.rotation.z += dt * 0.8;
  }
}
