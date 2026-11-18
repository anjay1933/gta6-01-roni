// DUSTLINE missions: Jax Marlowe's six-job arc for the Dustline Runners. Each job
// has a target, a kind (drive there / collect / survive / eliminate / escape) and
// a cash reward. A floating beacon marks the target; the HUD shows the objective
// and the distance. Completing a job pays out and unlocks the next one.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { dist2D } from './util.js';

export class MissionDirector {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.index = 0;               // 0-based into MISSIONS
    this.done = 0;                // jobs completed this run
    this.active = null;           // live state for the current job
    this.allDone = false;
    // Beacon: a glowing pillar + ring at the target, visible across town.
    const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beacon = new THREE.Mesh(beamGeo, beamMat);
    this.beacon.position.y = 30;
    this.scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(3, 5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.scene.add(this.ring);
    this.beacon.visible = false;
    this.ring.visible = false;
  }

  get current() {
    return MISSIONS[this.index] ?? null;
  }

  get missionLabel() {
    const m = this.current;
    return m ? `Mission ${m.id} — ${m.name}` : 'All jobs done';
  }

  start(index = 0) {
    this.index = index;
    this.done = 0;
    this.allDone = false;
    this.setupCurrent();
  }

  setupCurrent() {
    const m = this.current;
    this.active = null;
    if (!m) {
      this.allDone = true;
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    this.beacon.position.set(m.target.x, 30, m.target.z);
    this.ring.position.set(m.target.x, 0.15, m.target.z);
    this.beacon.visible = true;
    this.ring.visible = true;
    this.active = {
      collected: 0,
      eliminated: 0,
      surviveLeft: m.seconds ?? 0,
      inZone: false,
      tailSpawned: false,
      rivalsSpawned: false,
      escapeArmed: false,
    };
  }

  /** Distance from the player to the current target, for the HUD. */
  distanceToTarget(px, pz) {
    const m = this.current;
    if (!m) return 0;
    return Math.round(dist2D(px, pz, m.target.x, m.target.z));
  }

  /** Short progress line for the HUD: crates 1/3, rivals down 2/5, survive 24s. */
  progress() {
    const m = this.current;
    if (!m || !this.active) return '';
    if (m.kind === 'collect') return `Crates ${this.active.collected}/${m.count}`;
    if (m.kind === 'eliminate' && !this.active.rivalsSpawned) {
      return 'Close in to trigger the ambush';
    }
    if (m.kind === 'eliminate' && this.active.rivalsSpawned) {
      return `Rivals down ${this.active.eliminated}/${m.count}`;
    }
    if (m.kind === 'survive' && this.active.inZone) {
      return `Hold on ${Math.ceil(this.active.surviveLeft)}s`;
    }
    if (m.kind === 'survive') {
      // The timer only runs inside the zone with 3+ stars, and nothing says so:
      // name the gate before the player is in the zone, not after.
      return 'Reach the diner with 3★ heat';
    }
    return '';
  }

  /**
   * Per-frame progress. `ctx` carries the live game state the jobs read:
   * { px, pz, inCar, speed, stars, rivals, cratesCollected }.
   * Returns an event string when something happens ('complete', 'tail',
   * 'rivals', 'roadblock') or null. The caller applies rewards on 'complete'.
   */
  update(dt, ctx) {
    const m = this.current;
    if (!m || !this.active) return null;
    const a = this.active;
    const d = dist2D(ctx.px, ctx.pz, m.target.x, m.target.z);

    if (m.kind === 'goto') {
      if (m.tail && !a.tailSpawned && d < 220) {
        a.tailSpawned = true;
        return 'tail';
      }
      if (d < 9) return 'complete';
    }
    if (m.kind === 'collect') {
      a.collected = ctx.cratesCollected;
      if (a.collected >= m.count) return 'complete';
    }
    if (m.kind === 'survive') {
      if (d < 12 && ctx.stars >= 3) {
        if (!a.inZone) { a.inZone = true; a.surviveLeft = m.seconds; }
        a.surviveLeft -= dt;
        if (a.surviveLeft <= 0) return 'complete';
      } else {
        a.inZone = false;
      }
    }
    if (m.kind === 'eliminate') {
      if (!a.rivalsSpawned && d < 60) {
        a.rivalsSpawned = true;
        return 'rivals';
      }
      a.eliminated = ctx.eliminated;
      if (a.rivalsSpawned && a.eliminated >= m.count) return 'complete';
    }
    if (m.kind === 'escape') {
      if (!a.escapeArmed && d < 260) {
        a.escapeArmed = true;
        return 'roadblock';
      }
      if (a.escapeArmed && ctx.px > 400) return 'complete';
    }
    return null;
  }

  /** Move to the next job. Returns the reward of the job just finished. */
  complete() {
    const m = this.current;
    const reward = m ? m.reward : 0;
    this.done += 1;
    this.index += 1;
    this.setupCurrent();
    return reward;
  }

  /** Pulse the beacon ring so it reads from a distance. */
  animate(t) {
    if (!this.beacon.visible) return;
    const s = 1 + Math.sin(t * 3) * 0.12;
    this.ring.scale.set(s, s, 1);
    this.beacon.material.opacity = 0.28 + Math.sin(t * 3) * 0.08;
  }
}
