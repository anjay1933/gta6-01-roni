// NEON HARBOR — hud: DOM readouts (cash, health, armor, ammo, wanted stars,
// speed, objective, timer, message feed) + a canvas 2D minimap.
(function () {
  var NH = window.NH;

  var H = NH.hud = {
    el: {}, objective: null, objectiveTarget: null, timer: null, bannerTimer: null
  };

  H.init = function () {
    ['cash', 'healthBar', 'healthText', 'armorBar', 'armorText', 'ammo', 'stars',
     'speed', 'objective', 'timer', 'messages', 'banner', 'bannerTitle', 'bannerSub',
     'minimap', 'crosshair', 'damageFlash', 'hint'].forEach(function (id) {
      H.el[id] = document.getElementById(id);
    });
  };

  H.message = function (text) {
    var m = H.el.messages;
    if (!m) return;
    var div = document.createElement('div');
    div.textContent = text;
    m.prepend(div);
    while (m.children.length > 4) m.removeChild(m.lastChild);
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 5000);
  };

  H.banner = function (title, sub) {
    var b = H.el.banner;
    if (!b) return;
    H.el.bannerTitle.textContent = title;
    H.el.bannerSub.textContent = sub || '';
    b.classList.add('show');
    clearTimeout(H.bannerTimer);
    H.bannerTimer = setTimeout(function () { b.classList.remove('show'); }, 4000);
  };

  H.setObjective = function (text, target) {
    H.objective = text;
    H.objectiveTarget = target || null;
  };

  H.setTimer = function (seconds) { H.timer = seconds; };

  H.flashDamage = function () {
    var f = H.el.damageFlash;
    if (!f) return;
    f.classList.add('show');
    setTimeout(function () { f.classList.remove('show'); }, 250);
  };

  H.update = function (dt) {
    var p = NH.player;
    if (!H.el.cash) return;
    H.el.cash.textContent = '$' + Math.floor(p.cash);
    H.el.healthBar.style.width = Math.max(0, p.health) + '%';
    H.el.healthText.textContent = Math.ceil(p.health);
    H.el.armorBar.style.width = Math.max(0, p.armor) + '%';
    H.el.armorText.textContent = Math.ceil(p.armor);
    H.el.ammo.textContent = p.ammo;
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < NH.police.stars ? '★' : '☆';
    H.el.stars.textContent = stars;
    H.el.stars.className = NH.police.stars > 0 ? 'hot' : '';
    var speed = p.onFoot ? Math.round(p.speed * 3.6) : Math.round(Math.abs((p.car ? p.car.speed : 0)) * 3.6);
    H.el.speed.textContent = speed + ' km/h';
    H.el.objective.textContent = H.objective || 'Press M for the next mission';
    H.el.timer.textContent = H.timer !== null && H.timer !== undefined ? '⏱ ' + H.timer + 's' : '';
    // context hint
    var hint = '';
    if (p.onFoot) {
      var car = p.nearestCar();
      if (car) hint = '[E] Steal ' + car.def.name;
      else if (NH.missions.state === 'idle') hint = '[M] Start mission ' + (NH.missions.current + 1);
    } else {
      hint = '[E] Exit car — [Click] Drive-by';
    }
    H.el.hint.textContent = hint;
    // crosshair only when aiming, or holding fire for a drive-by
    H.el.crosshair.style.display = (NH.input.aim || (!p.onFoot && NH.input.leftDown)) ? 'block' : 'none';
    H.drawMinimap();
  };

  H.drawMinimap = function () {
    var cv = H.el.minimap;
    if (!cv) return;
    var g = cv.getContext('2d');
    var W = cv.width, Hh = cv.height;
    var S = W / 380; // world -190..190 maps to canvas
    function X(x) { return (x + 190) * S; }
    function Z(z) { return (z + 190) * S; }
    g.clearRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(8,10,18,0.85)';
    g.fillRect(0, 0, W, Hh);
    // water edges
    g.fillStyle = '#0a2a3a';
    g.fillRect(0, 0, W, 8); g.fillRect(0, Hh - 8, W, 8);
    // roads
    g.strokeStyle = '#3a3f4d'; g.lineWidth = 3;
    for (var s = -160; s <= 160; s += 40) {
      g.beginPath(); g.moveTo(X(-180), Z(s)); g.lineTo(X(180), Z(s)); g.stroke();
      g.beginPath(); g.moveTo(X(s), Z(-180)); g.lineTo(X(s), Z(180)); g.stroke();
    }
    // bridge
    g.strokeStyle = '#8a7a3a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(X(0), Z(-180)); g.lineTo(X(0), Z(-140)); g.stroke();
    // pay-n-spray + garage
    g.fillStyle = '#b04be8';
    g.fillRect(X(NH.city.paynspray.x) - 3, Z(NH.city.paynspray.z) - 3, 6, 6);
    g.fillStyle = '#39ff88';
    g.fillRect(X(NH.city.garage.x) - 3, Z(NH.city.garage.z) - 3, 6, 6);
    // mission marker
    if (H.objectiveTarget) {
      g.fillStyle = '#ffd21f';
      var mx = X(H.objectiveTarget.x), mz = Z(H.objectiveTarget.z);
      g.beginPath(); g.arc(mx, mz, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd21f'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, mz, 8 + Math.sin(NH.time * 4) * 2, 0, Math.PI * 2); g.stroke();
    }
    // traffic + peds (dots)
    g.fillStyle = 'rgba(255,255,255,0.7)';
    NH.traffic.cars.forEach(function (c) {
      g.fillRect(X(c.group.position.x) - 1, Z(c.group.position.z) - 1, 2, 2);
    });
    // police (red)
    g.fillStyle = '#ff2a2a';
    NH.police.cops.forEach(function (c) {
      g.beginPath(); g.arc(X(c.group.position.x), Z(c.group.position.z), 2.5, 0, Math.PI * 2); g.fill();
    });
    NH.police.cars.forEach(function (c) {
      g.beginPath(); g.arc(X(c.group.position.x), Z(c.group.position.z), 3, 0, Math.PI * 2); g.fill();
    });
    // player arrow (cyan, rotated by heading)
    var p = NH.player.group.position;
    var px = X(p.x), pz = Z(p.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.atan2(Math.sin(NH.player.heading), Math.cos(NH.player.heading)) * -1 + Math.PI);
    g.fillStyle = '#22e6ff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
    // north marker
    g.fillStyle = '#ffffff'; g.font = 'bold 10px Arial';
    g.fillText('N', W / 2 - 3, 10);
  };
})();
