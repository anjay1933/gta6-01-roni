// Six missions for Rico, the island's getaway driver. Each mission is a
// small state machine: setup places the player, the cars, the guards and
// the markers; update watches the objective; target() tells the HUD arrow
// (and the autopilot) where to go next.
import { MISSION_REWARDS, T } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './people.js';
import { tileAt, spreadLava } from './world.js';
import { dist } from './random.js';
import { healPlayer } from './player.js';

export const MISSION_DEFS = [
  {
    id: 1,
    title: 'Hot Start',
    brief: 'Mama Lava needs a driver. Steal the sunset buggy at the port, then lose the heat and reach the hideout.',
    reward: MISSION_REWARDS[0],
  },
  {
    id: 2,
    title: 'Black Sand Run',
    brief: 'A package for the jungle drop. The cops are already on you — two stars. Drive the black-sand road and deliver it.',
    reward: MISSION_REWARDS[1],
  },
  {
    id: 3,
    title: 'The Observatory',
    brief: 'The observatory on the volcano slope holds three crates of Mama Lava\'s stash. Grab them on foot, past the guards, then get out.',
    reward: MISSION_REWARDS[2],
  },
  {
    id: 4,
    title: 'Ferry or Die',
    brief: 'The last ferry leaves in 2:30 and the whole island is looking for you. Three stars. Drive like the lava is behind you.',
    reward: MISSION_REWARDS[3],
  },
  {
    id: 5,
    title: 'Jungle Ambush',
    brief: 'Rivals want the jungle stash. Hold the clearing — eight of them, in two waves. Your pistol does the talking.',
    reward: MISSION_REWARDS[4],
  },
  {
    id: 6,
    title: 'The Eruption Job',
    brief: 'The vault at the crater rim holds the gold. Grab it while the volcano blows — lava is spreading, five stars, and the boat is the only way off.',
    reward: MISSION_REWARDS[5],
  },
];

function clearMissionEntities(game) {
  game.cars = game.cars.filter((c) => !c.mission && c.driver !== 'police');
  game.peds = game.peds.filter((p) => !p.mission && p.kind !== 'cop');
  game.markers = [];
  game.pickups = [];
  game.combat.bullets = [];
}

function putPlayerInCar(game, car) {
  const p = game.player;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
}

function ensureCar(game, x, y, kind) {
  const p = game.player;
  if (!p.onFoot && p.car && !p.car.wrecked) return p.car;
  const car = makeCar(game.world, x, y, kind || 'pickup', null, 'Mission ride');
  car.mission = true;
  game.cars.push(car);
  p.onFoot = true;
  p.car = null;
  p.x = x - 50;
  p.y = y + 20;
  putPlayerInCar(game, car);
  return car;
}

function addMarker(game, x, y, r, label, color) {
  game.markers.push({ x, y, r, label, color: color || '#ffd94a' });
}

function addPickup(game, x, y, kind, label) {
  game.pickups.push({ x, y, r: 26, kind, label, taken: false });
}

