// NEON HARBOR — vehicles: low-poly car factory, arcade driving physics,
// parked cars to steal, traffic cars on the streets.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var V = NH.vehicles = { cars: [], playerCar: null };

  function makeWheel() {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10),
      new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    w.rotation.z = Math.PI / 2;
    return w;
  }

  // Build a car mesh group. Returns { group, wheels, bodyMat }.
  V.makeCarMesh = function (type, color) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var dims = type === 'truck' ? { l: 5.6, w: 2.4, h: 1.1, cabH: 1.4 } :
               type === 'van' ? { l: 4.8, w: 2.3, h: 1.5, cabH: 0.9 } :
               { l: 4.4, w: 2.0, h: 0.85, cabH: 0.8 };
    var body = new THREE.Mesh(new THREE.BoxGeometry(dims.w, dims.h, dims.l), bodyMat);
    body.position.y = 0.75;
    var cab = new THREE.Mesh(new THREE.BoxGeometry(dims.w - 0.3, dims.cabH, dims.l * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x10151f, emissive: 0x0a1420 }));
    cab.position.set(0, 0.75 + dims.h / 2 + dims.cabH / 2 - 0.1, type === 'truck' ? 1.4 : -0.3);
    g.add(body); g.add(cab);
    // headlights + taillights
    var hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    var tlMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    [-0.6, 0.6].forEach(function (x) {
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), hlMat);
      hl.position.set(x, 0.8, dims.l / 2 + 0.05); g.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), tlMat);
      tl.position.set(x, 0.8, -dims.l / 2 - 0.05); g.add(tl);
    });
    var wheels = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
      var w = makeWheel();
      w.position.set(p[0] * (dims.w / 2 - 0.05), 0.42, p[1] * (dims.l / 2 - 0.7));
      g.add(w); wheels.push(w);
    });
    return { group: g, wheels: wheels, bodyMat: bodyMat, dims: dims };
  };

  // Create a car object and add it to the world.
  V.create = function (type, x, z, heading, driver) {
    var def = NH.CAR_TYPES[type] || NH.CAR_TYPES.sedan;
    var mesh = V.makeCarMesh(type, def.color);
    mesh.group.position.set(x, NH.city.groundHeight(x, z), z);
    mesh.group.rotation.y = heading || 0;
    NH.scene.add(mesh.group);
    var car = {
      type: type, def: def, group: mesh.group, wheels: mesh.wheels, bodyMat: mesh.bodyMat,
      speed: 0, steer: 0, heading: heading || 0,
      driver: driver || 'parked', damage: 0, smoke: null,
      wasParked: driver === 'parked',
      targetSpeed: 0, lane: 0, stuck: 0
    };
    V.cars.push(car);
    return car;
  };

  // Parked cars along curbs — the ones the player steals.
  V.spawnParked = function () {
    var spots = [
      [-20, 46, 0], [24, 46, 0], [-60, -34, 0], [80, 84, 0], [-100, 124, 0],
      [140, -60, 0], [40, -120, 0], [-140, 140, 0], [100, 20, 0], [-40, 100, 0],
      [120, 140, 0], [-80, -140, 0], [60, -40, 0], [-120, -100, 0]
    ];
    var types = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'sedan', 'taxi', 'sport', 'sedan', 'truck', 'sedan', 'van', 'sport', 'sedan'];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var c = V.create(types[i], s[0], s[1], NH.rand(0, Math.PI * 2), 'parked');
      // snap to curb: offset from street center
      c.group.position.x = s[0];
      c.group.position.z = s[1];
    }
  };

  // Arcade car physics for the player car. input: {throttle -1..1, steer -1..1}
  V.drive = function (car, throttle, steer, dt) {
    var def = car.def;
    var accel = throttle * def.accel;
    car.speed += accel * dt;
    // drag + rolling resistance
    car.speed -= car.speed * 0.55 * dt;
    if (throttle === 0) car.speed -= car.speed * 1.2 * dt;
    car.speed = NH.clamp(car.speed, -def.top * 0.45, def.top);
    // steering scales with speed, drift at high speed + full lock
    var grip = Math.abs(car.speed) > 18 && Math.abs(steer) > 0.7 ? 0.55 : 1;
    car.heading += steer * def.turn * NH.clamp(Math.abs(car.speed) / 8, 0, 1) * dt * grip * (car.speed >= 0 ? 1 : -1);
    var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    var nx = car.group.position.x + fx * car.speed * dt;
    var nz = car.group.position.z + fz * car.speed * dt;
    // world bounds + building collision
    nx = NH.clamp(nx, -178, 178); nz = NH.clamp(nz, -178, 178);
    var p = { x: nx, z: nz };
    if (NH.city.collide(p, 2.2)) {
      if (Math.abs(car.speed) > 8) { car.damage += Math.abs(car.speed) * 0.4; NH.audio.crash(); NH.hud.message('Crash! Car damaged'); }
      car.speed *= 0.3;
    }
    car.group.position.x = p.x; car.group.position.z = p.z;
    car.group.position.y = NH.city.groundHeight(p.x, p.z);
    car.group.rotation.y = car.heading;
    // wheels spin + front wheels steer
    car.wheels.forEach(function (w, i) {
      w.rotation.x += car.speed * dt * 2;
      if (i < 2) w.rotation.y = steer * 0.4;
    });
    // damage smoke
    if (car.damage > 40 && !car.smoke) {
      car.smoke = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x666666, size: 0.8, transparent: true, opacity: 0.7 }));
      NH.scene.add(car.smoke);
    }
    if (car.smoke) {
      var pos = car.smoke.geometry.attributes.position;
      if (!pos) {
        var arr = new Float32Array(20 * 3);
        car.smoke.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      }
      var a = car.smoke.geometry.attributes.position.array;
      for (var i = 0; i < 20; i++) {
        a[i * 3] = car.group.position.x + NH.rand(-0.5, 0.5);
        a[i * 3 + 1] = car.group.position.y + 1.5 + NH.rand(0, 2);
        a[i * 3 + 2] = car.group.position.z + NH.rand(-0.5, 0.5);
      }
      car.smoke.geometry.attributes.position.needsUpdate = true;
    }
    if (car.damage > 100) { car.speed *= 0.95; }
    return car;
  };

  V.remove = function (car) {
    NH.scene.remove(car.group);
    var i = V.cars.indexOf(car);
    if (i >= 0) V.cars.splice(i, 1);
  };
})();
