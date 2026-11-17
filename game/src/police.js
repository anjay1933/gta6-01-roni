// NEON HARBOR — police: 1–5 wanted stars, foot cops and patrol cars that
// chase and ram, roadblocks at 3+, decay when unseen, pay-n-spray clears.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var PO = NH.police = {
    stars: 0, heat: 0, lastCrime: -99, unseen: 0,
    cops: [], cars: [], sirenOn: false,
    spawnTimer: 0
  };

  PO.addStars = function (n, reason) {
    if (NH.state !== 'playing') return;
    PO.stars = Math.min(NH.CFG.maxWanted, PO.stars + n);
    PO.heat = 1;
    PO.lastCrime = NH.time;
    PO.unseen = 0;
    if (reason) NH.hud.message('Wanted! ' + reason);
    NH.audio.siren(PO.stars >= 1);
  };

  PO.clearStars = function () {
    PO.stars = 0; PO.heat = 0;
    NH.audio.siren(false);
    PO.removeAll();
    NH.hud.message('You lost the cops.');
  };

  PO.removeAll = function () {
    PO.cops.forEach(function (c) { NH.scene.remove(c.group); });
    PO.cars.forEach(function (c) { NH.vehicles.remove(c); });
    PO.cops = []; PO.cars = [];
  };

  function makeCopMesh() {
    var g = new THREE.Group();
    var navy = new THREE.MeshLambertMaterial({ color: 0x1a2a6b });
    var skin = new THREE.MeshLambertMaterial({ color: 0xd8a080 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42), navy);
    torso.position.y = 1.25;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.98;
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x0a1a4b }));
    cap.position.y = 2.22;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.3), navy);
    legL.position.set(-0.19, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.19;
    g.add(torso); g.add(head); g.add(cap); g.add(legL); g.add(legR);
    return { group: g, legL: legL, legR: legR };
  }

  PO.spawnCop = function (x, z) {
    var m = makeCopMesh();
    m.group.position.set(x, 0, z);
    NH.scene.add(m.group);
    var cop = { group: m.group, legL: m.legL, legR: m.legR, heading: 0, speed: NH.rand(3.5, 5), walkPhase: 0, shootTimer: NH.rand(1, 2), health: 50 };
    PO.cops.push(cop);
    return cop;
  };

  PO.spawnPoliceCar = function () {
    var p = NH.player.group.position;
    var ang = NH.rand(0, Math.PI * 2);
    var x = NH.clamp(p.x + Math.sin(ang) * 45, -170, 170);
    var z = NH.clamp(p.z + Math.cos(ang) * 45, -170, 170);
    var car = NH.vehicles.create('police', x, z, 0, 'police');
    // police light bar
    var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.9, -0.2);
    car.group.add(bar);
    car.lightBar = bar;
    car.lightPhase = 0;
    PO.cars.push(car);
    return car;
  };

  PO.update = function (dt) {
    var p = NH.player;
    if (PO.stars === 0) {
      PO.removeAll();
      NH.audio.siren(false);
      return;
    }
    // decay: no crime for a while and cops far away
    var nearestCop = 999;
    PO.cops.forEach(function (c) {
      nearestCop = Math.min(nearestCop, NH.dist2d(c.group.position.x, c.group.position.z, p.group.position.x, p.group.position.z));
    });
    PO.cars.forEach(function (c) {
      nearestCop = Math.min(nearestCop, NH.dist2d(c.group.position.x, c.group.position.z, p.group.position.x, p.group.position.z));
    });
    if (NH.time - PO.lastCrime > 15 && nearestCop > 40) {
      PO.unseen += dt;
      if (PO.unseen > 6) { PO.stars = Math.max(0, PO.stars - 1); PO.unseen = 0; PO.lastCrime = NH.time; NH.hud.message('Heat is cooling off…'); }
    } else {
      PO.unseen = 0;
    }

    // keep the right number of units on the street
    var wantCops = PO.stars >= 1 ? Math.min(2 + PO.stars, 8) : 0;
    var wantCars = PO.stars >= 2 ? Math.min(PO.stars - 1, 4) : 0;
    PO.spawnTimer -= dt;
    if (PO.spawnTimer <= 0) {
      PO.spawnTimer = 2.5;
      if (PO.cops.length < wantCops) {
        var a = NH.rand(0, Math.PI * 2);
        PO.spawnCop(NH.clamp(p.group.position.x + Math.sin(a) * 25, -170, 170), NH.clamp(p.group.position.z + Math.cos(a) * 25, -170, 170));
      }
      if (PO.cars.length < wantCars) PO.spawnPoliceCar();
    }

    // foot cops: run at the player, shoot at 2+ stars when close
    PO.cops.forEach(function (cop) {
      var dx = p.group.position.x - cop.group.position.x;
      var dz = p.group.position.z - cop.group.position.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      cop.heading = Math.atan2(dx, dz);
      var spd = cop.speed;
      if (d > 18) spd *= 1.4; // sprint to catch up
      if (d > 4) {
        cop.group.position.x += Math.sin(cop.heading) * spd * dt;
        cop.group.position.z += Math.cos(cop.heading) * spd * dt;
      }
      cop.group.position.y = NH.city.groundHeight(cop.group.position.x, cop.group.position.z);
      cop.group.rotation.y = cop.heading;
      cop.walkPhase += dt * spd * 2;
      cop.legL.rotation.x = Math.sin(cop.walkPhase) * 0.6;
      cop.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.6;
      if (PO.stars >= 2 && d < 26 && d > 3) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = NH.rand(1.2, 2.4);
          if (NH.rng() < 0.45) {
            p.damage(NH.randInt(4, 9));
            NH.combat.tracer(cop.group.position, p.group.position, 0xff4444);
          }
        }
      }
      // busted: cop touches the player on foot
      if (d < 1.6 && p.onFoot) NH.main.gameOver('busted');
    });

    // police cars: chase and ram
    PO.cars.forEach(function (car) {
      var dx = p.group.position.x - car.group.position.x;
      var dz = p.group.position.z - car.group.position.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      var wantHeading = Math.atan2(dx, dz);
      var dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += NH.clamp(dh, -1, 1) * 2.2 * dt;
      car.speed += ((d > 10 ? car.def.top : car.def.top * 0.6) - car.speed) * Math.min(1, dt * 1.2);
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      var nx = car.group.position.x + fx * car.speed * dt;
      var nz = car.group.position.z + fz * car.speed * dt;
      var pos = { x: NH.clamp(nx, -178, 178), z: NH.clamp(nz, -178, 178) };
      if (!NH.city.collide(pos, 2.2)) {
        car.group.position.x = pos.x; car.group.position.z = pos.z;
      } else {
        car.speed *= 0.4;
      }
      car.group.position.y = NH.city.groundHeight(car.group.position.x, car.group.position.z);
      car.group.rotation.y = car.heading;
      car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 2; });
      // flashing light bar
      car.lightPhase += dt * 6;
      car.lightBar.material.color.setHex(Math.sin(car.lightPhase) > 0 ? 0xff2222 : 0x2244ff);
      // ram the player car
      var pc = NH.vehicles.playerCar;
      if (pc && d < 4.5) {
        pc.damage += 6 * dt;
        pc.speed *= 0.97;
        if (pc.damage > 100) {
          NH.hud.message('Your car is wrecked!');
          NH.player.exitCar();
          NH.vehicles.remove(pc);
        }
      }
      // busted: police car stops right on the player on foot
      if (p.onFoot && d < 2.2) NH.main.gameOver('busted');
    });

    // pay-n-spray: drive into the purple booth to clear stars for cash
    var pc = NH.vehicles.playerCar;
    if (pc && PO.stars > 0) {
      var d = NH.dist2d(pc.group.position.x, pc.group.position.z, NH.city.paynspray.x, NH.city.paynspray.z);
      if (d < 7) {
        if (p.cash >= NH.CFG.paynsprayCost) {
          p.cash -= NH.CFG.paynsprayCost;
          PO.clearStars();
          NH.hud.message('Resprayed — clean slate. -$' + NH.CFG.paynsprayCost);
          NH.audio.pickup();
        } else {
          NH.hud.message('Pay-n-spray needs $' + NH.CFG.paynsprayCost);
        }
      }
    }
  };
})();
