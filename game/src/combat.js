// NEON HARBOR — combat: pistol + drive-by shooting, fists, health/armor/ammo
// pickups, and armed rivals for the story missions.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var C = NH.combat = {
    pickups: [], rivals: [], tracers: [],
    raycaster: null, shootCooldown: 0, meleeCooldown: 0
  };

  C.init = function () {
    C.raycaster = new THREE.Raycaster();
    // scattered pickups around the city
    var spots = [
      ['health', -60, 60], ['armor', 40, -60], ['ammo', -120, 100], ['health', 100, 100],
      ['ammo', 20, -120], ['armor', -40, -140], ['health', 140, 20], ['ammo', -160, -20]
    ];
    spots.forEach(function (s) { C.spawnPickup(s[0], s[1], s[2]); });
  };

  C.spawnPickup = function (kind, x, z) {
    var color = kind === 'health' ? 0x39ff88 : kind === 'armor' ? 0x22aaff : 0xffd21f;
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: color }));
    mesh.position.set(x, 1, z);
    NH.scene.add(mesh);
    var pk = { kind: kind, mesh: mesh, x: x, z: z, bob: NH.rand(0, 6) };
    C.pickups.push(pk);
    return pk;
  };

  C.spawnRival = function (x, z) {
    var g = new THREE.Group();
    var red = new THREE.MeshLambertMaterial({ color: 0xc22e2e });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42), red);
    torso.position.y = 1.25;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.98;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.3), red);
    legL.position.set(-0.19, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.19;
    g.add(torso); g.add(head); g.add(legL); g.add(legR);
    g.position.set(x, 0, z);
    NH.scene.add(g);
    var rival = { group: g, legL: legL, legR: legR, health: 60, dead: false, shootTimer: NH.rand(1, 2.5), walkPhase: 0 };
    C.rivals.push(rival);
    return rival;
  };

  C.removeRival = function (rival) {
    NH.scene.remove(rival.group);
    var i = C.rivals.indexOf(rival);
    if (i >= 0) C.rivals.splice(i, 1);
  };

  // A visible shot line from `from` to `to`, fades in 120ms.
  C.tracer = function (from, to, color) {
    var geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y + 1.4, from.z),
      new THREE.Vector3(to.x, to.y + 1.2, to.z)
    ]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffe9a8 }));
    NH.scene.add(line);
    C.tracers.push({ line: line, t: 0.12 });
  };

  C.shoot = function () {
    var p = NH.player;
    if (C.shootCooldown > 0 || NH.state !== 'playing') return;
    if (p.ammo <= 0) { NH.hud.message('No ammo — find an ammo pickup (yellow)'); NH.audio.blip(220); return; }
    C.shootCooldown = 0.22;
    p.ammo--;
    NH.audio.shot();
    NH.traffic.scare(p.group.position.x, p.group.position.z, 30);
    // raycast from camera through screen center
    C.raycaster.setFromCamera({ x: 0, y: 0 }, NH.camera);
    C.raycaster.far = 120;
    var targets = [];
    NH.traffic.peds.forEach(function (ped) { if (!ped.dead) targets.push(ped.group); });
    NH.police.cops.forEach(function (c) { targets.push(c.group); });
    C.rivals.forEach(function (r) { if (!r.dead) targets.push(r.group); });
    NH.vehicles.cars.forEach(function (c) { targets.push(c.group); });
    var hits = C.raycaster.intersectObjects(targets, true);
    var end = null;
    if (hits.length > 0) {
      var hit = hits[0];
      end = hit.point;
      // walk up to the object that owns this mesh
      var obj = hit.object;
      while (obj.parent && obj.parent !== NH.scene) obj = obj.parent;
      var owner = obj;
      // ped?
      var ped = NH.traffic.peds.find(function (pd) { return pd.group === owner; });
      if (ped) {
        ped.dead = true; ped.group.rotation.x = -Math.PI / 2; ped.group.position.y = 0.3;
        NH.police.addStars(1, 'shot a pedestrian');
      }
      var cop = NH.police.cops.find(function (cp) { return cp.group === owner; });
      if (cop) {
        cop.health -= 50;
        if (cop.health <= 0) { NH.scene.remove(cop.group); NH.police.cops.splice(NH.police.cops.indexOf(cop), 1); }
        NH.police.addStars(1, 'shot a cop');
      }
      var rival = C.rivals.find(function (rv) { return rv.group === owner; });
      if (rival) {
        rival.health -= 50;
        if (rival.health <= 0) {
          rival.dead = true;
          rival.group.rotation.x = -Math.PI / 2;
          rival.group.position.y = 0.3;
          NH.player.cash += 50;
          NH.hud.message('Rival down! +$50');
        }
      }
      var car = NH.vehicles.cars.find(function (cc) { return cc.group === owner; });
      if (car && car.driver !== 'player') {
        car.damage += 15;
        if (car.damage > 80) {
          NH.hud.message('Car wrecked!');
          NH.vehicles.remove(car);
        }
      }
    } else {
      end = C.raycaster.ray.at(120, new THREE.Vector3());
    }
    C.tracer(p.group.position, end, 0xffe9a8);
    if (!p.onFoot) { /* drive-by: shooting from the car also counts */ }
  };

  C.melee = function () {
    var p = NH.player;
    if (C.meleeCooldown > 0 || !p.onFoot) return;
    C.meleeCooldown = 0.5;
    NH.audio.blip(180);
    var fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    var hit = null;
    NH.traffic.peds.forEach(function (ped) {
      if (ped.dead) return;
      var dx = ped.group.position.x - p.group.position.x;
      var dz = ped.group.position.z - p.group.position.z;
      if (dx * fx + dz * fz > 0 && Math.sqrt(dx * dx + dz * dz) < 2.2) hit = ped;
    });
    if (hit) {
      hit.dead = true; hit.group.rotation.x = -Math.PI / 2; hit.group.position.y = 0.3;
      NH.traffic.scare(hit.group.position.x, hit.group.position.z, 20);
      NH.police.addStars(1, 'assault');
    }
  };

  C.update = function (dt) {
    if (C.shootCooldown > 0) C.shootCooldown -= dt;
    if (C.meleeCooldown > 0) C.meleeCooldown -= dt;
    var p = NH.player;
    var inp = NH.input;
    // left click shoots (on foot or drive-by), F punches
    if (inp.leftDown) C.shoot();
    if (inp.consumeKey('KeyF')) C.melee();
    // pickups bob + collect
    C.pickups.forEach(function (pk, i) {
      pk.bob += dt * 2;
      pk.mesh.position.y = 1 + Math.sin(pk.bob) * 0.2;
      pk.mesh.rotation.y += dt;
      var d = NH.dist2d(p.group.position.x, p.group.position.z, pk.x, pk.z);
      if (d < 2) {
        if (pk.kind === 'health') { p.heal(40); NH.hud.message('Health +40'); }
        if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); NH.hud.message('Armor +50'); }
        if (pk.kind === 'ammo') { p.ammo += 24; NH.hud.message('Ammo +24'); }
        NH.audio.pickup();
        NH.scene.remove(pk.mesh);
        C.pickups.splice(i, 1);
        // respawn elsewhere later
        setTimeout(function () {
          if (NH.state === 'playing') C.spawnPickup(pk.kind, NH.rand(-160, 160), NH.rand(-160, 160));
        }, 20000);
      }
    });
    // tracers fade
    C.tracers.forEach(function (t, i) {
      t.t -= dt;
      if (t.t <= 0) { NH.scene.remove(t.line); C.tracers.splice(i, 1); }
    });
    // rivals: advance on the player and shoot
    C.rivals.forEach(function (r) {
      if (r.dead) return;
      var dx = p.group.position.x - r.group.position.x;
      var dz = p.group.position.z - r.group.position.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      if (d > 6) {
        r.group.position.x += (dx / d) * 3.5 * dt;
        r.group.position.z += (dz / d) * 3.5 * dt;
        r.walkPhase += dt * 7;
        r.legL.rotation.x = Math.sin(r.walkPhase) * 0.6;
        r.legR.rotation.x = -Math.sin(r.walkPhase) * 0.6;
      }
      r.group.rotation.y = Math.atan2(dx, dz);
      r.group.position.y = NH.city.groundHeight(r.group.position.x, r.group.position.z);
      if (d < 30) {
        r.shootTimer -= dt;
        if (r.shootTimer <= 0) {
          r.shootTimer = NH.rand(1.4, 2.6);
          if (NH.rng() < 0.4) {
            p.damage(NH.randInt(5, 11));
            C.tracer(r.group.position, p.group.position, 0xff6644);
          }
        }
      }
    });
  };
})();