export function startMission(game, index) {
  const def = MISSION_DEFS[index];
  const { world, player } = game;
  clearMissionEntities(game);
  game.wanted.clear();
  player.dead = false;
  player.hp = player.maxHp;
  game.mission = {
    index,
    def,
    phase: 'brief',
    briefTimer: 3.5,
    stage: 0,
    timer: 0,
    lavaTimer: 0,
    data: {},
  };
  const P = world.places;

  if (index === 0) {
    player.onFoot = true;
    player.car = null;
    player.x = P.port.x - 60;
    player.y = P.port.y + 40;
    const buggy = makeCar(world, P.port.x + 60, P.port.y - 10, 'buggy', null, 'Sunset Buggy');
    buggy.mission = true;
    game.cars.push(buggy);
    game.mission.data.car = buggy;
    addMarker(game, P.hideout.x, P.hideout.y, 70, 'HIDEOUT');
  } else if (index === 1) {
    ensureCar(game, P.hideout.x, P.hideout.y, 'pickup');
    game.wanted.setStars(2);
    addMarker(game, P.jungleDrop.x, P.jungleDrop.y, 70, 'DROP');
  } else if (index === 2) {
    // North of the observatory: the crater's lava is just south of it,
    // so the player, the guards and the crates all stay on the north side.
    player.onFoot = true;
    player.car = null;
    player.x = P.observatory.x;
    player.y = P.observatory.y - 220;
    const guards = [
      [P.observatory.x - 130, P.observatory.y - 30],
      [P.observatory.x + 140, P.observatory.y - 20],
      [P.observatory.x - 150, P.observatory.y + 30],
      [P.observatory.x + 160, P.observatory.y + 40],
    ];
    for (const [gx, gy] of guards) {
      const g = makePed(world, gx, gy, 'guard');
      g.mission = true;
      game.peds.push(g);
    }
    addPickup(game, P.observatory.x - 120, P.observatory.y - 40, 'crate', 'STASH');
    addPickup(game, P.observatory.x + 130, P.observatory.y - 30, 'crate', 'STASH');
    addPickup(game, P.observatory.x - 40, P.observatory.y - 130, 'crate', 'STASH');
    // The exit is west, around the lava flows, not straight through them.
    const exit = { x: P.observatory.x - 300, y: P.observatory.y + 300 };
    game.mission.data.exit = exit;
    addMarker(game, exit.x, exit.y, 70, 'EXIT', '#7ee081');
    game.mission.data.crates = 3;
  } else if (index === 3) {
    // The ferry ride starts on the open road south of the volcano, past
    // the lava flow — not wedged against the vault bunker's corner, where
    // the car spends the whole timer trying to turn around.
    ensureCar(game, P.observatory.x, P.observatory.y + 500, 'sedan');
    game.wanted.setStars(3);
    game.mission.timer = 150;
    addMarker(game, P.ferryDock.x, P.ferryDock.y, 70, 'FERRY');
  } else if (index === 4) {
    player.onFoot = true;
    player.car = null;
    player.x = P.jungleDrop.x;
    player.y = P.jungleDrop.y;
    addPickup(game, P.jungleDrop.x + 40, P.jungleDrop.y - 30, 'health', 'MEDKIT');
    spawnRivalWave(game, 0);
    game.mission.data.kills = 0;
    game.mission.data.wave = 1;
  } else if (index === 5) {
    // Same open-road start as the ferry run: the buggy is not wedged
    // against the vault bunker, so the escape actually moves.
    ensureCar(game, P.observatory.x, P.observatory.y + 500, 'buggy');
    game.wanted.setStars(5);
    addMarker(game, P.vault.x, P.vault.y, 120, 'VAULT');
    // The gold sits at the vault door, on the road — not in the lava.
    addPickup(game, P.vault.x - 60, P.vault.y, 'gold', 'GOLD');
  }
  game.toast(def.title + ' — ' + def.brief);
}

function spawnRivalWave(game, wave) {
  const { world } = game;
  const c = world.places.jungleDrop;
  const spots = [
    [c.x - 260, c.y - 160],
    [c.x + 260, c.y - 140],
    [c.x - 240, c.y + 180],
    [c.x + 250, c.y + 170],
  ];
  for (const [x, y] of spots) {
    const r = makePed(world, x, y, 'rival');
    r.mission = true;
    r.wave = wave;
    game.peds.push(r);
  }
}

function finishMission(game) {
  const m = game.mission;
  game.player.money += m.def.reward;
  game.audio.missionDone();
  game.wanted.clear(); // the heat is off while the result shows
  game.save();
  if (m.index >= MISSION_DEFS.length - 1) {
    m.phase = 'complete';
  } else {
    m.phase = 'done';
  }
}

function failMission(game, reason) {
  game.mission.phase = 'failed';
  game.mission.failReason = reason;
  game.wanted.clear();
  game.audio.wantedUp();
}

