// DUSTLINE screenshot staging: ?shot=<name>&seed=<n> puts the live game into a
// fixed, deterministic frame — the same seed always gives the same picture — and
// raises window.__shotReady once a few frames have rendered, so a headless
// browser can screenshot exactly what a player would see.
//
//   1-cover.jpg  wide golden-hour skyline: highway, downtown, a muscle car, dust
//   2-gas.jpg    Jax on foot at the gas station, mission beacon overhead
//   3-chase.jpg  highway chase at 3 stars, two police cars on the tail
//   4-mission.jpg quarry heist: Jax, crates, guards, pistol out

import { makeRng } from './util.js';

/** Stage one named shot. `game` is the live Game object from main.js. */
export function stageShot(name, game) {
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || '11');
  const rng = makeRng(seed);
  game.startFreeRoam();
  const cam = game.camera;

  if (name === '2-gas') {
    // On foot at the gas station, beacon overhead, diner sign behind.
    game.player.x = -182;
    game.player.z = 40;
    game.player.heading = Math.atan2(-(26 - 40), -190 - -182);
    game.player.camYaw = game.player.heading;
    game.player.group.position.set(game.player.x, 0, game.player.z);
    game.player.group.rotation.y = game.player.heading;
    game.missions.start(0);
    game.hud.show();
    game.state = 'playing';
  } else if (name === '3-chase') {
    // Driving the muscle car down the highway, 3 stars, two cops closing in.
    // Locked 3/4 rear camera so the player car AND both police cars read in one frame.
    const car = game.traffic.parked.find((c) => c.type === 'muscle') || game.traffic.parked[0];
    game.traffic.steal(car);
    car.x = 40; car.z = 3.5; car.heading = 0; car.speed = 26;
    car.sync();
    game.player.enterCar(car);
    game.wanted.addStars(3, 'shot');
    const cop1 = game.wanted.spawnCop(20, -3.5);
    cop1.x = 48; cop1.z = -4.5; cop1.heading = 0; cop1.sync();
    const cop2 = game.wanted.spawnCop(8, 3.5);
    cop2.x = 44; cop2.z = 9; cop2.heading = 0; cop2.sync();
    game.missions.start(3);
    game.missions.active.surviveLeft = 24;
    game.hud.show();
    game.state = 'playing';
    cam.position.set(36, 5.5, 13);
    cam.lookAt(68, 1.5, 0);
    game.shotCameraLock = true;
  } else if (name === '4-mission') {
    // Quarry heist in progress: high locked camera looking down into the pit so
    // the crates, the guards and Jax all read at once. Guards hold fire for the shot.
    game.player.x = -256;
    game.player.z = 224;
    game.player.heading = Math.atan2(-(230 - 224), -270 - -256);
    game.player.camYaw = game.player.heading;
    game.player.group.position.set(game.player.x, 0, game.player.z);
    game.player.group.rotation.y = game.player.heading;
    game.missions.start(2);
    game.missions.active.collected = 1;
    game.cratesCollected = 1;
    game.rivals.spawn(-270, 230, 2, rng);
    for (const f of game.rivals.fighters) f.shootCooldown = 6;
    game.combat.ammo = 18;
    game.hud.show();
    game.state = 'playing';
    cam.position.set(-234, 20, 256);
    cam.lookAt(-272, -3, 226);
    game.shotCameraLock = true;
  } else {
    // 1-cover (default): wide golden-hour shot — muscle car on the highway,
    // downtown skyline and water tower ahead, mesas on the rim, dust in the air.
    const car = game.traffic.parked.find((c) => c.type === 'muscle') || game.traffic.parked[0];
    car.x = -40; car.z = 3.5; car.heading = 0; car.sync();
    game.player.x = -52;
    game.player.z = 8;
    game.player.heading = 0.4;
    game.player.camYaw = 0.15;
    game.player.group.position.set(game.player.x, 0, game.player.z);
    game.player.group.rotation.y = game.player.heading;
    game.missions.start(0);
    game.hud.show();
    game.state = 'playing';
    // Pull the camera up and back for the wide establishing frame.
    cam.position.set(-82, 15, 44);
    cam.lookAt(80, 3, -20);
    game.shotCameraLock = true;
  }

  // Snap the chase camera into place at once (the loop eases it over ~2s of game
  // time, which is far too slow for a staged shot at low frame rates).
  if (!game.shotCameraLock) game.player.updateCamera(1);

  // Let the world settle a few frames, then signal the screenshot tool.
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 24) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
