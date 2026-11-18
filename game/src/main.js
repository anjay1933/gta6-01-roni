// EMBER ISLE — boot, game loop, screens and saving. The game object holds
// everything; step(dt) advances one fixed slice of the world.
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { makeCar, updateCar, collideCars } from './vehicles.js';
import { spawnCivilians, updatePed } from './people.js';
import { createCombat, updateParticles } from './combat.js';
import { createWanted, updateWanted } from './wanted.js';
import { startMission, updateMission } from './missions.js';
import { drawHUD, buildMinimap } from './hud.js';
import { drawWorld, drawTitle, drawBrief, drawPaused, drawMissionEnd, drawGameOver, updateCamera } from './render.js';
import { stageShot } from './shots.js';
import { createAutopilot, createVerifyRun } from './autopilot.js';
import { VIEW, SAVE_KEY } from './config.js';
import { makeRng } from './random.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 20261118);

const game = {
  canvas,
  input: createInput(canvas),
  audio: createAudio(),
  rng: makeRng(seed),
  world: null,
  player: null,
  cars: [],
  peds: [],
  markers: [],
  pickups: [],
  particles: [],
  explosions: [],
  combat: null,
  wanted: createWanted(),
  mission: null,
  camera: { x: 0, y: 0, zoom: 1 },
  time: 0,
  screen: 'title',
  paused: false,
  zoomOverride: 0,
  toasts: [],
  prompt: '',
  minimapCanvas: null,
  saveData: { unlocked: 0, money: 0 },
  verify: null,
  autopilot: null,
  toast(text) {
    this.toasts.push({ text, life: 3.2 });
    if (this.toasts.length > 3) this.toasts.shift();
  },
  save() {
    try {
      const done = this.mission ? this.mission.index + (this.mission.phase === 'done' || this.mission.phase === 'complete' ? 1 : 0) : 0;
      this.saveData.unlocked = Math.max(this.saveData.unlocked, done);
      this.saveData.money = this.player.money;
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
    } catch {
      /* saving is a bonus, never a crash */
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data.unlocked === 'number') this.saveData = data;
      }
    } catch {
      /* no save yet */
    }
  },
  reset(nextSeed) {
    const s = nextSeed || seed;
    this.rng = makeRng(s);
    this.world = buildWorld(s);
    this.player = createPlayer(this.world);
    this.player.money = this.saveData.money || 0;
    this.cars = [];
    this.peds = [];
    this.markers = [];
    this.pickups = [];
    this.particles = [];
    this.explosions = [];
    this.combat = createCombat(this);
    this.wanted = createWanted();
    this.mission = null;
    this.camera = { x: this.player.x - VIEW.width / 2, y: this.player.y - VIEW.height / 2, zoom: 1 };
    this.time = 0;
    this.toasts = [];
    this.prompt = '';
    this.minimapCanvas = buildMinimap(this.world);
    // Traffic on the roads, plus a few parked cars to steal in town.
    const nodes = this.world.roadNodes;
    const kinds = ['sedan', 'pickup', 'truck', 'sedan', 'pickup'];
    for (let i = 0; i < 8; i++) {
      const n = nodes[i % nodes.length];
      const car = makeCar(this.world, n.x + this.rng.range(-40, 40), n.y + this.rng.range(-40, 40), kinds[i % kinds.length], 'traffic');
      car.angle = this.rng.range(0, Math.PI * 2);
      this.cars.push(car);
    }
    const town = this.world.places.town;
    // Parked on the port road itself, clear of the town's buildings.
    for (let i = 0; i < 3; i++) {
      const car = makeCar(this.world, 2000 + i * 200, town.y + 20, kinds[i % kinds.length], null, 'Parked ' + kinds[i % kinds.length]);
      car.angle = Math.PI / 2;
      this.cars.push(car);
    }
    spawnCivilians(this, 12);
  },
  // One fixed slice of the world. The autopilot calls this directly too.
  step(dt) {
    this.time += dt;
    this.world.time += dt;
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);

    updateMission(this, dt);
    const wasInCar = !this.player.onFoot;
    updatePlayer(this, dt);
    // E while already driving steps out of the car (entering is handled
    // inside updatePlayer, so a fresh press never double-fires).
    if (wasInCar && this.input.wasPressed('e')) {
      this.input.consume('e');
      exitCar(this);
    }

    for (const car of this.cars) updateCar(this, car, dt);
    collideCars(this);
    for (const ped of this.peds) updatePed(this, ped, dt);
    this.peds = this.peds.filter((p) => !p.dead || p.kind === 'civilian');
    this.combat.update(dt);
    updateParticles(this, dt);
    updateWanted(this, dt);
    updateCamera(this, dt);

    // Context prompt.
    if (this.player.onFoot) {
      let near = null;
      for (const car of this.cars) {
        if (car.wrecked) continue;
        const d = Math.hypot(car.x - this.player.x, car.y - this.player.y);
        if (d < 70) {
          near = car;
          break;
        }
      }
      this.prompt = near ? 'E — Enter the ' + near.name : '';
    } else {
      this.prompt = 'E — Exit car      Space — Handbrake';
    }
    // Siren + engine follow the action.
    const policeNear = this.cars.some((c) => c.driver === 'police' && !c.wrecked && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 800);
    this.audio.setSiren(policeNear && this.wanted.stars > 0, dt);
    if (!this.player.onFoot && this.player.car) {
      this.audio.setEngine(Math.abs(this.player.car.speed) / 360, true);
    } else {
      this.audio.setEngine(0, false);
    }
  },
};

