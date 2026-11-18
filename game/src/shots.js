// FROSTLINE — staged screenshot setups: ?shot=cover|foot|chase|mission&seed=N
// Each stage places the player, the camera and the world state, then raises
// window.__shotReady after a few frames so the capture tool knows it is done.
import { heightAt } from './world.js';
import { Car } from './vehicles.js';

export function applyShot(G, name) {
  const p = G.player;
  const aimCam = (yaw, pitch) => { p.camYaw = yaw; p.camPitch = pitch; };
  const standAt = (x, z, yaw) => {
    if (p.inCar) p.exitCar();
    p.pos.set(x, heightAt(x, z), z);
    p.angle = yaw;
    aimCam(yaw + Math.PI, 0.3);
  };
  const sitIn = (car, yaw) => {
    if (p.inCar) p.exitCar();
    p.enterCar(car);
    car.angle = yaw;
    car.speed = 0;
    aimCam(yaw + Math.PI, 0.3);
  };

  if (name === 'cover') {
    // Wide dusk shot: the player in the sport coupe on Main Street, the lodge
    // and the aurora behind.
    const car = G.cars.find((c) => c.type === 'sport' && !c.destroyed) || G.cars[0];
    sitIn(car, Math.PI / 2);
    car.x = 20; car.z = 0;
    car.mesh.position.set(car.x, heightAt(car.x, car.z), car.z);
    G.state = 'playing';
    G.missions.index = 0; G.missions.step = 0; G.missions.active = true;
    G.missions.updateMarker();
  } else if (name === 'foot') {
    // On foot by the lodge, pedestrians and pines around.
    standAt(52, -48, 2.6);
    G.state = 'playing';
    G.missions.index = 0; G.missions.step = 0; G.missions.active = true;
    G.missions.updateMarker();
  } else if (name === 'chase') {
    // Police chase on the pass road: 3 stars, two patrol cars behind.
    const car = G.cars.find((c) => c.type === 'suv' && !c.destroyed) || G.cars[0];
    sitIn(car, Math.PI);
    car.x = 150; car.z = 40; car.speed = 18;
    car.mesh.position.set(car.x, heightAt(car.x, car.z), car.z);
    G.wanted.setStars(3);
    for (let i = 0; i < 2; i++) {
      const pc = new Car(G, 'police', 150, 40 + 14 + i * 10, Math.PI, { driver: 'police' });
      pc.speed = 20;
      G.wanted.police.push(pc);
      G.cars.push(pc);
    }
    G.state = 'playing';
    G.missions.index = 3; G.missions.step = 0; G.missions.active = true;
    G.missions.updateMarker();
  } else if (name === 'mission') {
    // Mission 3: the snowcat at the lift depot, marker lit. The player stands
    // north-east of the depot; yaw -2.13 faces the snowcat (facing is
    // (sin(yaw), cos(yaw))), so the snowcat, the amber beacon and the depot
    // are all in frame with clear ground behind the camera.
    G.missions.index = 2; G.missions.step = 0;
    G.missions.start();
    standAt(64, -128, -2.13);
    G.state = 'playing';
  }

  // Hide the start screen, show the HUD, then signal readiness after 3 frames.
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  G.audio.init();
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames >= 3) { window.__shotReady = true; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
