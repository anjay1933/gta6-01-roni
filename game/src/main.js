// FROSTLINE — entry point: renderer, input, state machine, game loop, save/load.
import * as THREE from 'three';
import { CFG, CARS } from './config.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Car } from './vehicles.js';
import { People } from './people.js';
import { Wanted } from './wanted.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { applyShot } from './shots.js';

window.__THREE__ = THREE;

const SAVE_KEY = 'frostline-save-v1';

const G = {
  state: 'menu', // menu | playing | paused | over | complete
  blizzard: false,
  cars: [],
  scene: null,
  camera: null,
  renderer: null,
  input: { f: false, b: false, l: false, r: false, sprint: false, jump: false, g: false },
  mouseDX: 0,
};

function init() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(-30, 12, 60);
  G.camera = camera;

  buildWorld(G);
  G.player = new Player(G);
  G.people = new People(G);
  G.wanted = new Wanted(G);
  G.combat = new Combat(G);
  G.missions = new Missions(G);
  G.hud = new HUD(G);
  G.audio = new AudioSys();

  // Parked cars + traffic.
  for (const c of CARS) {
    if (c.traffic) continue;
    const car = new Car(G, c.type, c.x, c.z, c.angle, {});
    G.cars.push(car);
  }
  G.people.spawnTraffic(G, CARS);

  // Input.
  const keyMap = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code] !== undefined) { G.input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'KeyE') tryEnterExit();
    if (e.code === 'KeyF') G.combat.punch();
    if (e.code === 'KeyR') driveBy();
    if (e.code === 'KeyG') G.input.g = true;
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'Enter' && G.state === 'menu') startGame(false);
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code] !== undefined) G.input[keyMap[e.code]] = false;
    if (e.code === 'KeyG') G.input.g = false;
  });
  canvas.addEventListener('click', () => {
    if (G.state === 'playing') {
      G.audio.init();
      const p = canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {}); // headless / no-gesture: ignore
    }
  });
  document.addEventListener('pointerlockchange', () => {
    G.pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!G.pointerLocked) return;
    G.player.camYaw -= e.movementX * 0.0026;
    G.player.camPitch = Math.max(-0.15, Math.min(0.9, G.player.camPitch + e.movementY * 0.0022));
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && G.state === 'playing') { G.audio.init(); G.combat.shoot(); }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Menu buttons.
  document.getElementById('btn-start').addEventListener('click', () => startGame(false));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
  document.getElementById('btn-resume').addEventListener('click', () => togglePause());
  document.getElementById('btn-restart').addEventListener('click', () => { location.reload(); });
  document.getElementById('btn-retry').addEventListener('click', () => { location.reload(); });
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-sound').addEventListener('click', () => { G.audio.init(); toggleMute(); });

  // Continue button only shows with a save.
  if (loadSave(true)) document.getElementById('btn-continue').style.display = 'inline-block';

  // Debug handle for play-testing (not part of the game UI).
  window.__FL = { G, startGame, version: 'frostline-1.0' };
  // Manual logic step for headless verification: run game time without rendering.
  window.__FL.step = (dt) => {
    window.__FL._t = (window.__FL._t || 0) + dt;
    if (G.state === 'playing') stepGame(dt, window.__FL._t);
  };

  // Staged screenshot mode.
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    applyShot(G, shot);
  }

  // Main loop.
  const clock = new THREE.Clock();
  let frames = 0;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frames++;
    if (G.state === 'playing') {
      stepGame(dt, t);
    } else if (G.state === 'menu') {
      // Slow cinematic orbit behind the menu.
      const a = t * 0.05;
      camera.position.set(Math.sin(a) * 90, 26, Math.cos(a) * 90);
      camera.lookAt(0, 4, -40);
      G.world.update(dt, t, camera.position, false);
    }
    renderer.render(scene, camera);
    if (frames === 5) window.__gameReady = true;
  }
  loop();
}

