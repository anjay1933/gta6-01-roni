// NEON HARBOR — shots: deterministic staging for the 4 screenshots.
// ?shot=<name>&seed=N stages a scene, then sets window.__shotReady.
(function () {
  var NH = window.NH;

  var SH = NH.shots = { name: null, applied: false, frames: 0 };

  SH.presets = {
    // Cover: wide night skyline looking north up the x=-40 street canyon,
    // player in the pink sport car, NEON HARBOR sign ahead.
    start: function () {
      var car = NH.vehicles.create('sport', -40, 40, Math.PI, 'player');
      NH.vehicles.playerCar = car;
      NH.player.onFoot = false; NH.player.car = car;
      NH.player.group.visible = false;
      NH.player.group.position.copy(car.group.position);
      NH.player.heading = car.heading;
      NH.player.camPitch = 0.35;
      NH.player.driveCamDist = 15;
      NH._orbit = 0;
      NH.missions.state = 'active'; NH.missions.current = 0;
      NH.missions.showMarker(NH.MISSIONS[0].target.x, NH.MISSIONS[0].target.z);
      NH.hud.setObjective('FIRST PICKUP — Pier 9, 150m', NH.MISSIONS[0].target);
      NH.player.cash = 200;
    },
    // On foot at the docks, open ground, crane + container stacks ahead, cops closing in.
    docks: function () {
      NH.player.group.position.set(-120, 0, -30);
      NH.player.heading = -2.6; // face the crane at (-150,-80)
      NH.player.group.visible = true;
      NH.player.onFoot = true;
      NH.police.stars = 1;
      NH.police.spawnCop(-108, -44);
      NH.police.spawnCop(-132, -18);
      NH.traffic.spawnPed(-112, -20);
      NH.traffic.spawnPed(-128, -44);
      NH.missions.state = 'active'; NH.missions.current = 2;
      NH.missions.showMarker(-140, -40);
      NH.hud.setObjective('CONTAINER YARD — steal the sport car, 82m', { x: -140, z: -40 });
      NH.player.cash = 800;
      NH.player.ammo = 18;
    },
    // Driving chase: 3 stars, police cars set up ahead as a roadblock, downtown neon ahead.
    chase: function () {
      var car = NH.vehicles.create('sedan', 40, 60, Math.PI, 'player');
      NH.vehicles.playerCar = car;
      NH.player.onFoot = false; NH.player.car = car;
      NH.player.group.visible = false;
      NH.player.group.position.copy(car.group.position);
      NH.player.heading = car.heading;
      car.speed = 34;
      NH.police.stars = 3;
      var pc1 = NH.police.spawnPoliceCar();
      pc1.group.position.set(38, NH.city.groundHeight(38, 40), 40);
      pc1.heading = -Math.PI / 2;
      var pc2 = NH.police.spawnPoliceCar();
      pc2.group.position.set(44, NH.city.groundHeight(44, 36), 36);
      pc2.heading = Math.PI / 2;
      NH.traffic.spawnTrafficCar();
      NH.missions.state = 'active'; NH.missions.current = 3;
      NH.missions.showMarker(60, 120);
      NH.hud.setObjective('HOT GETAWAY — reach the safehouse, 64m', { x: 60, z: 120 });
      NH.player.cash = 1300;
      NH.player.health = 82;
    },
    // Mission moment: downtown shootout at the plaza intersection, rivals + a cop.
    mission: function () {
      NH.player.group.position.set(40, 0, 64); // on the x=40 street, camera stays on the road
      NH.player.heading = Math.PI;
      NH.player.group.visible = true;
      NH.player.onFoot = true;
      NH.player.ammo = 36;
      NH.player.armor = 60;
      for (var i = 0; i < 4; i++) {
        var r = NH.combat.spawnRival(40 + NH.rand(-12, 12), 40 + NH.rand(-12, 12));
        NH.missions.rivals.push(r);
      }
      NH.police.stars = 2;
      NH.police.spawnCop(52, 52);
      NH.missions.state = 'active'; NH.missions.current = 4;
      NH.missions.showMarker(40, 40);
      NH.hud.setObjective('DOWNTOWN SHOOTOUT — rivals left: 4', { x: 40, z: 40 });
      NH.player.cash = 2300;
      NH.player.health = 90;
    }
  };

  SH.apply = function () {
    var params = new URLSearchParams(location.search);
    var name = params.get('shot');
    if (!name || !SH.presets[name]) return false;
    SH.name = name;
    // start from the menu state but playing, so the HUD draws
    NH.state = 'playing';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    SH.presets[name]();
    return true;
  };

  // Called every frame after staging: let the scene settle, then flag ready.
  SH.tick = function () {
    if (!SH.name || SH.applied) return;
    SH.frames++;
    if (SH.frames >= 12) {
      SH.applied = true;
      window.__shotReady = true;
    }
  };
})();
