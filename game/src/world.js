// FROSTLINE — the world: a snowy alpine resort town at dusk.
// Terrain, frozen lake, roads, buildings, pines, chairlift, lamps, aurora, snow.
import * as THREE from 'three';
import { CFG, ROADS, BUILDINGS, LAKE } from './config.js';
import { clamp, lerp, rand, mulberry32, distToSegment, makeSignTexture } from './util.js';

function sstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Ground height at (x, z). Town, roads and the lake are flattened out.
export function heightAt(x, z) {
  let h = 2.2 * Math.sin(x * 0.02) * Math.cos(z * 0.017)
    + 1.4 * Math.sin(x * 0.05 + 1.7) * Math.sin(z * 0.043);
  // The mountain climbs to the north.
  const mt = clamp((-150 - z) / 200, 0, 1);
  h += mt * mt * 58;
  // Flatten the town bowl.
  const town = 1 - sstep(120, 200, Math.hypot(x / 1.15, z));
  h = lerp(h, 0.5, town);
  // Flatten the frozen lake.
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz;
  const lake = 1 - sstep(0.85, 1.05, Math.hypot(lx, lz));
  h = lerp(h, 0.15, lake);
  // Flatten the roads.
  for (const r of ROADS) {
    const d = distToSegment(x, z, r.ax, r.az, r.bx, r.bz);
    const f = 1 - sstep(r.w / 2 + 1, r.w / 2 + 6, d);
    h = lerp(h, 0.4, f);
  }
  return h;
}

