// DUSTLINE main: boots the renderer, wires every system together, runs the game
// loop and owns the state machine (title → playing → paused → busted/wasted).
// It also owns the rules that cross systems: stealing a car is a crime, running
// over a pedestrian is a crime, shooting near a cop is a crime, and the respray
// garage is the one legal way out of trouble.

import * as THREE from 'three';
import { Town } from './world.js';
import { SoundBank } from './audio.js';
import { Traffic } from './vehicles.js';
import { Crowd, Rivals } from './people.js';
import { Wanted } from './wanted.js';
import { MissionDirector } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { Player } from './player.js';
import { stageShot } from './shots.js';
import { WORLD, WANTED, SAVE_KEY } from './config.js';
import { clamp, dist2D, makeRng } from './util.js';

export class Game {
  constructor() {
    this.state = 'title'; // title | playing | paused | over
    this.shotMode = new URLSearchParams(window.location.search).has('shot');
    this.shotCameraLock = false;
    this.cash = 250;
    this.cratesCollected = 0;
    this.eliminated = 0;
    this.shotCrimeCooldown = 0;
    this.keys = new Set();
    this.sound = new SoundBank();
    this.hud = new Hud();
    this.setupRenderer();
    this.setupWorld();
    this.setupInput();
    this.setupOverlays();
    this.loadSave();
  }

