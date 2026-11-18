// EMBER ISLE — configuration: every tunable number of the game in one place.
// A volcanic tropical island, not a city: black-sand beaches, jungle, a port
// town, an active volcano and the lava that runs off it.
export const TILE = 40;
export const MAP_W = 80;
export const MAP_H = 80;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

// Terrain tile ids.
export const T = {
  OCEAN: 0,
  BEACH: 1,
  JUNGLE: 2,
  GRASS: 3,
  ROAD: 4,
  TOWN: 5,
  ROCK: 6,
  LAVA: 7,
  DOCK: 8,
};

// Base fill colours per terrain (a per-tile hash jitters them at draw time).
export const TILE_COLORS = {
  [T.OCEAN]: '#0d3b5e',
  [T.BEACH]: '#241f1c',
  [T.JUNGLE]: '#14532a',
  [T.GRASS]: '#3f7a34',
  [T.ROAD]: '#33363b',
  [T.TOWN]: '#4a4640',
  [T.ROCK]: '#4d4440',
  [T.LAVA]: '#e2481d',
  [T.DOCK]: '#6b4a2b',
};

export const SAVE_KEY = 'ember-isle-save-v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  hp: 100,
  shootCooldown: 0.24,
  bulletSpeed: 620,
  bulletDamage: 34,
  punchRange: 0,
};

export const CAR_KINDS = {
  sedan: { accel: 420, maxSpeed: 330, reverse: 140, turn: 2.6, grip: 3.2, hp: 100, w: 46, h: 24 },
  pickup: { accel: 380, maxSpeed: 300, reverse: 130, turn: 2.4, grip: 3.0, hp: 130, w: 50, h: 26 },
  truck: { accel: 300, maxSpeed: 260, reverse: 110, turn: 2.0, grip: 2.6, hp: 180, w: 58, h: 28 },
  police: { accel: 470, maxSpeed: 355, reverse: 150, turn: 2.9, grip: 3.6, hp: 120, w: 46, h: 24 },
  buggy: { accel: 500, maxSpeed: 360, reverse: 160, turn: 3.1, grip: 3.4, hp: 80, w: 44, h: 24 },
};

export const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1'];

export const WANTED = {
  // Heat thresholds that raise the star level.
  thresholds: [0, 25, 60, 110, 175, 260],
  decayPerSecond: 4,
  graceAfterCrime: 6,
  maxStars: 5,
};

export const POLICE = {
  // How many police cars hunt the player per star level.
  carsPerStar: [0, 1, 2, 3, 4, 5],
  footCopsPerStar: [0, 0, 1, 2, 3, 4],
  spawnDistance: 700,
  despawnDistance: 1400,
  ramDamage: 14,
};

export const ENEMY = {
  guardHp: 100,
  rivalHp: 100,
  copHp: 80,
  shootRange: 360,
  shootCooldown: 1.15,
  bulletSpeed: 420,
  bulletDamage: 7,
  walkSpeed: 95,
};

export const MISSION_REWARDS = [500, 800, 1200, 1500, 2000, 5000];

export const LAVA = {
  footDamagePerSecond: 22,
  carDamagePerSecond: 6,
  spreadEverySeconds: 6,
  spreadTilesPerTick: 3,
};

export const VIEW = { width: 1280, height: 720 };