export function isOnRoad(x, z) {
  for (const r of ROADS) if (distToSegment(x, z, r.ax, r.az, r.bx, r.bz) < r.w / 2) return true;
  return false;
}
export function isOnIce(x, z) {
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz;
  return lx * lx + lz * lz < 1;
}
export function surfaceGrip(x, z) {
  if (isOnIce(x, z)) return 0.32;
  if (isOnRoad(x, z)) return 1.0;
  return 0.62; // snow
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3340'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3d4456'; g.fillRect(0, 0, 128, 10); g.fillRect(0, 118, 128, 10);
  g.fillStyle = '#c8cdd8';
  g.fillRect(60, 8, 8, 44); g.fillRect(60, 72, 8, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(G) {
  const scene = G.scene;
  const rng = mulberry32(1337);
  const colliders = []; // {x,z,hw,hd} boxes or {x,z,r} circles
  const lamps = [];

  // ---- dusk sky dome ----
  const skyGeo = new THREE.SphereGeometry(480, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(CFG.skyTop) }, mid: { value: new THREE.Color(CFG.skyHorizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; void main(){ float h = clamp(vP.y / 480.0, 0.0, 1.0); vec3 c = mix(mid, top, pow(h, 0.7)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x4a5a8a, 0x232a38, 0.75));
  const sun = new THREE.DirectionalLight(0xff9a6b, 1.1);
  sun.position.set(-140, 90, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(sun.target);

  // ---- snow terrain ----
  const terrGeo = new THREE.PlaneGeometry(CFG.worldSize, CFG.worldSize, 96, 96);
  terrGeo.rotateX(-Math.PI / 2);
  const pos = terrGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  terrGeo.computeVertexNormals();
  const terrMat = new THREE.MeshStandardMaterial({ color: CFG.snowColor, roughness: 0.95, metalness: 0 });
  const terrain = new THREE.Mesh(terrGeo, terrMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---- frozen lake ----
  const lakeGeo = new THREE.CircleGeometry(1, 48);
  lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.MeshStandardMaterial({ color: CFG.iceColor, roughness: 0.12, metalness: 0.25, emissive: 0x0a2432, emissiveIntensity: 0.5 });
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.scale.set(LAKE.rx, 1, LAKE.rz);
  lakeMesh.position.set(LAKE.x, 0.28, LAKE.z);
  lakeMesh.receiveShadow = true;
  scene.add(lakeMesh);

  // ---- roads ----
  const rTex = asphaltTexture();
  for (const r of ROADS) {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    const geo = new THREE.PlaneGeometry(len, r.w);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: rTex.clone(), roughness: 0.9 });
    mat.map.needsUpdate = true;
    mat.map.repeat.set(len / 14, 1);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((r.ax + r.bx) / 2, 0.42, (r.az + r.bz) / 2);
    m.rotation.y = -Math.atan2(r.bz - r.az, r.bx - r.ax);
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---- buildings ----
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x201408, emissive: 0xffb85c, emissiveIntensity: 1.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8eef7, roughness: 0.9 });
  for (const b of BUILDINGS) {
    const g = new THREE.Group();
    const y = heightAt(b.x, b.z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bodyMat);
    body.position.y = b.h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // Snow pyramid roof.
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.72, b.h * 0.5 + 1.6, 4), roofMat);
    roof.position.y = b.h + b.h * 0.25 + 0.8;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = b.d / Math.max(b.w, b.d);
    roof.castShadow = true;
    g.add(roof);
    // Warm windows across the front (south) face.
    const nWin = Math.max(2, Math.floor(b.w / 6));
    for (let i = 0; i < nWin; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), windowMat);
      win.position.set(-b.w / 2 + (i + 0.5) * (b.w / nWin), b.h * 0.55, b.d / 2 + 0.06);
      g.add(win);
    }
    if (b.sign) {
      const tex = makeSignTexture(b.sign, '#' + b.signColor.toString(16).padStart(6, '0'));
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(b.w * 0.8, 12), Math.min(b.w * 0.8, 12) / 4),
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      sign.position.set(0, b.h * 0.82, b.d / 2 + 0.1);
      g.add(sign);
    }
    g.position.set(b.x, y - 0.15, b.z);
    scene.add(g);
    colliders.push({ x: b.x, z: b.z, hw: b.w / 2 + 0.6, hd: b.d / 2 + 0.6 });
  }

  // ---- pine forest (instanced, kept out of town, roads and lake) ----
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 340 && guard++ < 6000) {
    const x = rand(-330, 330), z = rand(-330, 330);
    if (Math.abs(x) < 190 && Math.abs(z) < 160) continue; // keep the town clear
    if (isOnRoad(x, z)) continue;
    if (isOnIce(x, z)) continue;
    let near = false;
    for (const b of BUILDINGS) if (Math.abs(x - b.x) < b.w / 2 + 5 && Math.abs(z - b.z) < b.d / 2 + 5) { near = true; break; }
    if (near) continue;
    treeSpots.push([x, z, heightAt(x, z)]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: 1 });
  const coneGeo = new THREE.ConeGeometry(3.2, 9, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x1e3a24, roughness: 1 });
  const snowConeGeo = new THREE.ConeGeometry(2.2, 4.5, 8);
  const snowConeMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const snowCones = new THREE.InstancedMesh(snowConeGeo, snowConeMat, treeSpots.length);
  const dummy = new THREE.Object3D();
  treeSpots.forEach(([x, z, y], i) => {
    const s = rand(0.8, 1.7);
    dummy.position.set(x, y + 1.5 * s, z); dummy.scale.setScalar(s); dummy.rotation.y = rand(Math.PI * 2);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + (3 + 4.5) * s, z); dummy.updateMatrix(); cones.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + (3 + 8.2) * s, z); dummy.updateMatrix(); snowCones.setMatrixAt(i, dummy.matrix);
    colliders.push({ x, z, r: 0.9 });
  });
  trunks.castShadow = true; cones.castShadow = true;
  scene.add(trunks); scene.add(cones); scene.add(snowCones);

  // ---- chairlift: base tower up to the top tower, chairs gliding on the cable ----
  const liftBase = new THREE.Vector3(40, heightAt(40, -124) + 10, -124);
  const liftTop = new THREE.Vector3(40, heightAt(40, -280) + 12, -280);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6, metalness: 0.5 });
  for (const p of [liftBase, liftTop]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 12, 8), towerMat);
    pole.position.set(p.x, p.y - 6, p.z);
    pole.castShadow = true;
    scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.4), towerMat);
    arm.position.copy(p);
    scene.add(arm);
  }
  const cableDir = new THREE.Vector3().subVectors(liftTop, liftBase);
  const cableLen = cableDir.length();
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, cableLen, 4), new THREE.MeshBasicMaterial({ color: 0x11131a }));
  cable.position.copy(liftBase).addScaledVector(cableDir, 0.5);
  cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cableDir.clone().normalize());
  scene.add(cable);
  const chairs = [];
  const chairGeo = new THREE.BoxGeometry(1.6, 1.2, 1.4);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xc25a1e, roughness: 0.7 });
  for (let i = 0; i < 6; i++) {
    const ch = new THREE.Mesh(chairGeo, chairMat);
    ch.castShadow = true;
    scene.add(ch);
    chairs.push({ mesh: ch, t: i / 6 });
  }

  // ---- street lamps along Main Street ----
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.6 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let x = -150; x <= 150; x += 30) {
    for (const z of [-8, 8]) {
      const y = heightAt(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6), lampPoleMat);
      pole.position.set(x, y + 2.75, z);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampGlowMat);
      bulb.position.set(x, y + 5.6, z);
      scene.add(bulb);
      lamps.push([x, y + 5.6, z]);
    }
  }
  // A few real warm point lights where it matters.
  for (const [x, z, c] of [[70, -58, 0xffb85c], [-40, -8, 0xffb85c], [-100, -8, 0x7fd4ff]]) {
    const pl = new THREE.PointLight(c, 60, 45, 1.8);
    pl.position.set(x, heightAt(x, z) + 6, z);
    scene.add(pl);
  }

  // ---- aurora ribbons (additive shader planes) ----
  const auroraUniforms = { uTime: { value: 0 } };
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: auroraUniforms,
    vertexShader: `varying vec2 vUv; uniform float uTime;
      void main(){ vUv = uv; vec3 p = position;
        p.z += sin(uv.x * 9.0 + uTime * 0.25) * 7.0;
        p.y += sin(uv.x * 5.0 + uTime * 0.18) * 4.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float band = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float flow = 0.5 + 0.5 * sin(vUv.x * 14.0 - uTime * 0.6 + sin(vUv.y * 8.0) * 2.0);
        vec3 green = vec3(0.15, 0.9, 0.55);
        vec3 violet = vec3(0.45, 0.3, 1.0);
        vec3 c = mix(green, violet, vUv.y * 0.8 + flow * 0.25);
        gl_FragColor = vec4(c, band * (0.35 + 0.4 * flow)); }`,
  });
  const aurora = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(340, 46, 48, 1), auroraMat);
    rib.position.set(-60 + i * 70, 150 + i * 26, -260 - i * 30);
    rib.rotation.x = -0.35; rib.rotation.y = 0.25 * i;
    aurora.add(rib);
  }
  scene.add(aurora);

  // ---- stars and moon ----
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = rand(Math.PI * 2), e = rand(0.15, 1.4), r = 460;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0xf2ead0, fog: false }));
  moon.position.set(-230, 190, -300);
  moon.lookAt(0, 0, 0);
  scene.add(moon);

  // ---- snowfall (wraps around the camera) ----
  const SNOW_N = 1400;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_N * 3);
  const snowVel = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) {
    snowPos[i * 3] = rand(-70, 70); snowPos[i * 3 + 1] = rand(0, 60); snowPos[i * 3 + 2] = rand(-70, 70);
    snowVel[i] = rand(3, 7);
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85 }));
  scene.add(snow);

  // Distant peaks ring the map.
  const peakMat = new THREE.MeshStandardMaterial({ color: 0x8a9cc0, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand(0.2);
    const px = Math.cos(a) * 400, pz = Math.sin(a) * 400;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rand(60, 110), rand(90, 170), 5), peakMat);
    peak.position.set(px, 20, pz);
    scene.add(peak);
  }

  G.world = {
    colliders, lamps, chairs, liftBase, liftTop, auroraUniforms, snow, snowPos, snowVel,
    update(dt, t, camPos, blizzard) {
      // Chairs glide up the cable and loop back to the base.
      for (const c of chairs) {
        c.t = (c.t + dt * 0.012) % 1;
        const p = new THREE.Vector3().copy(liftBase).addScaledVector(cableDir, c.t);
        c.mesh.position.set(p.x, p.y - 1.6, p.z);
      }
      auroraUniforms.uTime.value = t;
      // Snow falls around the camera; a blizzard doubles the fall speed.
      const speed = blizzard ? 2.1 : 1;
      for (let i = 0; i < SNOW_N; i++) {
        snowPos[i * 3 + 1] -= snowVel[i] * speed * dt;
        snowPos[i * 3] += Math.sin(t * 0.7 + i) * dt * 1.5 + dt * 2.0;
        if (snowPos[i * 3 + 1] < 0) snowPos[i * 3 + 1] = 60;
        if (snowPos[i * 3] - camPos.x > 70) snowPos[i * 3] -= 140;
        if (snowPos[i * 3] - camPos.x < -70) snowPos[i * 3] += 140;
        if (snowPos[i * 3 + 2] - camPos.z > 70) snowPos[i * 3 + 2] -= 140;
        if (snowPos[i * 3 + 2] - camPos.z < -70) snowPos[i * 3 + 2] += 140;
        snowPos[i * 3] = clamp(snowPos[i * 3], camPos.x - 70, camPos.x + 70);
        snowPos[i * 3 + 2] = clamp(snowPos[i * 3 + 2], camPos.z - 70, camPos.z + 70);
      }
      snowGeo.attributes.position.needsUpdate = true;
    },
  };

  return G.world;
}

// Push a point (with radius r) out of every collider it overlaps.
// Returns the corrected [x, z].
export function collide(x, z, r, colliders) {
  for (const c of colliders) {
    if (c.r !== undefined) {
      const dx = x - c.x, dz = z - c.z;
      const d2 = dx * dx + dz * dz;
      const rr = r + c.r;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr;
      }
    } else {
      const nx = clamp(x, c.x - c.hw, c.x + c.hw);
      const nz = clamp(z, c.z - c.hd, c.z + c.hd);
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; z = nz + (dz / d) * r; }
        else { x = c.x + (c.hw + r) * (x >= c.x ? 1 : -1); }
      }
    }
  }
  return [x, z];
}