  setupRenderer() {
    const canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(-190, 12, 60);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupWorld() {
    this.town = new Town(this.scene).build();
    const rng = makeRng(7);
    this.traffic = new Traffic(this.scene, this.town, rng);
    this.crowd = new Crowd(this.scene, this.town, rng);
    this.rivals = new Rivals(this.scene, this.town);
    this.wanted = new Wanted(this.scene, this.town, rng, this.sound);
    this.missions = new MissionDirector(this.scene, rng);
    this.combat = new Combat(this.scene, this.sound);
    this.combat.buildPickups(this.town.pickupSpots);
    this.player = new Player(this.scene, this.town);
    this.player.attachCamera(this.camera);
    this.clock = new THREE.Clock();
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code.toLowerCase());
      if (e.code === 'KeyP' && (this.state === 'playing' || this.state === 'paused')) this.togglePause();
      if (e.code === 'KeyM') this.sound.setMuted(!this.sound.muted);
      if (e.code === 'KeyE' && this.state === 'playing') this.tryEnterExitCar();
      if (e.code === 'KeyG' && this.state === 'playing') this.tryRespray();
      if (e.code === 'KeyR' && this.state === 'playing' && this.player.car) {
        this.combat.driveBy(this.player.car, this.shootableTargets());
      }
      if (e.code === 'KeyF' && this.state === 'playing' && !this.player.car) {
        const hit = this.combat.punch(this.player.x, this.player.z, this.player.heading, this.shootableTargets());
        if (hit) this.onTargetDown(hit);
      }
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code.toLowerCase()));
    const canvas = document.getElementById('view');
    canvas.addEventListener('click', () => {
      if (this.state !== 'playing') return;
      this.sound.unlock();
      if (!this.shotMode) canvas.requestPointerLock?.();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing') return;
      const locked = document.pointerLockElement === canvas;
      if (locked || e.buttons === 1) this.player.look(e.movementX || 0, e.movementY || 0);
    });
    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || this.player.car || e.button !== 0) return;
      this.sound.unlock();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const hit = this.combat.shoot(this.camera.position.clone(), dir, this.shootableTargets());
      if (hit) this.onTargetDown(hit);
      else this.onShotFired();
    });
  }

  setupOverlays() {
    const $ = (id) => document.getElementById(id);
    $('btn-start').addEventListener('click', () => {
      this.sound.unlock();
      this.newRun();
    });
    $('btn-continue').addEventListener('click', () => {
      this.sound.unlock();
      this.continueRun();
    });
    $('btn-resume').addEventListener('click', () => this.togglePause());
    $('btn-restart').addEventListener('click', () => {
      this.newRun();
    });
    $('btn-retry').addEventListener('click', () => {
      this.retryAfterDeath();
    });
    $('btn-menu').addEventListener('click', () => {
      this.state = 'title';
      $('over-screen').classList.add('hidden');
      $('title-screen').classList.remove('hidden');
      this.hud.hide();
    });
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      this.saveData = save;
      if (save && typeof save.cash === 'number') {
        document.getElementById('btn-continue').style.display = '';
      }
    } catch (e) {
      this.saveData = null;
    }
  }

  saveRun() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        missionIndex: this.missions.index,
        done: this.missions.done,
      }));
    } catch (e) { /* private mode — the run just won't persist */ }
  }

  newRun() {
    this.cash = 250;
    this.startFreeRoam();
    this.missions.start(0);
    this.state = 'playing';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('over-screen').classList.add('hidden');
    this.hud.show();
    this.hud.toast('MISSION 1 — FIRST PICKUP', 'Drive to the gas station');
  }

  continueRun() {
    const s = this.saveData || { cash: 250, missionIndex: 0 };
    this.cash = s.cash;
    this.startFreeRoam();
    this.missions.start(Math.min(s.missionIndex || 0, 5));
    this.state = 'playing';
    document.getElementById('title-screen').classList.add('hidden');
    this.hud.show();
    const cur = this.missions.current;
    this.hud.toast('BACK ON THE ROAD', `Mission ${cur?.id ?? 1} — ${cur?.name ?? ''}`);
  }

  /** Reset the world to a fresh free-roam state (used by new runs and by ?shot= staging). */
  startFreeRoam() {
    this.wanted.clear();
    this.rivals.clear();
    this.cratesCollected = 0;
    this.eliminated = 0;
    for (const crate of this.town.crates) crate.visible = true;
    this.player.health = 100;
    this.player.armor = 0;
    this.combat.ammo = 24;
    this.player.x = -170;
    this.player.z = 40;
    this.player.y = 0;
    this.player.heading = 0;
    this.player.camYaw = 0;
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car = null;
    }
    this.player.group.visible = true;
    this.player.group.position.set(this.player.x, 0, this.player.z);
    this.shotCameraLock = false;
    // Free roam means playing, never a menu: hide every overlay.
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('over-screen').classList.add('hidden');
    this.missions.start(0);
  }

  retryAfterDeath() {
    document.getElementById('over-screen').classList.add('hidden');
    this.cash = Math.floor(this.cash * 0.9);
    this.startFreeRoam();
    this.missions.start(Math.max(0, this.missions.index));
    this.state = 'playing';
    this.hud.show();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-stats').textContent =
        `Cash $${this.cash.toLocaleString('en-US')} · Jobs done ${this.missions.done}/6 · Wanted ${this.wanted.stars}★`;
      document.getElementById('pause-screen').classList.remove('hidden');
      this.saveRun();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }

  shootableTargets() {
    return [...this.crowd.peds, ...this.rivals.fighters];
  }

  tryEnterExitCar() {
    if (this.player.car) {
      this.player.exitCar();
      return;
    }
    const car = this.traffic.nearestParked(this.player.x, this.player.z, 4.5);
    if (!car) return;
    this.traffic.steal(car);
    this.player.enterCar(car);
    this.wanted.addStars(WANTED.crimeCarTheft, 'theft');
    this.hud.toast('CAR STOLEN', 'The law noticed — +1 star');
    this.sound.pickup();
  }

  tryRespray() {
    if (!this.player.car || this.wanted.stars === 0) return;
    const g = this.town.garagePos;
    if (dist2D(this.player.x, this.player.z, g.x, g.z) > 14) return;
    if (this.cash < WANTED.resprayCost) {
      this.hud.toast('NOT ENOUGH CASH', `Respray costs $${WANTED.resprayCost}`);
      return;
    }
    this.cash -= WANTED.resprayCost;
    this.wanted.clear();
    this.hud.toast('RESPRAY DONE', 'Clean plates — the heat is off');
    this.sound.missionDone();
  }

  onShotFired() {
    // Firing where a cop can hear it draws heat (rate-limited).
    if (this.shotCrimeCooldown > 0) return;
    if (this.wanted.nearestCopDist(this.player.x, this.player.z) < 70) {
      this.wanted.addStars(WANTED.crimeShootNearCop, 'shot');
      this.shotCrimeCooldown = 4;
    }
  }

  onTargetDown(target) {
    if (target.kind === 'ped') {
      this.wanted.addStars(WANTED.crimeHitPed, 'hit-ped');
      this.crowd.scare(target.x, target.z, 30, 6);
      this.hud.toast('INNOCENT DOWN', 'The law is coming — +1 star');
    } else if (target.kind === 'rival') {
      this.eliminated += 1;
    }
  }

  gameOver(kind) {
    this.state = 'over';
    const title = document.getElementById('over-title');
    const text = document.getElementById('over-text');
    if (kind === 'busted') {
      title.textContent = 'BUSTED';
      title.className = 'busted';
      text.textContent = 'The law caught up with Jax Marlowe. The Runners will not wait long.';
    } else {
      title.textContent = 'WASTED';
      title.className = 'wasted';
      text.textContent = 'Jax Marlowe went down in the dust. Copper Flats forgets fast.';
    }
    document.getElementById('over-screen').classList.remove('hidden');
    this.hud.hide();
    this.saveRun();
  }

  update(dt, t) {
    if (this.state !== 'playing') return;
    this.shotCrimeCooldown = Math.max(0, this.shotCrimeCooldown - dt);
    const prevX = this.player.x;
    const prevZ = this.player.z;

    if (this.player.car) this.player.stepDriving(dt, this.keys);
    else this.player.stepOnFoot(dt, this.keys);

    // The canyon gap is a void on foot: only the bridge deck is walkable.
    if (!this.player.car && this.player.x > 300 && this.player.x < 360 && Math.abs(this.player.z) >= 6.5) {
      this.player.x = prevX;
      this.player.z = prevZ;
      this.player.group.position.set(this.player.x, this.player.y, this.player.z);
    }

    // Driving into a pedestrian is a crime — and a mess.
    if (this.player.car && Math.abs(this.player.car.speed) > 5) {
      for (const p of this.crowd.peds) {
        if (!p.alive) continue;
        if (dist2D(p.x, p.z, this.player.car.x, this.player.car.z) < 2.4) {
          p.damage(200);
          this.wanted.addStars(WANTED.crimeHitPed, 'hit-ped');
          this.crowd.scare(p.x, p.z, 30, 6);
          this.player.car.addDamage(0.05);
          this.sound.crash();
        }
      }
    }
    // Bumping traffic cars: shove apart, dent both.
    if (this.player.car) {
      for (const other of this.traffic.cars) {
        const d = dist2D(this.player.car.x, this.player.car.z, other.x, other.z);
        if (d < 4.6 && d > 0.01) {
          const push = (4.6 - d) / 2;
          const nx = (this.player.car.x - other.x) / d;
          const nz = (this.player.car.z - other.z) / d;
          this.player.car.x += nx * push;
          this.player.car.z += nz * push;
          other.x -= nx * push;
          other.z -= nz * push;
          other.sync();
          this.player.car.addDamage(0.04);
          this.player.car.speed *= 0.75;
          this.sound.crash();
        }
      }
    }
    // On foot, traffic cars shove the player aside.
    if (!this.player.car) {
      for (const other of this.traffic.cars) {
        const d = dist2D(this.player.x, this.player.z, other.x, other.z);
        if (d < 2.2 && d > 0.01) {
          this.player.x += ((this.player.x - other.x) / d) * (2.2 - d);
          this.player.z += ((this.player.z - other.z) / d) * (2.2 - d);
          this.player.group.position.set(this.player.x, this.player.y, this.player.z);
        }
      }
    }

    this.traffic.update(dt, this.player.car);
    this.crowd.update(dt, this.player.x, this.player.z, this.player.car);
    this.rivals.update(dt, this.player.x, this.player.z, (fighter) => this.rivalShoots(fighter));
    this.wanted.update(dt, {
      x: this.player.x, z: this.player.z, heading: this.player.heading, car: this.player.car,
    }, () => this.gameOver('busted'), (cop) => {
      if (this.player.car) {
        this.player.car.addDamage(0.14);
        this.player.car.speed *= 0.5;
        this.sound.crash();
        this.hud.toast('RAMMED BY POLICE', 'Your ride is taking damage');
        if (this.player.car.damage >= 1) {
          this.player.car.speed = 0;
          this.player.exitCar();
          this.hud.toast('RIDE WRECKED', 'Run, Jax — on foot now');
        }
      }
    });

    // Mission progress.
    const ev = this.missions.update(dt, {
      px: this.player.x, pz: this.player.z,
      inCar: !!this.player.car, speed: this.player.speed,
      stars: this.wanted.stars, rivals: this.rivals,
      cratesCollected: this.cratesCollected, eliminated: this.eliminated,
    });
    if (ev === 'tail') {
      this.wanted.addStars(2, 'tail');
      this.hud.toast('TAILED!', 'Two units on you — push across the bridge');
    } else if (ev === 'rivals') {
      const m = this.missions.current;
      this.rivals.spawn(m.target.x, m.target.z, 5, makeRng(99));
      this.hud.toast('AMBUSH!', 'Five of Vic\u2019s rivals — take them down');
    } else if (ev === 'roadblock') {
      this.wanted.addStars(3, 'escape');
      this.hud.toast('ROADBLOCK AHEAD', 'Punch through and cross the east bridge');
    } else if (ev === 'complete') {
      const m = this.missions.current;
      const reward = this.missions.complete();
      this.cash += reward;
      this.sound.missionDone();
      this.hud.toast(`JOB DONE — ${m.name}`, `+$${reward.toLocaleString('en-US')}`);
      this.saveRun();
      if (this.missions.allDone) {
        this.hud.toast('DUSTLINE COMPLETE', 'All six jobs done — Jax is free');
      }
    }

    // Quarry crates: walk up to one during the heist to grab it.
    const m = this.missions.current;
    if (m && m.kind === 'collect') {
      this.town.crates.forEach((crate) => {
        if (!crate.visible) return;
        if (dist2D(this.player.x, this.player.z, crate.position.x, crate.position.z) < 3.2) {
          crate.visible = false;
          this.cratesCollected += 1;
          this.sound.pickup();
          this.hud.toast(`CRATE ${this.cratesCollected}/3`, 'Keep moving — guards are coming');
        }
      });
    }

    // Pickups.
    const got = this.combat.collect(this.player.x, this.player.z, this.player);
    if (got === 'health') this.hud.toast('HEALTH +40', '');
    if (got === 'armor') this.hud.toast('ARMOR +50', '');
    if (got === 'ammo') this.hud.toast('AMMO +24', '');

    this.combat.update(dt, t);
    this.town.update(dt, t);
    this.sound.engine(this.player.car ? Math.abs(this.player.car.speed) / 40 : 0);
    this.sound.music(dt);
    if (!this.shotCameraLock) this.player.updateCamera(dt);

    // HUD.
    const cur = this.missions.current;
    let hint = 'WASD move · SHIFT sprint · SPACE jump · E enter car · CLICK shoot · P pause';
    if (!this.player.car) {
      const near = this.traffic.nearestParked(this.player.x, this.player.z, 4.5);
      if (near) hint = `Press E to steal the ${near.spec.label} — the law will notice`;
    } else if (this.wanted.stars > 0) {
      const g = this.town.garagePos;
      if (dist2D(this.player.x, this.player.z, g.x, g.z) < 20) {
        hint = 'Press G to respray ($150) — clears your wanted level';
      } else {
        hint = 'WASD drive · SPACE handbrake · R drive-by · E exit car · reach the blue SPRAY garage to clear heat';
      }
    } else {
      // In a car with no heat the on-foot hint is wrong (SPACE is the handbrake,
      // E exits the car, CLICK does nothing) — show the driving controls instead.
      hint = 'WASD drive · SPACE handbrake · R drive-by · E exit car';
    }
    this.hud.update(dt, {
      stars: this.wanted.stars,
      cash: this.cash,
      health: Math.round(this.player.health),
      armor: Math.round(this.player.armor),
      ammo: this.combat.ammo,
      speedMph: this.player.car ? Math.abs(this.player.car.speed) * 2.237 : 0,
      inCar: !!this.player.car,
      label: this.missions.missionLabel,
      objective: cur ? cur.text + (this.missions.progress() ? ` — ${this.missions.progress()}` : '') : 'All jobs done — free roam',
      dist: this.missions.distanceToTarget(this.player.x, this.player.z),
      hint,
    });
    this.hud.drawMap(this.player.x, this.player.z, this.player.car ? this.player.car.heading : this.player.heading,
      [...this.wanted.cops, ...this.wanted.roadblockCars],
      cur ? cur.target : null, this.town.garagePos, this.town.roads);
    this.missions.animate(t);
  }

  /** A rival fires at the player: tracer + a hit chance, no hitscan perfection. */
  rivalShoots(fighter) {
    const from = new THREE.Vector3(fighter.x, 1.4, fighter.z);
    const to = new THREE.Vector3(this.player.x, 1.3, this.player.z);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff8866, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.combat.tracers.push({ line, life: 0.12 });
    this.sound.gunshot();
    if (Math.random() < 0.3) {
      const dead = this.player.damage(9);
      this.hud.toast('HIT!', 'Find cover');
      if (dead) this.gameOver('wasted');
    }
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (this.state === 'playing') this.update(dt, t);
    else if (this.state === 'title') this.town.update(dt, t);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }

  start() {
    if (this.shotMode) {
      const name = new URLSearchParams(window.location.search).get('shot') || '1-cover';
      this.loop();
      stageShot(name, this);
    } else {
      this.loop();
    }
  }
}

const game = new Game();
window.__dustline = game;
game.start();
