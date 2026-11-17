// NEON HARBOR — traffic: cars follow the street grid, pedestrians walk the
// sidewalks and flee from gunfire and reckless driving.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var T = NH.traffic = { cars: [], peds: [], panic: null };

  // A traffic car drives along one street; at intersections it may turn.
  T.spawnTrafficCar = function () {
    var axis = NH.rng() < 0.5 ? 'x' : 'z';
    var street = NH.randInt(-4, 4) * 40;
    var along = NH.rand(-160, 160);
    var dir = NH.rng() < 0.5 ? 1 : -1;
    var type = NH.randPick(['sedan', 'taxi', 'van', 'truck', 'sedan']);
    var x = axis === 'x' ? along : street;
    var z = axis === 'x' ? street : along;
    var heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    var car = NH.vehicles.create(type, x, z, heading, 'traffic');
    car.targetSpeed = NH.rand(8, 14);
    car.axis = axis; car.dir = dir;
    T.cars.push(car);
    return car;
  };

  T.spawnPed = function (x, z) {
    var colors = [0xe8b04b, 0x4b8ae8, 0xe84b6b, 0x7ae84b, 0xe8e8e8, 0xb04be8];
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: NH.randPick(colors) }));
    body.position.y = 1.05;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xd8a080 }));
    head.position.y = 1.85;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x22242c }));
    legL.position.set(-0.18, 0.35, 0);
    var legR = legL.clone(); legR.position.x = 0.18;
    g.add(body); g.add(head); g.add(legL); g.add(legR);
    var px = x !== undefined ? x : NH.rand(-160, 160);
    var pz = z !== undefined ? z : NH.rand(-160, 160);
    g.position.set(px, 0, pz);
    NH.scene.add(g);
    var ped = {
      group: g, legL: legL, legR: legR, heading: NH.rand(0, Math.PI * 2),
      speed: NH.rand(1.2, 2.2), target: null, fleeing: false, dead: false,
      walkPhase: NH.rand(0, 6)
    };
    ped.target = T.pickSidewalkTarget(px, pz);
    T.peds.push(ped);
    return ped;
  };

  T.pickSidewalkTarget = function (x, z) {
    // random point on a nearby sidewalk: a street line offset by ~6 units
    var street = Math.round((NH.rng() < 0.5 ? x : z) / 40) * 40;
    if (NH.rng() < 0.5) return { x: street + NH.randPick([-6, 6]), z: NH.rand(-160, 160) };
    return { x: NH.rand(-160, 160), z: street + NH.randPick([-6, 6]) };
  };

  // Something scary happened at (x,z): peds nearby flee, traffic slows.
  T.scare = function (x, z, radius) {
    T.panic = { x: x, z: z, t: 4 };
    T.peds.forEach(function (p) {
      if (p.dead) return;
      if (NH.dist2d(p.group.position.x, p.group.position.z, x, z) < radius) {
        p.fleeing = true;
        var dx = p.group.position.x - x, dz = p.group.position.z - z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        p.target = { x: p.group.position.x + (dx / d) * 40, z: p.group.position.z + (dz / d) * 40 };
        p.speed = 5.5;
      }
    });
  };

  T.init = function () {
    for (var i = 0; i < 10; i++) T.spawnTrafficCar();
    for (var j = 0; j < 22; j++) T.spawnPed();
  };

  function carAhead(car) {
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var px = car.group.position.x, pz = car.group.position.z;
    for (var i = 0; i < T.cars.length; i++) {
      var o = T.cars[i];
      if (o === car) continue;
      var dx = o.group.position.x - px, dz = o.group.position.z - pz;
      var along = dx * fx + dz * fz;
      var side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 3) return true;
    }
    // player car ahead counts too
    var pc = NH.vehicles.playerCar;
    if (pc) {
      var dx2 = pc.group.position.x - px, dz2 = pc.group.position.z - pz;
      var along2 = dx2 * fx + dz2 * fz;
      var side2 = Math.abs(dx2 * fz - dz2 * fx);
      if (along2 > 0 && along2 < 12 && side2 < 3) return true;
    }
    return false;
  }

  T.update = function (dt) {
    if (T.panic) { T.panic.t -= dt; if (T.panic.t <= 0) T.panic = null; }
    // Traffic cars.
    T.cars.forEach(function (car) {
      var want = car.targetSpeed;
      if (carAhead(car)) want = 0;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      var nx = car.group.position.x + fx * car.speed * dt;
      var nz = car.group.position.z + fz * car.speed * dt;
      // at an intersection (near a multiple of 40 on the cross axis), maybe turn
      var cross = car.axis === 'x' ? nz : nx;
      if (Math.abs(cross % 40) < 1.2 && NH.rng() < 0.02) {
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = NH.rng() < 0.5 ? 1 : -1;
        car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      }
      nx = NH.clamp(nx, -178, 178); nz = NH.clamp(nz, -178, 178);
      var p = { x: nx, z: nz };
      if (NH.city.collide(p, 2.2)) { // turn around instead of ramming a building
        car.heading += Math.PI / 2;
        car.axis = car.axis === 'x' ? 'z' : 'x';
      } else {
        car.group.position.x = p.x; car.group.position.z = p.z;
      }
      car.group.position.y = NH.city.groundHeight(car.group.position.x, car.group.position.z);
      car.group.rotation.y = car.heading;
      car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 2; });
    });
    // Pedestrians.
    T.peds.forEach(function (ped) {
      if (ped.dead) return;
      var pos = ped.group.position;
      var dx = ped.target.x - pos.x, dz = ped.target.z - pos.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        ped.target = T.pickSidewalkTarget(pos.x, pos.z);
        if (ped.fleeing) { ped.fleeing = false; ped.speed = NH.rand(1.2, 2.2); }
        return;
      }
      ped.heading = Math.atan2(dx, dz);
      pos.x += Math.sin(ped.heading) * ped.speed * dt;
      pos.z += Math.cos(ped.heading) * ped.speed * dt;
      pos.x = NH.clamp(pos.x, -175, 175); pos.z = NH.clamp(pos.z, -175, 175);
      ped.group.rotation.y = ped.heading;
      ped.walkPhase += dt * ped.speed * 2.2;
      var sw = Math.sin(ped.walkPhase) * 0.5;
      ped.legL.rotation.x = sw; ped.legR.rotation.x = -sw;
    });
  };
})();