export function updateMission(game, dt) {
  const m = game.mission;
  if (!m || m.phase === 'done' || m.phase === 'failed' || m.phase === 'complete') return;
  if (m.phase === 'brief') {
    m.briefTimer -= dt;
    if (m.briefTimer <= 0) m.phase = 'active';
    return;
  }
  const { player, world } = game;
  const P = world.places;

  if (player.dead) {
    failMission(game, 'Rico went down. The island keeps the gold — this time.');
    return;
  }

  // Pickups: walk or drive over them.
  for (const pk of game.pickups) {
    if (pk.taken) continue;
    if (dist(player.x, player.y, pk.x, pk.y) < pk.r + 14) {
      pk.taken = true;
      game.audio.pickup();
      if (pk.kind === 'health') {
        healPlayer(player, 50);
        game.toast('Medkit +50 HP');
      } else if (pk.kind === 'gold') {
        game.toast('GOLD SECURED — run for the boat!');
      } else {
        game.toast('Stash grabbed');
      }
    }
  }

  const cratesLeft = () => game.pickups.filter((p) => p.kind === 'crate' && !p.taken).length;

  if (m.index === 0) {
    if (m.stage === 0) {
      if (!player.onFoot && player.car) {
        m.stage = 1;
        game.wanted.addHeat(25);
        game.audio.wantedUp();
        game.toast('1 STAR — the cops saw the theft. Reach the hideout!');
      }
    } else if (dist(player.x, player.y, P.hideout.x, P.hideout.y) < 70) {
      finishMission(game);
    }
  } else if (m.index === 1) {
    if (dist(player.x, player.y, P.jungleDrop.x, P.jungleDrop.y) < 70) finishMission(game);
  } else if (m.index === 2) {
    if (m.stage === 0) {
      if (cratesLeft() === 0) {
        m.stage = 1;
        game.toast('All three crates — now get to the EXIT!');
      }
    } else if (dist(player.x, player.y, m.data.exit.x, m.data.exit.y) < 70) {
      finishMission(game);
    }
  } else if (m.index === 3) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(game, 'The ferry left without you. 2:30 is 2:30.');
      return;
    }
    if (dist(player.x, player.y, P.ferryDock.x, P.ferryDock.y) < 70) finishMission(game);
  } else if (m.index === 4) {
    const alive = game.peds.filter((p) => p.kind === 'rival' && !p.dead).length;
    if (m.data.wave === 1 && alive === 0) {
      m.data.wave = 2;
      game.toast('Wave 2 — four more rivals in the trees!');
      spawnRivalWave(game, 1);
    } else if (m.data.wave === 2 && alive === 0) {
      finishMission(game);
    }
  } else if (m.index === 5) {
    if (m.stage === 0) {
      // 120px, not 60: the vault bunker blocks the road tiles beside it,
      // so the closest a car can stop is ~108px out. The gold is a short
      // walk from there.
      if (dist(player.x, player.y, P.vault.x, P.vault.y) < 120) {
        m.stage = 1;
        game.toast('On foot — grab the GOLD at the vault!');
      }
    } else if (m.stage === 1) {
      const gold = game.pickups.find((p) => p.kind === 'gold');
      if (gold && gold.taken) {
        m.stage = 2;
        game.markers = [];
        addMarker(game, P.boat.x, P.boat.y, 70, 'BOAT', '#7ee081');
        game.toast('THE VOLCANO IS BLOWING — get to the boat!');
      }
    } else if (m.stage === 2) {
      m.lavaTimer += dt;
      if (m.lavaTimer > 6) {
        m.lavaTimer = 0;
        spreadLava(world, game.rng, 3);
      }
      if (dist(player.x, player.y, P.boat.x, P.boat.y) < 70) finishMission(game);
    }
  }
}