function stepGame(dt, t) {
  const p = G.player;
  // Driving vs on foot.
  if (p.inCar) {
    const car = p.inCar;
    const ctrl = {
      f: G.input.forward, b: G.input.back, l: G.input.left, r: G.input.right,
      handbrake: G.input.jump,
    };
    car.update(dt, ctrl);
    p.pos.set(car.x, car.y, car.z);
    p.mesh.position.copy(p.pos);
  } else {
    p.updateOnFoot(dt, G.input);
  }
  p.updateCamera(dt);
  G.people.update(dt, t);
  G.people.updateTraffic(dt);
  G.wanted.update(dt);
  G.combat.update(dt);
  G.missions.update(dt);
  G.world.update(dt, t, G.camera.position, G.blizzard);
  G.hud.update(dt);
  const speed = p.inCar ? Math.abs(p.inCar.speed) : (p.moving ? (G.input.sprint ? 10 : 6) : 0);
  G.audio.update(dt, speed, G.blizzard);
}

function tryEnterExit() {
  const p = G.player;
  if (G.state !== 'playing') return;
  if (p.inCar) { p.exitCar(); return; }
  const car = p.nearestCar(G.cars);
  if (car) {
    p.enterCar(car);
    G.audio.init();
    if (car.type !== 'police') G.wanted.addStars(1, 'car stolen');
    G.hud.flash(`You took the ${car.def.name}`);
  }
}

function driveBy() {
  const p = G.player;
  if (G.state !== 'playing' || !p.inCar) return;
  G.combat.shoot();
}

function toggleMute() {
  G.audio.init();
  G.audio.setMuted(!G.audio.muted);
  document.getElementById('btn-mute').textContent = G.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  document.getElementById('btn-sound').textContent = G.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
}

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    document.getElementById('pause-screen').style.display = 'flex';
    document.exitPointerLock?.();
  } else if (G.state === 'paused') {
    G.state = 'playing';
    document.getElementById('pause-screen').style.display = 'none';
  }
}

function startGame(continueSave) {
  G.audio.init();
  if (continueSave) loadSave(false);
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  G.state = 'playing';
  if (!G.missions.active && G.missions.index < 6) G.missions.start();
}

G.gameOver = function (kind) {
  if (G.state !== 'playing') return;
  G.state = 'over';
  document.exitPointerLock?.();
  const title = document.getElementById('over-title');
  const text = document.getElementById('over-text');
  if (kind === 'busted') {
    title.textContent = 'BUSTED';
    text.textContent = 'The ski patrol caught you. Your cash is safe, but the run is over.';
    G.player.cash = Math.max(0, G.player.cash - 100);
  } else {
    title.textContent = 'WASTED';
    text.textContent = 'You went down in the snow. The crew pulls you out — minus a little cash.';
    G.player.cash = Math.max(0, G.player.cash - 150);
  }
  G.save();
  document.getElementById('over-screen').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
};

G.gameComplete = function () {
  if (G.state !== 'playing') return;
  G.state = 'complete';
  document.exitPointerLock?.();
  document.getElementById('complete-cash').textContent = `$${G.player.cash}`;
  document.getElementById('complete-screen').style.display = 'flex';
  document.getElementById('hud').style.display = 'none';
  G.save();
};

G.damagePlayer = function (amount) {
  const p = G.player;
  if (G.state !== 'playing') return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.health -= amount;
  if (p.health <= 0) { p.health = 0; G.gameOver('wasted'); }
};

G.save = function () {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash,
      missionIndex: G.missions.index,
      done: G.missions.done,
      health: G.player.health,
      armor: G.player.armor,
      ammo: G.player.ammo,
    }));
  } catch { /* storage unavailable (e.g. file://) — progress just lives in memory */ }
};

function loadSave(peek) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (peek) return true;
    G.player.cash = s.cash ?? CFG.startCash;
    G.missions.index = s.missionIndex ?? 0;
    G.missions.done = s.done ?? [];
    G.player.health = s.health ?? CFG.playerHealth;
    G.player.armor = s.armor ?? 0;
    G.player.ammo = s.ammo ?? CFG.pistolAmmo;
    return true;
  } catch { return false; }
}

init();
