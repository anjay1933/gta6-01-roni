// NEON HARBOR — missions: the 6-mission story arc for Dana Cruz.
// Marker beacon + HUD objective + cash rewards + unlock progression.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var M = NH.missions = {
    current: 0,           // index into NH.MISSIONS (0-based)
    state: 'idle',        // idle | active | done | complete
    timer: 0,
    marker: null,         // beacon mesh
    markerLight: null,
    tailCar: null,        // mission 2 tail
    targetCar: null,      // mission 3 steal target
    rivals: [],           // mission 5 shooters
    rivalCount: 0
  };

  M.start = function (idx) {
    var def = NH.MISSIONS[idx];
    if (!def) return;
    M.current = idx;
    M.state = 'active';
    M.timer = def.timed || 0;
    M.showMarker(def.target.x, def.target.z);
    NH.hud.banner('MISSION ' + def.id + ' — ' + def.title, def.brief);
    NH.hud.setObjective(def.title, def.target);
    NH.audio.pickup();
    if (def.wanted) NH.police.addStars(def.wanted, def.title + ' — the cops are coming');
    if (def.id === 2) {
      // tail car spawns behind the player
      var p = NH.player.group.position;
      M.tailCar = NH.vehicles.create('sedan', p.x + 20, p.z + 10, 0, 'tail');
      M.tailCar.bodyMat.color.setHex(0x111111);
    }
    if (def.id === 3) {
      M.targetCar = NH.vehicles.create('sport', def.target.x, def.target.z, Math.PI / 2, 'parked');
      M.targetCar.wasParked = true;
      for (var i = 0; i < 2; i++) {
        var g = NH.combat.spawnRival(def.target.x + NH.rand(-8, 8), def.target.z + NH.rand(-8, 8));
        M.rivals.push(g);
      }
      M.rivalCount = 2;
    }
    if (def.id === 5) {
      for (var j = 0; j < def.enemies; j++) {
        var r = NH.combat.spawnRival(
          NH.city.plaza.x + NH.rand(-18, 18), NH.city.plaza.z + NH.rand(-18, 18));
        M.rivals.push(r);
      }
      M.rivalCount = def.enemies;
    }
    NH.main.save();
  };

  M.showMarker = function (x, z) {
    M.hideMarker();
    var g = new THREE.Group();
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    beam.position.y = 20;
    var ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
    g.add(beam); g.add(ring);
    g.position.set(x, NH.city.groundHeight(x, z), z);
    NH.scene.add(g);
    M.marker = g;
  };

  M.hideMarker = function () {
    if (M.marker) { NH.scene.remove(M.marker); M.marker = null; }
  };

  M.complete = function () {
    var def = NH.MISSIONS[M.current];
    NH.player.cash += def.reward;
    NH.hud.banner('MISSION COMPLETE', def.title + ' — +$' + def.reward);
    NH.audio.pickup();
    M.hideMarker();
    M.cleanup();
    M.current++;
    if (M.current >= NH.MISSIONS.length) {
      M.state = 'complete';
      NH.main.gameOver('complete');
      return;
    }
    M.state = 'idle';
    NH.main.save();
    setTimeout(function () { if (NH.state === 'playing') M.start(M.current); }, 2500);
  };

  M.fail = function (reason) {
    NH.hud.banner('MISSION FAILED', reason);
    M.hideMarker();
    M.cleanup();
    M.state = 'idle';
    setTimeout(function () { if (NH.state === 'playing') M.start(M.current); }, 2500);
  };

  M.cleanup = function () {
    if (M.tailCar) { NH.vehicles.remove(M.tailCar); M.tailCar = null; }
    M.rivals.forEach(function (r) { NH.combat.removeRival(r); });
    M.rivals = []; M.rivalCount = 0; M.targetCar = null;
  };

  M.update = function (dt) {
    if (M.state !== 'active') return;
    var def = NH.MISSIONS[M.current];
    var p = NH.player.group.position;
    if (M.marker) M.marker.rotation.y += dt * 1.5;
    if (def.timed) {
      M.timer -= dt;
      NH.hud.setTimer(Math.max(0, Math.ceil(M.timer)));
      if (M.timer <= 0) { M.fail('Out of time!'); return; }
    }
    var d = NH.dist2d(p.x, p.z, def.target.x, def.target.z);
    NH.hud.setObjective(def.title + ' — ' + Math.round(d) + 'm', def.target);

    if (def.type === 'goto' || def.type === 'deliver' || def.type === 'escape') {
      if (d < 6) {
        if (def.type === 'escape' && NH.police.stars > 0 && def.id !== 6) {
          // getaway: must also lose the cops (handled below)
        }
        if (def.id === 4) {
          if (NH.police.stars === 0) { M.complete(); return; }
          NH.hud.setObjective('Lose the cops first! Stars: ' + NH.police.stars, def.target);
          return;
        }
        M.complete();
        return;
      }
    }
    if (def.type === 'steal') {
      // win when the player drives the target sport car into the garage zone
      var pc = NH.vehicles.playerCar;
      if (pc && pc === M.targetCar) {
        var gd = NH.dist2d(pc.group.position.x, pc.group.position.z, NH.city.garage.x, NH.city.garage.z);
        NH.hud.setObjective('Bring the sport car to the garage — ' + Math.round(gd) + 'm', NH.city.garage);
        if (gd < 12) { M.complete(); return; }
      } else if (M.targetCar) {
        var td = NH.dist2d(p.x, p.z, M.targetCar.group.position.x, M.targetCar.group.position.z);
        NH.hud.setObjective('Steal the sport car — ' + Math.round(td) + 'm', M.targetCar.group.position);
      }
    }
    if (def.type === 'shootout') {
      var left = M.rivals.filter(function (r) { return !r.dead; }).length;
      NH.hud.setObjective('Clear the plaza — rivals left: ' + left, def.target);
      if (left === 0) { M.complete(); return; }
    }
    // mission 2 tail car chases the player
    if (M.tailCar) {
      var t = M.tailCar;
      var dx = p.x - t.group.position.x, dz = p.z - t.group.position.z;
      var dd = Math.sqrt(dx * dx + dz * dz) || 1;
      var want = Math.atan2(dx, dz);
      var dh = want - t.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      t.heading += NH.clamp(dh, -1, 1) * 2 * dt;
      t.speed += (24 - t.speed) * Math.min(1, dt);
      t.group.position.x += Math.sin(t.heading) * t.speed * dt;
      t.group.position.z += Math.cos(t.heading) * t.speed * dt;
      t.group.position.y = NH.city.groundHeight(t.group.position.x, t.group.position.z);
      t.group.rotation.y = t.heading;
      t.wheels.forEach(function (w) { w.rotation.x += t.speed * dt * 2; });
      if (dd < 3) { t.speed *= 0.5; NH.audio.crash(); }
    }
  };
})();