// Where the HUD arrow (and the autopilot) should point right now.
export function missionTarget(game) {
  const m = game.mission;
  if (!m || m.phase !== 'active') return null;
  const { player, world } = game;
  const P = world.places;
  if (m.index === 0) {
    if (m.stage === 0) {
      const car = m.data.car;
      return { x: car.x, y: car.y, needCar: true, shoot: false, label: 'Steal the buggy' };
    }
    return { x: P.hideout.x, y: P.hideout.y, needCar: true, shoot: false, label: 'Hideout' };
  }
  if (m.index === 1) return { x: P.jungleDrop.x, y: P.jungleDrop.y, needCar: true, shoot: false, label: 'Jungle drop' };
  if (m.index === 2) {
    if (m.stage === 0) {
      const left = game.pickups.filter((p) => p.kind === 'crate' && !p.taken);
      if (left.length > 0) {
        let best = left[0];
        for (const pk of left) if (dist(player.x, player.y, pk.x, pk.y) < dist(player.x, player.y, best.x, best.y)) best = pk;
        return { x: best.x, y: best.y, needCar: false, shoot: true, label: 'Stash crate' };
      }
    }
    return { x: m.data.exit.x, y: m.data.exit.y, needCar: false, shoot: true, label: 'Exit' };
  }
  if (m.index === 3) return { x: P.ferryDock.x, y: P.ferryDock.y, needCar: true, shoot: false, label: 'Ferry dock' };
  if (m.index === 4) {
    const alive = game.peds.filter((p) => p.kind === 'rival' && !p.dead);
    if (alive.length > 0) {
      let best = alive[0];
      for (const p of alive) if (dist(player.x, player.y, p.x, p.y) < dist(player.x, player.y, best.x, best.y)) best = p;
      return { x: best.x, y: best.y, needCar: false, shoot: true, label: 'Rival' };
    }
    return null;
  }
  if (m.index === 5) {
    if (m.stage === 0) return { x: P.vault.x, y: P.vault.y, needCar: true, shoot: false, label: 'Vault' };
    if (m.stage === 1) {
      const gold = game.pickups.find((p) => p.kind === 'gold');
      return { x: gold.x, y: gold.y, needCar: false, shoot: false, label: 'Gold' };
    }
    return { x: P.boat.x, y: P.boat.y, needCar: true, shoot: false, label: 'Boat' };
  }
  return null;
}

export function missionObjectiveText(game) {
  const m = game.mission;
  if (!m) return '';
  if (m.phase === 'brief') return m.def.title + ' — ' + m.def.brief;
  if (m.phase === 'done') return 'MISSION COMPLETE — ' + m.def.title + '  +' + '$' + m.def.reward;
  if (m.phase === 'failed') return 'MISSION FAILED — ' + (m.failReason || '');
  if (m.phase === 'complete') return 'EMBER ISLE COMPLETE — Rico got away with the gold.';
  const t = missionTarget(game);
  if (m.index === 0) return m.stage === 0 ? 'Steal the sunset buggy  [E]' : 'Drive to the HIDEOUT';
  if (m.index === 1) return 'Deliver the package to the JUNGLE DROP';
  if (m.index === 2) {
    const left = game.pickups.filter((p) => p.kind === 'crate' && !p.taken).length;
    return m.stage === 0 ? 'Grab the stash crates  (' + (3 - left) + '/3)' : 'Get to the EXIT';
  }
  if (m.index === 3) return 'Reach the FERRY DOCK before it leaves';
  if (m.index === 4) {
    const alive = game.peds.filter((p) => p.kind === 'rival' && !p.dead).length;
    return 'Defend the stash — rivals left: ' + alive;
  }
  if (m.index === 5) {
    if (m.stage === 0) return 'Drive to the VAULT at the crater rim';
    if (m.stage === 1) return 'On foot — grab the GOLD  [E to exit car]';
    return 'ESCAPE — reach the BOAT at the dock!';
  }
  return t ? t.label : '';
}
