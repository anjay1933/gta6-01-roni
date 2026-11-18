// EMBER ISLE itself: a volcanic tropical island built from a seed.
// Ocean ring, black-sand beach, jungle, a port town, roads, a volcano with
// lava flows, and a wooden dock. Lava is a live set: mission 6 grows it.
import { TILE, MAP_W, MAP_H, T, WORLD_W, WORLD_H } from './config.js';
import { makeRng, hash2, clamp } from './random.js';

// Smooth value noise from the integer hash: two octaves, tile-scale 9 and 23.
function vnoise(tx, ty, seed) {
  function smooth(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, seed);
    const b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed);
    const d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return smooth(tx / 9, ty / 9) * 0.65 + smooth(tx / 23, ty / 23) * 0.35;
}

function tileIndex(tx, ty) {
  return ty * MAP_W + tx;
}

function drawRoad(tiles, x0, y0, x1, y1) {
  // A road is a thick line between two tile points (Bresenham + width 1).
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(x0 + (dx * s) / steps);
    const cy = Math.round(y0 + (dy * s) / steps);
    for (let ox = -1; ox <= 0; ox++) {
      for (let oy = -1; oy <= 0; oy++) {
        const tx = cx + ox;
        const ty = cy + oy;
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        const i = tileIndex(tx, ty);
        // The road paves over lava flows — a causeway through the field —
        // but never over the ocean. Without this the volcano road dead-ends
        // at the flow and a car wedges there trying to turn around.
        if (tiles[i] !== T.OCEAN) tiles[i] = T.ROAD;
      }
    }
  }
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const volcano = { tx: 40, ty: 24 };

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const nx = (tx - 40) / 34;
      const ny = (ty - 42) / 32;
      const wobble = (vnoise(tx, ty, seed + 7) - 0.5) * 0.22;
      const d = Math.sqrt(nx * nx + ny * ny) + wobble;
      let t;
      if (d > 1) t = T.OCEAN;
      else if (d > 0.86) t = T.BEACH;
      else t = T.GRASS;
      // Jungle where the noise is high, away from the town and the volcano.
      const vd = Math.hypot(tx - volcano.tx, ty - volcano.ty);
      if (t === T.GRASS && vnoise(tx, ty, seed + 21) > 0.6 && vd > 9 && tx < 52) t = T.JUNGLE;
      // Volcano cone: rock, then a lava crater.
      if (vd < 7.5) t = T.ROCK;
      if (vd < 3.2) t = T.LAVA;
      tiles[tileIndex(tx, ty)] = t;
    }
  }

  // Lava flows: three noisy rivers running south off the crater.
  const lava = new Set();
  for (let i = 0; i < MAP_W * MAP_H; i++) if (tiles[i] === T.LAVA) lava.add(i);
  const flowStarts = [
    [40, 27],
    [37, 27],
    [43, 27],
  ];
  for (const [sx, sy] of flowStarts) {
    let x = sx;
    let y = sy;
    for (let step = 0; step < 15; step++) {
      const i = tileIndex(x, y);
      if (tiles[i] !== T.OCEAN) {
        tiles[i] = T.LAVA;
        lava.add(i);
      }
      x += rng.int(-1, 1);
      y += rng.int(0, 1);
      x = clamp(x, 2, MAP_W - 3);
      y = clamp(y, 2, MAP_H - 3);
    }
  }

  // Port town on the east coast.
  for (let ty = 36; ty <= 46; ty++) {
    for (let tx = 54; tx <= 67; tx++) {
      const i = tileIndex(tx, ty);
      if (tiles[i] !== T.OCEAN && tiles[i] !== T.LAVA) tiles[i] = T.TOWN;
    }
  }
  // Wooden dock reaching east into the sea.
  for (let ty = 40; ty <= 42; ty++) {
    for (let tx = 68; tx <= 72; tx++) {
      tiles[tileIndex(tx, ty)] = T.DOCK;
    }
  }

  // Road network: port <-> junction <-> hideout / jungle drop / ferry /
  // volcano base / observatory, plus a beach loop road on the west side.
  const roadSegs = [
    [60, 41, 46, 40],
    [46, 40, 20, 56],
    [46, 40, 30, 54],
    [46, 40, 62, 50],
    [46, 40, 40, 32],
    [40, 32, 40, 22],
    [20, 56, 10, 40],
    [10, 40, 36, 14],
    [36, 14, 60, 20],
    [60, 20, 60, 41],
  ];
  for (const [x0, y0, x1, y1] of roadSegs) drawRoad(tiles, x0, y0, x1, y1);
  const roadNodes = [
    { x: 60 * TILE + 20, y: 41 * TILE + 20 },
    { x: 46 * TILE + 20, y: 40 * TILE + 20 },
    { x: 20 * TILE + 20, y: 56 * TILE + 20 },
    { x: 30 * TILE + 20, y: 54 * TILE + 20 },
    { x: 62 * TILE + 20, y: 50 * TILE + 20 },
    { x: 40 * TILE + 20, y: 32 * TILE + 20 },
    { x: 40 * TILE + 20, y: 22 * TILE + 20 },
    { x: 10 * TILE + 20, y: 40 * TILE + 20 },
    { x: 36 * TILE + 20, y: 14 * TILE + 20 },
    { x: 60 * TILE + 20, y: 20 * TILE + 20 },
  ];

  // Buildings: town blocks, the observatory, the vault, the hideout shack.
  const buildingColors = ['#b5654a', '#7a6a53', '#5d7a8c', '#8c5d7a', '#6a8c5d', '#a08c4a'];
  const buildings = [];
  function addBuilding(tx, ty, tw, th) {
    buildings.push({
      x: tx * TILE,
      y: ty * TILE,
      w: tw * TILE,
      h: th * TILE,
      color: rng.pick(buildingColors),
    });
  }
  addBuilding(55, 37, 3, 2);
  addBuilding(59, 37, 2, 2);
  addBuilding(63, 37, 3, 2);
  addBuilding(55, 42, 2, 3);
  addBuilding(58, 44, 3, 2);
  addBuilding(63, 43, 2, 2);
  addBuilding(65, 39, 2, 2);
  addBuilding(56, 39, 2, 2);
  addBuilding(39, 21, 3, 2); // observatory on the volcano slope
  addBuilding(41, 28, 1, 2); // the vault bunker at the crater rim (rock, not lava)
  addBuilding(19, 55, 2, 2); // hideout shack

  // Props: palms on the beach and jungle edge, boulders on the rock, crates
  // around the port and the hideout.
  const props = [];
  for (let n = 0; n < 260; n++) {
    const tx = rng.int(1, MAP_W - 2);
    const ty = rng.int(1, MAP_H - 2);
    const t = tiles[tileIndex(tx, ty)];
    if (t === T.BEACH && rng.chance(0.5)) {
      props.push({ x: tx * TILE + rng.range(6, 34), y: ty * TILE + rng.range(6, 34), kind: 'palm', r: 9 });
    } else if (t === T.JUNGLE && rng.chance(0.35)) {
      props.push({ x: tx * TILE + rng.range(6, 34), y: ty * TILE + rng.range(6, 34), kind: 'palm', r: 9 });
    } else if (t === T.ROCK && rng.chance(0.3)) {
      props.push({ x: tx * TILE + rng.range(6, 34), y: ty * TILE + rng.range(6, 34), kind: 'rock', r: 12 });
    }
  }
  for (let n = 0; n < 14; n++) {
    props.push({ x: rng.range(54 * TILE, 66 * TILE), y: rng.range(37 * TILE, 45 * TILE), kind: 'crate', r: 10 });
  }
  for (let n = 0; n < 6; n++) {
    props.push({ x: rng.range(18 * TILE, 22 * TILE), y: rng.range(54 * TILE, 58 * TILE), kind: 'crate', r: 10 });
  }

  const px = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  return {
    seed,
    tiles,
    lava,
    buildings,
    props,
    roadNodes,
    time: 0,
    places: {
      port: px(60, 41),
      town: px(58, 40),
      hideout: px(20, 56),
      jungleDrop: px(30, 54),
      observatory: px(40, 21),
      vault: { x: 1660, y: 1160 }, // the bunker door, beside the crater road
      ferryDock: px(62, 50),
      boat: px(72, 41),
      volcano: px(40, 24),
      beachWest: px(10, 40),
    },
  };
}