game.load();
game.reset(seed);
window.__ember = game;

function startFromTitle() {
  const at = Math.min(game.saveData.unlocked, 5);
  startMission(game, at);
  game.screen = 'play';
}

function handleMenuKeys() {
  const input = game.input;
  if (input.wasPressed('Enter')) {
    if (game.screen === 'title') {
      game.audio.unlock();
      startFromTitle();
    } else if (game.player.dead) {
      startMission(game, game.mission.index);
      game.screen = 'play';
    } else if (game.mission && game.mission.phase === 'brief') {
      game.mission.phase = 'active';
    } else if (game.mission && game.mission.phase === 'done') {
      startMission(game, game.mission.index + 1);
    } else if (game.mission && game.mission.phase === 'failed') {
      startMission(game, game.mission.index);
    } else if (game.mission && game.mission.phase === 'complete') {
      game.mission = null;
      game.screen = 'play';
    }
  }
  if (input.wasPressed('p') && game.screen === 'play' && game.mission) {
    game.paused = !game.paused;
  }
  if (input.wasPressed('m')) {
    const muted = game.audio.toggleMute();
    game.toast(muted ? 'Sound off' : 'Sound on');
  }
  if (input.wasPressed('r') && game.screen === 'play' && game.mission && game.mission.phase !== 'brief') {
    startMission(game, game.mission.index);
  }
}

let last = performance.now();
let firstFrame = true;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 1 / 60;

  const input = game.input;

  if (game.screen === 'play' && !game.paused) {
    if (game.verify) {
      // Verify mode: four world slices per frame, autopilot at the wheel.
      // endFrame runs once per frame (below), so a virtual tap the
      // autopilot pressed is still visible to the next frame's menu keys,
      // and consume() stops it double-firing across the four slices.
      for (let i = 0; i < 4; i++) {
        game.autopilot.update(game, 1 / 60);
        game.step(1 / 60);
      }
      game.verify.update(dt);
    } else if (game.autopilot) {
      // Screenshot mode: the staged scene keeps playing live at real
      // speed, so the frame is a moving game, not a frozen one holding
      // the last key the staging pressed.
      game.autopilot.update(game, 1 / 60);
      game.step(dt);
    } else {
      game.step(dt);
    }
  } else if (game.screen === 'title') {
    game.world.time += dt;
    game.time += dt;
  }

  // Menu keys run AFTER the step, so a virtual tap the autopilot pressed
  // during the step is still in `pressed` when these are read — a tap
  // made before the step would already be cleared by endFrame.
  handleMenuKeys();

  // Render.
  if (game.screen === 'title') {
    drawTitle(ctx, game);
  } else {
    drawWorld(ctx, game);
    drawHUD(ctx, game);
    if (game.mission && game.mission.phase === 'brief') drawBrief(ctx, game);
    else if (game.player.dead) drawGameOver(ctx, game);
    else if (game.mission && (game.mission.phase === 'done' || game.mission.phase === 'failed' || game.mission.phase === 'complete')) {
      drawMissionEnd(ctx, game);
    }
    if (game.paused) drawPaused(ctx);
  }

  input.endFrame();
  if (firstFrame) {
    firstFrame = false;
    window.__emberReady = true;
  }
}

// Screenshot scenes (?shot=cover|foot|chase|mission) and the verify run
// (?verify=1) start straight into the game, past the title screen.
if (params.get('shot')) {
  game.screen = 'play';
  // The autopilot keeps driving the staged scene live after the sync
  // staging finishes, or the frame freezes on the last key it held.
  game.autopilot = createAutopilot(game);
  stageShot(params.get('shot'), game);
} else if (params.get('verify')) {
  game.screen = 'play';
  startMission(game, 0);
  game.autopilot = createAutopilot(game);
  game.verify = createVerifyRun(game);
  window.__verify = null;
}

window.addEventListener('keydown', () => game.audio.unlock());
window.addEventListener('mousedown', () => game.audio.unlock());
requestAnimationFrame(frame);
