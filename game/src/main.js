// NEON HARBOR — main: renderer + lights, game loop, menus, save/load.
// Boots the world, then runs menu → playing → paused / game over.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var MN = NH.main = {};
  NH.state = 'menu';
  NH.time = 0;
  NH.camYaw = Math.PI;

  MN.init = function () {
    var canvas = document.getElementById('game');
    NH.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    NH.renderer.setSize(window.innerWidth, window.innerHeight);
    NH.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    NH.scene = new THREE.Scene();
    NH.scene.background = new THREE.Color(0x05070f);
    NH.scene.fog = new THREE.Fog(0x0a0d1a, 60, 320);
    NH.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    NH.camera.position.set(0, 10, 140);

    // Lights: dim blue moonlight + warm ambient + a few neon point lights.
    NH.scene.add(new THREE.AmbientLight(0x33415e, 0.9));
    var moon = new THREE.DirectionalLight(0x8fa8ff, 0.7);
    moon.position.set(-80, 120, -60);
    NH.scene.add(moon);
    var hemi = new THREE.HemisphereLight(0x2a3450, 0x0a0a12, 0.5);
    NH.scene.add(hemi);
    [[0, 34, -40, 0xff2e88], [-60, 26, 0, 0x22e6ff], [100, 40, 0, 0xc26bff],
     [-140, 14, -80, 0xffb020], [-20, 8, 140, 0x39ff88]].forEach(function (l) {
      var pl = new THREE.PointLight(l[3], 1.2, 55);
      pl.position.set(l[0], l[1], l[2]);
      NH.scene.add(pl);
    });

    NH.city.build();
    NH.vehicles.spawnParked();
    NH.traffic.init();
    NH.player.init(0, 120);
    NH.combat.init();
    NH.hud.init();
    MN.load(); // restore save if there is one
    MN.wireMenus();

    window.addEventListener('resize', function () {
      NH.camera.aspect = window.innerWidth / window.innerHeight;
      NH.camera.updateProjectionMatrix();
      NH.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Staged screenshot? Skip the menu and set the scene up.
    var staged = NH.shots.apply();
    if (!staged) MN.showMenu();

    NH.clock = new THREE.Clock();
    NH.renderer.setAnimationLoop(MN.loop);
  };

  MN.wireMenus = function () {
    var startBtn = document.getElementById('startBtn');
    var continueBtn = document.getElementById('continueBtn');
    var resumeBtn = document.getElementById('resumeBtn');
    var restartBtn = document.getElementById('restartBtn');
    var menuBtn = document.getElementById('menuBtn');
    var muteBtn = document.getElementById('muteBtn');
    if (startBtn) startBtn.addEventListener('click', function () { MN.startGame(true); });
    if (continueBtn) continueBtn.addEventListener('click', function () { MN.startGame(false); });
    if (resumeBtn) resumeBtn.addEventListener('click', function () { MN.togglePause(false); });
    if (restartBtn) restartBtn.addEventListener('click', function () { MN.restart(); });
    if (menuBtn) menuBtn.addEventListener('click', function () { MN.showMenu(); });
    if (muteBtn) muteBtn.addEventListener('click', function () {
      NH.audio.muted = !NH.audio.muted;
      muteBtn.textContent = NH.audio.muted ? '🔇 Unmute' : '🔊 Mute';
    });
    // save + quit buttons
    var saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', function () { MN.save(); NH.hud.message('Progress saved'); });
  };

  MN.startGame = function (fresh) {
    NH.audio.init();
    NH.audio.setMusic(true);
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('gameover').style.display = 'none';
    NH.state = 'playing';
    if (fresh) {
      NH.player.cash = NH.CFG.startCash;
      NH.player.health = 100; NH.player.armor = 0; NH.player.ammo = 24;
      NH.missions.current = 0; NH.missions.state = 'idle';
      NH.police.clearStars();
    }
    if (NH.missions.state === 'idle') {
      setTimeout(function () { if (NH.state === 'playing') NH.missions.start(NH.missions.current); }, 1200);
    }
    NH.hud.message('Welcome to Neon Harbor, Dana.');
  };

  MN.showMenu = function () {
    NH.state = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('gameover').style.display = 'none';
    var cont = document.getElementById('continueBtn');
    if (cont) cont.style.display = MN.hasSave() ? 'inline-block' : 'none';
    NH.audio.setMusic(false);
  };

  MN.togglePause = function (force) {
    if (NH.state !== 'playing' && NH.state !== 'paused') return;
    var toPause = force !== undefined ? force : NH.state === 'playing';
    NH.state = toPause ? 'paused' : 'playing';
    document.getElementById('pause').style.display = toPause ? 'flex' : 'none';
    NH.audio.engine(false, 0);
  };

  MN.gameOver = function (kind) {
    if (NH.state !== 'playing') return;
    NH.state = 'over';
    NH.audio.engine(false, 0);
    NH.audio.siren(false);
    var go = document.getElementById('gameover');
    var title = document.getElementById('goTitle');
    var sub = document.getElementById('goSub');
    if (kind === 'busted') { title.textContent = 'BUSTED'; sub.textContent = 'The Harbor PD caught Dana. The crew will post bail… eventually.'; }
    else if (kind === 'wasted') { title.textContent = 'WASTED'; sub.textContent = 'Dana is down. The harbor keeps moving without her.'; }
    else if (kind === 'complete') {
      title.textContent = 'HARBOR ESCAPE — STORY COMPLETE';
      sub.textContent = 'Dana made it out with the crew. Neon Harbor is hers now. Final cash: $' + Math.floor(NH.player.cash);
      MN.clearSave();
    }
    go.style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  };

  MN.restart = function () {
    NH.player.health = 100; NH.player.armor = 0; NH.player.ammo = 24;
    NH.player.cash = Math.max(NH.CFG.startCash, Math.floor(NH.player.cash * 0.5));
    NH.police.clearStars();
    NH.missions.cleanup();
    NH.missions.state = 'idle';
    NH.player.group.position.set(0, 0, 120);
    NH.player.heading = 0;
    if (!NH.player.onFoot) NH.player.exitCar();
    document.getElementById('gameover').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    NH.state = 'playing';
    setTimeout(function () { if (NH.state === 'playing') NH.missions.start(NH.missions.current); }, 1200);
  };

  MN.hasSave = function () {
    try { return !!localStorage.getItem(NH.SAVE_KEY); } catch (e) { return false; }
  };

  MN.save = function () {
    try {
      localStorage.setItem(NH.SAVE_KEY, JSON.stringify({
        cash: Math.floor(NH.player.cash),
        mission: NH.missions.current,
        health: Math.ceil(NH.player.health),
        armor: Math.ceil(NH.player.armor)
      }));
    } catch (e) {}
  };

  MN.load = function () {
    try {
      var raw = localStorage.getItem(NH.SAVE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      NH.player.cash = s.cash || NH.CFG.startCash;
      NH.missions.current = s.mission || 0;
      NH.player.health = s.health || 100;
      NH.player.armor = s.armor || 0;
    } catch (e) {}
  };

  MN.clearSave = function () {
    try { localStorage.removeItem(NH.SAVE_KEY); } catch (e) {}
  };

  MN.loop = function () {
    var dt = Math.min(NH.clock.getDelta(), 0.05);
    if (NH.state === 'playing') {
      NH.time += dt;
      // rain falls around the camera
      if (NH.rain) {
        var pos = NH.rain.geometry.attributes.position;
        var cam = NH.camera.position;
        for (var i = 0; i < pos.count; i++) {
          var y = pos.getY(i) - dt * 42;
          if (y < 0) {
            y = 55;
            pos.setX(i, cam.x + NH.rand(-90, 90));
            pos.setZ(i, cam.z + NH.rand(-90, 90));
          }
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
      NH.player.update(dt);
      NH.traffic.update(dt);
      NH.police.update(dt);
      NH.missions.update(dt);
      NH.combat.update(dt);
      NH.hud.update(dt);
      // pause key
      if (NH.input.consumeKey('Escape') || NH.input.consumeKey('KeyP')) MN.togglePause(true);
      // start next mission
      if (NH.input.consumeKey('KeyM') && NH.missions.state === 'idle') NH.missions.start(NH.missions.current);
      // autosave every ~20s
      MN._saveT = (MN._saveT || 0) + dt;
      if (MN._saveT > 20) { MN._saveT = 0; MN.save(); }
      NH.shots.tick();
    } else if (NH.state === 'menu') {
      // slow cinematic orbit around downtown for the menu backdrop
      NH.time += dt;
      var a = NH.time * 0.05;
      NH.camera.position.set(Math.sin(a) * 120, 42, Math.cos(a) * 120);
      NH.camera.lookAt(0, 12, 0);
    }
    NH.input.endFrame();
    NH.renderer.render(NH.scene, NH.camera);
  };

  // Boot once the page is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MN.init);
  } else {
    MN.init();
  }
})();
