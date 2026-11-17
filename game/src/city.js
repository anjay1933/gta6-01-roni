// NEON HARBOR — city: procedural night port city. Docks, downtown neon towers,
// beach road, north bridge causeway, rain, fog, stars. All textures are
// generated on canvas at runtime — no image files, no network.
(function () {
  var NH = window.NH;
  var THREE = window.THREE;

  var city = NH.city = {
    colliders: [],        // {x0,z0,x1,z1} building footprints
    lamps: [],            // lamp head positions (for the minimap + glow)
    garage: { x: -20, z: 140 },     // crew garage / save point
    paynspray: { x: 100, z: -100 },// respray garage
    pier: { x: -165, z: 150 },      // speedboat pier (final mission)
    safehouse: { x: 60, z: 120 },
    plaza: { x: 40, z: 40 }
  };

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    return t;
  }

  function windowTexture(lit, tint) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = '#0a0d16'; g.fillRect(0, 0, w, h);
      for (var y = 8; y < h - 8; y += 16) {
        for (var x = 8; x < w - 8; x += 14) {
          if (NH.rng() < lit) {
            g.fillStyle = NH.randPick(['#ffd97a', '#9be8ff', '#ff9ecf', '#c8ff9e']);
            g.globalAlpha = 0.55 + NH.rng() * 0.45;
          } else {
            g.fillStyle = '#131a26'; g.globalAlpha = 1;
          }
          g.fillRect(x, y, 9, 11);
        }
      }
      g.globalAlpha = 1;
    });
  }

  function signTexture(text, color, sub) {
    return canvasTex(512, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.font = 'bold 64px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 28;
      g.fillStyle = color;
      g.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
      g.shadowBlur = 8;
      g.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
      if (sub) {
        g.font = 'bold 28px Arial, sans-serif';
        g.fillStyle = '#ffffff';
        g.fillText(sub, w / 2, h - 22);
      }
    });
  }

  var winTexes = [];
  var signMats = {};

  function building(x, z, w, d, hgt, texIdx) {
    var tex = winTexes[texIdx % winTexes.length];
    var mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
    m.position.set(x, hgt / 2, z);
    NH.scene.add(m);
    city.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // flat dark roof cap
    var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4),
      new THREE.MeshLambertMaterial({ color: 0x11131c }));
    roof.position.set(x, hgt + 0.3, z);
    NH.scene.add(roof);
    return m;
  }

  function neonSign(text, color, x, y, z, rotY, w, sub) {
    var key = text + color;
    if (!signMats[key]) {
      signMats[key] = new THREE.MeshBasicMaterial({ map: signTexture(text, color, sub), transparent: true });
    }
    var s = new THREE.Mesh(new THREE.PlaneGeometry(w || 18, (w || 18) / 4), signMats[key]);
    s.position.set(x, y, z); s.rotation.y = rotY;
    NH.scene.add(s);
    return s;
  }

  function crane(x, z, hgt) {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: 0xd86a1e });
    var leg1 = new THREE.Mesh(new THREE.BoxGeometry(2, hgt, 2), mat);
    leg1.position.set(-4, hgt / 2, 0);
    var leg2 = leg1.clone(); leg2.position.x = 4;
    var top = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 2.4), mat);
    top.position.set(0, hgt, 0);
    var jib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 1.4), mat);
    jib.position.set(8, hgt + 1, 0);
    var cable = new THREE.Mesh(new THREE.BoxGeometry(0.3, 14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x888888 }));
    cable.position.set(18, hgt - 6, 0);
    var hook = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    hook.position.set(18, hgt - 13, 0);
    g.add(leg1); g.add(leg2); g.add(top); g.add(jib); g.add(cable); g.add(hook);
    g.position.set(x, 0, z);
    g.rotation.y = NH.rand(0, Math.PI);
    NH.scene.add(g);
    city.colliders.push({ x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6 });
  }

  function containerStack(x, z) {
    var colors = [0xc23b2e, 0x2e6bc2, 0x2ea36b, 0xd8a41e, 0x7a3ec2];
    var rows = NH.randInt(1, 3);
    for (var i = 0; i < rows; i++) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6),
        new THREE.MeshLambertMaterial({ color: NH.randPick(colors) }));
      c.position.set(x, 1.3 + i * 2.7, z + (i % 2) * 0.4);
      c.rotation.y = (NH.rng() < 0.5 ? 0 : Math.PI / 2) + NH.rand(-0.05, 0.05);
      NH.scene.add(c);
    }
    city.colliders.push({ x0: x - 6.5, z0: z - 6.5, x1: x + 6.5, z1: z + 6.5 });
  }

  city.build = function () {
    var S = NH.scene;
    winTexes = [windowTexture(0.45), windowTexture(0.3), windowTexture(0.6), windowTexture(0.2)];

    // Ground + water + sand
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520),
      new THREE.MeshLambertMaterial({ color: 0x14161f }));
    ground.rotation.x = -Math.PI / 2; S.add(ground);
    var waterMat = new THREE.MeshLambertMaterial({ color: 0x0a2a3a, emissive: 0x06121f });
    var waterN = new THREE.Mesh(new THREE.PlaneGeometry(520, 60), waterMat);
    waterN.rotation.x = -Math.PI / 2; waterN.position.set(0, -0.4, -195); S.add(waterN);
    var waterS = waterN.clone(); waterS.position.set(0, -0.4, 185); S.add(waterS);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(360, 26),
      new THREE.MeshLambertMaterial({ color: 0x8a7a55 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 163); S.add(sand);

    // Roads: grid every 40 units; sidewalks as lighter strips under them.
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x1c1e26 });
    var walkMat = new THREE.MeshLambertMaterial({ color: 0x2a2d38 });
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xcfd2da });
    var streets = [];
    for (var s = -160; s <= 160; s += 40) streets.push(s);
    streets.forEach(function (c) {
      var walkH = new THREE.Mesh(new THREE.PlaneGeometry(360, NH.CFG.roadW + 6), walkMat);
      walkH.rotation.x = -Math.PI / 2; walkH.position.set(0, 0.01, c); S.add(walkH);
      var roadH = new THREE.Mesh(new THREE.PlaneGeometry(360, NH.CFG.roadW), roadMat);
      roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.03, c); S.add(roadH);
      var walkV = new THREE.Mesh(new THREE.PlaneGeometry(NH.CFG.roadW + 6, 360), walkMat);
      walkV.rotation.x = -Math.PI / 2; walkV.position.set(c, 0.01, 0); S.add(walkV);
      var roadV = new THREE.Mesh(new THREE.PlaneGeometry(NH.CFG.roadW, 360), roadMat);
      roadV.rotation.x = -Math.PI / 2; roadV.position.set(c, 0.03, 0); S.add(roadV);
      for (var d = -170; d <= 170; d += 12) {
        var dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.4), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.05, c); S.add(dash);
        var dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), dashMat);
        dash2.rotation.x = -Math.PI / 2; dash2.position.set(c, 0.05, d); S.add(dash2);
      }
    });

    // Buildings per block.
    for (var bx = -140; bx <= 140; bx += 40) {
      for (var bz = -140; bz <= 140; bz += 40) {
        var downtown = bx >= -100 && bx <= 100 && bz <= 100;
        var docks = bx < -100;
        if (docks) {
          // warehouses + container stacks
          if (NH.rng() < 0.75) {
            building(bx + NH.rand(-4, 4), bz + NH.rand(-4, 4), NH.rand(16, 22), NH.rand(12, 18), NH.rand(6, 10), 3);
          }
          if (NH.rng() < 0.8) containerStack(bx + NH.rand(-8, 8), bz + NH.rand(-8, 8));
          continue;
        }
        if (bz > 100) { // beach road: low motels
          if (NH.rng() < 0.6) building(bx, bz, NH.rand(14, 20), NH.rand(10, 14), NH.rand(5, 9), 1);
          continue;
        }
        var n = downtown ? NH.randInt(1, 2) : 1;
        for (var k = 0; k < n; k++) {
          var w = NH.rand(12, 20), d = NH.rand(12, 20);
          var hgt = downtown ? NH.rand(22, 58) : NH.rand(8, 18);
          var ox = n > 1 ? (k === 0 ? -8 : 8) : 0;
          building(bx + ox, bz, w, d, hgt, NH.randInt(0, 3));
        }
      }
    }

    // Neon signs downtown + docks.
    neonSign('NEON HARBOR', '#ff2e88', 0, 34, -39.5, 0, 26, 'PIER 9 • DOCKS');
    neonSign('HOTEL LUMEN', '#22e6ff', -60, 26, 0.5, Math.PI / 2, 20);
    neonSign('CRANE CO', '#ffb020', -140, 14, -79.5, 0, 18);
    neonSign('PIER 9', '#39ff88', -160, 10, 60.5, Math.PI / 2, 14);
    neonSign('BAR ANCHOR', '#ff5e3a', 60, 12, 39.5, Math.PI, 16);
    neonSign('CASINO TIDE', '#c26bff', 100, 40, -0.5, -Math.PI / 2, 22, 'OPEN 24H');
    neonSign('GARAGE', '#39ff88', city.garage.x, 8, city.garage.z - 12, 0, 14, 'HARBOR CREW');

    // Cranes at the docks.
    crane(-150, -80, 34); crane(-130, 20, 30); crane(-160, 120, 26);

    // North bridge causeway over the channel (x -14..14, z -180..-140).
    var deck = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 46),
      new THREE.MeshLambertMaterial({ color: 0x23262f }));
    deck.position.set(0, 0.4, -160); S.add(deck);
    var railMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    [-14.5, 14.5].forEach(function (x) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 46), railMat);
      rail.position.set(x, 1.6, -160); S.add(rail);
    });
    for (var pz = -178; pz <= -142; pz += 12) {
      var pil = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2),
        new THREE.MeshLambertMaterial({ color: 0x2a2d38 }));
      pil.position.set(-10, -2, pz); S.add(pil);
      var pil2 = pil.clone(); pil2.position.x = 10; S.add(pil2);
    }

    // Garage (crew HQ): open-front box + pay-n-spray booth.
    var gar = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 14),
      new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
    gar.position.set(city.garage.x, 4.5, city.garage.z); S.add(gar);
    city.colliders.push({ x0: city.garage.x - 11, z0: city.garage.z - 7, x1: city.garage.x + 11, z1: city.garage.z + 7 });
    var spray = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10),
      new THREE.MeshLambertMaterial({ color: 0x8a2be2, emissive: 0x4a008a }));
    spray.position.set(city.paynspray.x, 3, city.paynspray.z); S.add(spray);
    city.colliders.push({ x0: city.paynspray.x - 6, z0: city.paynspray.z - 5, x1: city.paynspray.x + 6, z1: city.paynspray.z + 5 });
    // Speedboat at the pier.
    var boat = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 9),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    hull.position.y = 0.6;
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 3),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cabin.position.set(0, 1.6, 1);
    boat.add(hull); boat.add(cabin);
    boat.position.set(city.pier.x, 0, city.pier.z + 8);
    boat.rotation.y = 0.4;
    S.add(boat);

    // Street lamps (poles + glowing heads) along main streets.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x22242c });
    var headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (var lx = -160; lx <= 160; lx += 80) {
      for (var lz = -120; lz <= 120; lz += 80) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), poleMat);
        pole.position.set(lx + 6, 3.5, lz + 6); S.add(pole);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), headMat);
        head.position.set(lx + 6, 7.2, lz + 6); S.add(head);
        city.lamps.push({ x: lx + 6, z: lz + 6 });
      }
    }

    // Rain points + stars + moon.
    var rainGeo = new THREE.BufferGeometry();
    var rainPos = new Float32Array(1500 * 3);
    for (var i = 0; i < 1500; i++) {
      rainPos[i * 3] = NH.rand(-100, 100);
      rainPos[i * 3 + 1] = NH.rand(0, 60);
      rainPos[i * 3 + 2] = NH.rand(-100, 100);
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    NH.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0x9db8d8, size: 0.18, transparent: true, opacity: 0.6 }));
    S.add(NH.rain);
    var starGeo = new THREE.BufferGeometry();
    var starPos = new Float32Array(400 * 3);
    for (var j = 0; j < 400; j++) {
      var a = NH.rand(0, Math.PI * 2), e = NH.rand(0.15, 1.4), r = 380;
      starPos[j * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[j * 3 + 1] = Math.sin(e) * r;
      starPos[j * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    S.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })));
    var moon = new THREE.Mesh(new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xf2ead0, fog: false }));
    moon.position.set(-140, 120, -300); moon.lookAt(0, 0, 0); S.add(moon);
  };

  // Push a circle out of building AABBs. Returns true if it hit something.
  city.collide = function (pos, radius) {
    var hit = false;
    for (var i = 0; i < city.colliders.length; i++) {
      var c = city.colliders[i];
      var cx = NH.clamp(pos.x, c.x0, c.x1), cz = NH.clamp(pos.z, c.z0, c.z1);
      var dx = pos.x - cx, dz = pos.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          pos.x = c.x1 + radius;
        }
      }
    }
    return hit;
  };

  // Ground height: the bridge causeway deck, else street level.
  city.groundHeight = function (x, z) {
    if (x > -14 && x < 14 && z > -183 && z < -137) return 0.9;
    return 0;
  };

  // Nearest point on a street grid line (for traffic + ped paths).
  city.nearestStreet = function (x, z) {
    function snap(v) { return Math.round(v / 40) * 40; }
    return { x: snap(x), z: snap(z) };
  };
})();
