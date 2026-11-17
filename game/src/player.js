// NEON HARBOR — player: Dana Cruz on foot (run, jump) and behind the wheel.
// Third-person camera follows; E enters/exits cars.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var P = NH.player = {
    group: null, legL: null, legR: null, armL: null, armR: null,
    heading: 0, speed: 0, vy: 0, grounded: true,
    onFoot: true, car: null,
    health: 100, armor: 0, cash: NH.CFG.startCash, ammo: 24,
    camYaw: 0, camPitch: 0.32, camDist: 7.5,
    walkPhase: 0, invuln: 0
  };

  P.buildMesh = function () {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xff2e88 }); // Dana's pink jacket
    var jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5e });
    var skin = new THREE.MeshLambertMaterial({ color: 0xd8a080 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), jacket);
    torso.position.y = 1.25;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.98;
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    hair.position.y = 2.22;
    P.legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.3), jeans);
    P.legL.position.set(-0.19, 0.38, 0);
    P.legR = P.legL.clone(); P.legR.position.x = 0.19;
    P.armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jacket);
    P.armL.position.set(-0.48, 1.3, 0);
    P.armR = P.armL.clone(); P.armR.position.x = 0.48;
    g.add(torso); g.add(head); g.add(hair); g.add(P.legL); g.add(P.legR); g.add(P.armL); g.add(P.armR);
    P.group = g;
    NH.scene.add(g);
  };

  P.init = function (x, z) {
    P.buildMesh();
    P.group.position.set(x || 0, 0, z || 120);
    P.heading = 0;
    P.camYaw = 0;
  };

  P.damage = function (n) {
    if (P.invuln > 0 || NH.state !== 'playing') return;
    var absorbed = Math.min(P.armor, n);
    P.armor -= absorbed;
    P.health -= (n - absorbed);
    P.invuln = 0.4;
    NH.hud.flashDamage();
    if (P.health <= 0) {
      P.health = 0;
      NH.main.gameOver('wasted');
    }
  };

  P.heal = function (n) { P.health = Math.min(100, P.health + n); };

  P.enterCar = function (car) {
    if (!car) return;
    P.onFoot = false; P.car = car;
    car.driver = 'player';
    NH.vehicles.playerCar = car;
    P.group.visible = false;
    NH.audio.engine(true, 0);
    NH.hud.message('You took the ' + car.def.name);
  };

  P.exitCar = function () {
    var car = P.car;
    if (!car) return;
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    P.group.position.set(
      car.group.position.x - fx * 2.5,
      NH.city.groundHeight(car.group.position.x, car.group.position.z),
      car.group.position.z - fz * 2.5
    );
    P.heading = car.heading;
    P.group.visible = true;
    P.onFoot = true; P.car = null;
    car.driver = 'parked';
    NH.vehicles.playerCar = null;
    NH.audio.engine(false, 0);
  };

  // Find the nearest enterable car within 4 units.
  P.nearestCar = function () {
    var best = null, bd = 4.5;
    NH.vehicles.cars.forEach(function (c) {
      if (c.driver === 'police') return;
      var d = NH.dist2d(P.group.position.x, P.group.position.z, c.group.position.x, c.group.position.z);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  };

  P.update = function (dt) {
    if (P.invuln > 0) P.invuln -= dt;
    var inp = NH.input;
    P.camYaw += inp.yawDelta;
    P.camPitch = NH.clamp(P.camPitch + inp.pitchDelta, -0.15, 0.9);

    if (P.onFoot) {
      var ax = inp.moveAxis(NH.camYaw || Math.PI);
      var sprint = inp.keys['ShiftLeft'] || inp.keys['ShiftRight'];
      var spd = sprint ? NH.CFG.sprintSpeed : NH.CFG.walkSpeed;
      var len = Math.sqrt(ax.x * ax.x + ax.z * ax.z);
      if (len > 0.01) {
        P.heading = Math.atan2(ax.x, ax.z);
        P.speed = spd;
        var pos = P.group.position;
        var nx = pos.x + (ax.x / len) * spd * dt;
        var nz = pos.z + (ax.z / len) * spd * dt;
        nx = NH.clamp(nx, -178, 178); nz = NH.clamp(nz, -178, 178);
        var p = { x: nx, z: nz };
        NH.city.collide(p, 0.6);
        pos.x = p.x; pos.z = p.z;
        P.walkPhase += dt * spd * 1.6;
        var sw = Math.sin(P.walkPhase) * 0.6;
        P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
        P.armL.rotation.x = -sw * 0.8; P.armR.rotation.x = sw * 0.8;
      } else {
        P.speed = 0;
        P.legL.rotation.x *= 0.8; P.legR.rotation.x *= 0.8;
        P.armL.rotation.x *= 0.8; P.armR.rotation.x *= 0.8;
      }
      // jump
      if (inp.consumeKey('Space') && P.grounded) { P.vy = NH.CFG.jumpSpeed; P.grounded = false; }
      if (!P.grounded) {
        P.vy -= NH.CFG.gravity * dt;
        P.group.position.y += P.vy * dt;
        var gy = NH.city.groundHeight(P.group.position.x, P.group.position.z);
        if (P.group.position.y <= gy) { P.group.position.y = gy; P.vy = 0; P.grounded = true; }
      }
      P.group.rotation.y = P.heading;
      // enter car
      if (inp.consumeKey('KeyE')) {
        var car = P.nearestCar();
        if (car) {
          var wasParked = car.wasParked;
          P.enterCar(car);
          if (wasParked) NH.police.addStars(1, 'car theft');
          car.wasParked = false;
        }
      }
      // run over check is done in police.js (cars vs peds); on foot, check pickups in combat.js
    } else if (P.car) {
      var car = P.car;
      var throttle = 0;
      if (inp.keys['KeyW'] || inp.keys['ArrowUp']) throttle += 1;
      if (inp.keys['KeyS'] || inp.keys['ArrowDown']) throttle -= 1;
      var steer = 0;
      if (inp.keys['KeyA'] || inp.keys['ArrowLeft']) steer -= 1;
      if (inp.keys['KeyD'] || inp.keys['ArrowRight']) steer += 1;
      NH.vehicles.drive(car, throttle, steer, dt);
      P.heading = car.heading;
      P.group.position.copy(car.group.position);
      NH.audio.engine(true, Math.abs(car.speed) / car.def.top);
      if (inp.consumeKey('KeyE')) P.exitCar();
      // hit pedestrians while driving
      NH.traffic.peds.forEach(function (ped) {
        if (ped.dead) return;
        var d = NH.dist2d(car.group.position.x, car.group.position.z, ped.group.position.x, ped.group.position.z);
        if (d < 2.2 && Math.abs(car.speed) > 4) {
          ped.dead = true;
          ped.group.rotation.x = -Math.PI / 2;
          ped.group.position.y = 0.3;
          NH.traffic.scare(ped.group.position.x, ped.group.position.z, 25);
          NH.police.addStars(1, 'hit pedestrian');
          NH.hud.message('You hit a pedestrian!');
        }
      });
    }

    // Camera: third person behind the player/car, mouse orbit offset decays.
    var target = P.group.position;
    var dist = P.onFoot ? P.camDist : (P.driveCamDist || 10.5);
    var height = P.onFoot ? 3.2 : 4.6;
    // orbit offset from mouse drag, decays back to straight behind the player
    var orbit = NH._orbit || 0;
    orbit += inp.yawDelta;
    orbit *= Math.pow(0.4, dt);
    NH._orbit = orbit;
    var cy = P.heading + Math.PI + orbit;
    // pull the camera in if a building blocks the view (camera collision)
    var cpos = null;
    for (var tries = 0; tries < 5; tries++) {
      var cx = target.x + Math.sin(cy) * dist * Math.cos(P.camPitch);
      var cz = target.z + Math.cos(cy) * dist * Math.cos(P.camPitch);
      var cyy = target.y + height + Math.sin(P.camPitch) * dist * 0.5;
      if (!NH.city.collide({ x: cx, z: cz }, 0.5)) { cpos = { x: cx, y: cyy, z: cz }; break; }
      dist *= 0.65;
    }
    if (!cpos) cpos = { x: target.x, y: target.y + 3, z: target.z };
    NH.camera.position.set(cpos.x, cpos.y, cpos.z);
    NH.camera.lookAt(target.x, target.y + 1.6, target.z);
    NH.camYaw = cy;
  };
})();