export function tileAt(world, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.OCEAN;
  return world.tiles[ty * MAP_W + tx];
}

export function tileWalkable(t) {
  return t !== T.OCEAN;
}

export function tileDriveable(t) {
  return t === T.ROAD || t === T.TOWN || t === T.GRASS || t === T.BEACH || t === T.DOCK || t === T.JUNGLE;
}

export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

function circleHitsProp(world, x, y, r) {
  for (const p of world.props) {
    const dx = x - p.x;
    const dy = y - p.y;
    const rr = r + p.r;
    if (dx * dx + dy * dy < rr * rr) return p;
  }
  return null;
}

// Move a circle through the world: try x then y, sliding along what blocks.
// Returns {x, y, hitX, hitY, hit} — hit is true when anything stopped it.
export function moveCircle(world, x, y, r, dx, dy, forCar) {
  let nx = x;
  let ny = y;
  let hit = false;
  let hitX = false;
  let hitY = false;
  const blockedAt = (cx, cy) => {
    const t = tileAt(world, cx, cy);
    if (forCar) return !tileDriveable(t);
    return !tileWalkable(t);
  };
  const sampleBlocked = (cx, cy) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
      if (blockedAt(cx + ox, cy + oy)) return true;
    }
    return false;
  };
  if (dx !== 0) {
    const tx = x + dx;
    if (!sampleBlocked(tx, y) && !circleHitsBuilding(world, tx, y, r) && !circleHitsProp(world, tx, y, r)) nx = tx;
    else {
      hit = true;
      hitX = true;
    }
  }
  if (dy !== 0) {
    const ty = y + dy;
    if (!sampleBlocked(nx, ty) && !circleHitsBuilding(world, nx, ty, r) && !circleHitsProp(world, nx, ty, r)) ny = ty;
    else {
      hit = true;
      hitY = true;
    }
  }
  nx = Math.max(r, Math.min(WORLD_W - r, nx));
  ny = Math.max(r, Math.min(WORLD_H - r, ny));
  return { x: nx, y: ny, hit, hitX, hitY };
}

// Find a clear spot for a person near (x, y): walkable, not inside a
// building or a prop. Used when stepping out of a car, so nobody spawns
// wedged inside a wall.
export function findOpenSpot(world, x, y, r) {
  const tries = [
    [0, 0],
    [44, 0],
    [-44, 0],
    [0, -44],
    [0, 44],
    [44, 44],
    [-44, 44],
    [44, -44],
    [-44, -44],
    [88, 0],
    [-88, 0],
    [0, -88],
    [0, 88],
  ];
  for (const [dx, dy] of tries) {
    const cx = x + dx;
    const cy = y + dy;
    if (!tileWalkable(tileAt(world, cx, cy))) continue;
    if (circleHitsBuilding(world, cx, cy, r)) continue;
    if (circleHitsProp(world, cx, cy, r)) continue;
    return { x: cx, y: cy };
  }
  return { x, y };
}

// The eruption: each tick, a few tiles next to live lava catch fire.
export function spreadLava(world, rng, count) {
  const live = [...world.lava];
  if (live.length === 0) return 0;
  let added = 0;
  for (let n = 0; n < count; n++) {
    const from = live[rng.int(0, live.length - 1)];
    const fx = from % MAP_W;
    const fy = Math.floor(from / MAP_W);
    const dir = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const tx = fx + dir[0];
    const ty = fy + dir[1];
    if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) continue;
    const i = ty * MAP_W + tx;
    const t = world.tiles[i];
    if (world.lava.has(i)) continue;
    if (t === T.ROCK || t === T.GRASS || t === T.JUNGLE || t === T.BEACH) {
      world.tiles[i] = T.LAVA;
      world.lava.add(i);
      added++;
    }
  }
  return added;
}
