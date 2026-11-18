// DUSTLINE world: the whole town of Copper Flats, built procedurally from boxes,
// cylinders and canvas-painted signs — no models, no textures from disk, no network.
// Golden-hour sun, long shadows, dust haze, a highway, a downtown grid, a canyon
// bridge, a quarry and mesas on the rim. Deterministic: same seed, same town.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeRng, clamp } from './util.js';

const SAND = 0xc98d54;
const SAND_DARK = 0xa96f3e;
const ASPHALT = 0x2e2a28;
const SIDEWALK = 0x8a7a68;
const ROOF = 0x5a3a28;

/** Paint a glowing shop sign on a canvas — runtime texture, nothing fetched. */
export function makeSignTexture(text, sub, bg, fg, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = accent;
  g.lineWidth = 10;
  g.strokeRect(8, 8, 496, 176);
  g.fillStyle = fg;
  g.font = 'bold 84px "Trebuchet MS", Verdana, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = accent;
  g.shadowBlur = 22;
  g.fillText(text, 256, sub ? 82 : 96);
  if (sub) {
    g.font = 'bold 34px "Trebuchet MS", Verdana, sans-serif';
    g.shadowBlur = 8;
    g.fillText(sub, 256, 152);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boxMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.04, ...opts });
}

export class Town {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(7);
    this.colliders = [];
    this.roads = [];
    this.pickupSpots = [];
    this.dust = null;
    this.signs = [];
    this.crates = [];
    this.garagePos = { x: WORLD.garage.x, z: WORLD.garage.z };
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  addCollider(x0, z0, x1, z1) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  /** True when point (x,z) is inside any solid collider. */
  solidAt(x, z) {
    for (const c of this.colliders) {
      if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
    }
    return false;
  }

  /** Push a circle (x,z,r) out of colliders; returns corrected {x,z}. */
  resolveCircle(x, z, r) {
    for (const c of this.colliders) {
      const cx = clamp(x, c.x0, c.x1);
      const cz = clamp(z, c.z0, c.z1);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // centre inside the box: shove out along the smallest penetration
          const pl = x - c.x0 + r, pr = c.x1 - x + r, pt = z - c.z0 + r, pb = c.z1 - z + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    return { x, z };
  }

  box(w, h, d, color, x, y, z, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  cyl(rt, rb, h, color, x, y, z, seg = 12, opts = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), boxMat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  build() {
    this.buildSky();
    this.buildGround();
    this.buildHighway();
    this.buildDowntown();
    this.buildGasStation();
    this.buildMotelDiner();
    this.buildWaterTower();
    this.buildBridge();
    this.buildQuarry();
    this.buildMesas();
    this.buildProps();
    this.buildDust();
    this.buildPickupSpots();
    this.buildRoads();
    return this;
  }

  buildSky() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(WORLD.fogColor, 180, 820);
    // Gradient dome: warm horizon, dusty blue-violet up top.
    const geo = new THREE.SphereGeometry(760, 24, 12);
    const top = new THREE.Color(0x7a6a9a);
    const mid = new THREE.Color(0xe8a05c);
    const bot = new THREE.Color(0xcf7a3a);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 760;
      const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(bot, 1 - (y + 1) / 1.25);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    this.group.add(sky);

    // Low golden sun disc.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe6a8, fog: false }),
    );
    sun.position.set(-520, 120, -320);
    sun.lookAt(0, 40, 0);
    this.group.add(sun);

    const hemi = new THREE.HemisphereLight(WORLD.hemiSky, WORLD.hemiGround, 0.85);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(WORLD.sunColor, WORLD.sunIntensity);
    dir.position.set(-260, 150, -140);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -260; dir.shadow.camera.right = 260;
    dir.shadow.camera.top = 260; dir.shadow.camera.bottom = -260;
    dir.shadow.camera.far = 900;
    dir.shadow.bias = -0.0006;
    scene.add(dir);
    this.sunLight = dir;
  }

  buildGround() {
    const rng = this.rng;
    // West landmass (town side) and east landmass (past the canyon).
    const west = new THREE.Mesh(new THREE.PlaneGeometry(760, WORLD.size), boxMat(SAND));
    west.rotation.x = -Math.PI / 2;
    west.position.set(-70, 0, 0);
    west.receiveShadow = true;
    this.group.add(west);
    const east = new THREE.Mesh(new THREE.PlaneGeometry(120, WORLD.size), boxMat(0xbd8250));
    east.rotation.x = -Math.PI / 2;
    east.position.set(390, 0, 0);
    east.receiveShadow = true;
    this.group.add(east);
    // Canyon walls below the gap.
    this.box(62, 26, WORLD.size, 0x8a4f2c, 330, -13, 0);
    // Desert patches: darker sand discs for texture.
    for (let i = 0; i < 46; i++) {
      const x = -440 + rng() * 880;
      const z = -430 + rng() * 860;
      if (Math.abs(z) < 12 && x > -450 && x < 300) continue; // keep the highway clean
      const r = 8 + rng() * 26;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 18), boxMat(rng() < 0.5 ? SAND_DARK : 0xd69a5e));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.04, z);
      disc.receiveShadow = true;
      this.group.add(disc);
    }
  }

  roadStrip(x0, z0, x1, z1, width) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), boxMat(ASPHALT));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
    m.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
    m.receiveShadow = true;
    this.group.add(m);
    // Centre dashes.
    const steps = Math.floor(len / 9);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.35), boxMat(0xd8cdb0, { roughness: 0.6 }));
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      dash.position.set(x, 0.09, z);
      this.group.add(dash);
    }
  }

  buildHighway() {
    // Main east-west highway, west of the canyon, plus the east stub.
    this.roadStrip(-450, 0, 300, 0, WORLD.highwayHalfWidth * 2);
    this.roadStrip(360, 0, 450, 0, WORLD.highwayHalfWidth * 2);
    // Downtown cross streets.
    for (const z of [-70, -130, -190]) this.roadStrip(-170, z, 170, z, 9);
    for (const x of [-120, -40, 40, 120]) this.roadStrip(x, -200, x, -40, 9);
    // Sidewalk ribbons along the highway.
    for (const z of [-10.5, 10.5]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(750, 3.4), boxMat(SIDEWALK));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(-75, 0.05, z);
      walk.receiveShadow = true;
      this.group.add(walk);
    }
  }

  /** A plain low-rise block with a flat roof, door and lit windows. */
  block(x, z, w, d, h, color) {
    this.box(w, h, d, color, x, h / 2, z);
    this.box(w + 0.6, 0.5, d + 0.6, ROOF, x, h + 0.2, z);
    // Roof clutter.
    this.box(1.6, 1.0, 1.6, 0x6a6a6a, x - w / 4, h + 0.9, z);
    // Door facing the street.
    this.box(2.2, 3.2, 0.3, 0x2a1c12, x, 1.6, z + d / 2 + 0.1);
    // Lit windows on the street face.
    const rng = this.rng;
    const n = Math.max(2, Math.floor(w / 6));
    for (let i = 0; i < n; i++) {
      const wx = x - w / 2 + 3 + (i * (w - 6)) / Math.max(1, n - 1);
      const lit = rng() < 0.65;
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.4),
        new THREE.MeshStandardMaterial({
          color: lit ? 0xffc46a : 0x2c2620,
          emissive: lit ? 0xff9a2a : 0x000000,
          emissiveIntensity: lit ? 1.4 : 0,
          roughness: 0.4,
        }),
      );
      win.position.set(wx, Math.min(h - 2.4, 4.4), z + d / 2 + 0.12);
      this.group.add(win);
      if (h > 8) {
        const win2 = win.clone();
        win2.position.y = 8.2;
        this.group.add(win2);
      }
    }
    this.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  }

  buildDowntown() {
    const rng = this.rng;
    const palette = [0x9a5a3a, 0x7a4a34, 0xa8703f, 0x8a5f45, 0x6e4a3a, 0xb07a4a];
    const blocks = [
      [-160, -100, 26, 22], [-95, -100, 22, 22], [-15, -100, 30, 22], [65, -100, 24, 22], [140, -100, 26, 22],
      [-160, -160, 24, 22], [-95, -160, 28, 22], [-15, -160, 22, 22], [65, -160, 30, 22], [140, -160, 24, 22],
      [-120, -215, 30, 18], [-40, -215, 26, 18], [40, -215, 30, 18], [120, -215, 26, 18],
    ];
    for (const [x, z, w, d] of blocks) {
      const h = 6 + rng() * 9;
      this.block(x, z, w, d, h, palette[Math.floor(rng() * palette.length)]);
    }
    // Main-street storefront signs.
    const signDefs = [
      ['VIC\u2019S', 'PAWN & GUNS', -40, -88, 0xffd76a],
      ['TACOS', 'EL CAMINO', 40, -88, 0x7dff8a],
      ['BAR', 'THE RUSTY SPUR', 120, -88, 0xff7a5c],
      ['MOTEL', 'VACANCY', -120, -88, 0x6ac8ff],
    ];
    for (const [text, sub, x, z, accent] of signDefs) {
      const tex = makeSignTexture(text, sub, '#1c0f08', '#ffe9c4', '#' + accent.toString(16).padStart(6, '0'));
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 3.8),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }),
      );
      sign.position.set(x, 7.5, z);
      this.group.add(sign);
      this.signs.push(sign);
    }
  }

  buildGasStation() {
    const { x, z } = WORLD.gasStation;
    // Canopy on four pillars.
    this.box(26, 1.2, 16, 0xd84a2e, x, 6.4, z);
    for (const [px, pz] of [[-11, -6], [11, -6], [-11, 6], [11, 6]]) {
      this.cyl(0.35, 0.35, 6, 0xcccccc, x + px, 3, z + pz, 8);
    }
    // Pumps.
    for (let i = -1; i <= 1; i++) {
      this.box(1.2, 2.4, 0.9, 0xe8e0d0, x + i * 6, 1.2, z);
      this.box(0.9, 0.7, 0.2, 0x222222, x + i * 6, 1.9, z + 0.5);
    }
    // Kiosk.
    this.box(8, 4.5, 6, 0xc8b890, x + 16, 2.25, z + 8);
    this.addCollider(x - 13, z - 8, x + 13, z + 8);
    this.addCollider(x + 12, z + 5, x + 20, z + 11);
    // Tall GAS sign.
    const tex = makeSignTexture('GAS', '24 HOUR', '#201008', '#ffe9c4', '#ff5a3c');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 4.2),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0 }),
    );
    sign.position.set(x - 16, 9, z - 10);
    sign.rotation.y = Math.PI / 4;
    this.group.add(sign);
    this.signs.push(sign);
  }

  buildMotelDiner() {
    // Motel: long two-storey block north of the highway.
    const mx = WORLD.motel.x, mz = WORLD.motel.z;
    this.box(34, 9, 10, 0x7a6a8a, mx, 4.5, mz);
    this.box(34.6, 0.5, 10.6, ROOF, mx, 9.2, mz);
    for (let i = 0; i < 6; i++) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x3a2c1e, emissive: 0xff9a2a, emissiveIntensity: 0.7 }),
      );
      door.position.set(mx - 14 + i * 5.6, 1.5, mz + 5.05);
      this.group.add(door);
    }
    this.addCollider(mx - 17, mz - 5, mx + 17, mz + 5);
    const mtex = makeSignTexture('MOTEL', 'COPPER FLATS', '#1c0f08', '#ffe9c4', '#6ac8ff');
    const msign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.5),
      new THREE.MeshStandardMaterial({ map: mtex, emissive: 0xffffff, emissiveMap: mtex, emissiveIntensity: 1.0 }),
    );
    msign.position.set(mx, 12.5, mz);
    this.group.add(msign);
    this.signs.push(msign);

    // Diner: small building + neon sign, south side.
    const dx = WORLD.diner.x, dz = WORLD.diner.z;
    this.box(14, 5, 10, 0xb08a5a, dx, 2.5, dz);
    this.box(14.6, 0.5, 10.6, 0x8a2a2a, dx, 5.2, dz);
    this.box(2.4, 3.4, 0.3, 0x2a1c12, dx, 1.7, dz - 5.1);
    this.addCollider(dx - 7, dz - 5, dx + 7, dz + 5);
    const dtex = makeSignTexture('DINER', 'DUSTY\u2019S', '#201008', '#ffe9c4', '#ffd76a');
    const dsign = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 4.2),
      new THREE.MeshStandardMaterial({ map: dtex, emissive: 0xffffff, emissiveMap: dtex, emissiveIntensity: 1.0 }),
    );
    dsign.position.set(dx, 8.2, dz);
    this.group.add(dsign);
    this.signs.push(dsign);

    // Respray garage: open-front shed east of downtown.
    const gx = WORLD.garage.x, gz = WORLD.garage.z;
    this.box(16, 6, 12, 0x4a5a6a, gx, 3, gz);
    this.box(16.6, 0.5, 12.6, ROOF, gx, 6.2, gz);
    const gtex = makeSignTexture('SPRAY', 'RESPRAY $150', '#101820', '#ffe9c4', '#4fa8ff');
    const gsign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 3.8),
      new THREE.MeshStandardMaterial({ map: gtex, emissive: 0xffffff, emissiveMap: gtex, emissiveIntensity: 0.9 }),
    );
    gsign.position.set(gx, 8.5, gz + 6.1);
    this.group.add(gsign);
    this.signs.push(gsign);
    this.addCollider(gx - 8, gz - 6, gx - 2, gz + 6);
    this.addCollider(gx + 2, gz - 6, gx + 8, gz + 6);
  }

  buildWaterTower() {
    const { x, z } = WORLD.waterTower;
    for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 14, 8), boxMat(0x5a4a3a));
      leg.position.set(x + lx, 7, z + lz);
      leg.castShadow = true;
      this.group.add(leg);
    }
    const tank = this.cyl(5.5, 5.5, 7, 0x9a8a7a, x, 17, z, 16);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), boxMat(0x7a6a5a));
    cap.position.set(x, 20.5, z);
    cap.castShadow = true;
    this.group.add(cap);
    this.addCollider(x - 5, z - 5, x + 5, z + 5);
    return tank;
  }

  buildBridge() {
    // Deck spanning the canyon gap x = 300..360, with rails and pillars.
    const deck = this.box(62, 1.4, 16, 0x6a6258, 330, 1.2, 0);
    deck.receiveShadow = true;
    for (const z of [-7.6, 7.6]) this.box(62, 1.1, 0.5, 0xc22e2e, 330, 2.4, z);
    for (const x of [312, 330, 348]) {
      this.box(3, 26, 3, 0x5a5048, x, -12, -6);
      this.box(3, 26, 3, 0x5a5048, x, -12, 6);
    }
    // Canyon floor far below.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(62, WORLD.size), boxMat(0x6e3a20));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(330, -26, 0);
    this.group.add(floor);
    // Centre dashes on the deck.
    for (let i = 0; i < 6; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.35), boxMat(0xd8cdb0));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(306 + i * 9.6, 1.95, 0);
      this.group.add(dash);
    }
  }

  buildQuarry() {
    const { x, z } = WORLD.quarry;
    const rng = this.rng;
    // A walled quarry yard: three concentric retaining walls stepping inward,
    // each with a gap facing north (toward town) so the player can walk in.
    // The dark floor disc reads as dug earth; the crates sit on it in plain sight.
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(34 - i * 9, 38 - i * 9, 2.2, 24, 1, true, Math.PI + 0.55, Math.PI * 2 - 1.1),
        boxMat(i === 0 ? 0x8a6a4a : 0x7a5a3e, { side: THREE.DoubleSide }),
      );
      ring.position.set(x, 1.1, z);
      ring.receiveShadow = true;
      this.group.add(ring);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(34, 24), boxMat(0x5a4028));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.08, z);
    floor.receiveShadow = true;
    this.group.add(floor);
    // Crates (the heist targets) and rubble, all above ground and visible.
    for (let i = 0; i < 8; i++) {
      const cx = x - 10 + rng() * 20;
      const cz = z - 10 + rng() * 20;
      const crate = this.box(2.2, 2.2, 2.2, 0x9a7a3a, cx, 1.1, cz);
      crate.rotation.y = rng() * Math.PI;
      if (i < 3) this.crates.push(crate);
    }
    for (let i = 0; i < 10; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rng() * 2), boxMat(0x7a5a40));
      rock.position.set(x - 30 + rng() * 60, 0.8, z - 30 + rng() * 60);
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rock.castShadow = true;
      this.group.add(rock);
    }
  }

  buildMesas() {
    const rng = this.rng;
    const spots = [
      [-420, -380, 90, 70], [-380, 360, 110, 80], [180, -400, 80, 60],
      [-120, 400, 100, 75], [420, -320, 70, 90], [430, 300, 90, 70],
      [60, 380, 70, 55], [-430, 0, 60, 90], [260, 380, 80, 60],
    ];
    for (const [x, z, w, h] of spots) {
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.75, h, 7), boxMat(0xa85f34));
      mesa.position.set(x, h / 2 - 2, z);
      mesa.rotation.y = rng() * Math.PI;
      mesa.castShadow = true;
      mesa.receiveShadow = true;
      this.group.add(mesa);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.58, w * 0.58, 6, 7), boxMat(0x7a4024));
      cap.position.set(x, h - 2, z);
      cap.rotation.y = mesa.rotation.y;
      cap.castShadow = true;
      this.group.add(cap);
    }
  }

  buildProps() {
    const rng = this.rng;
    // Cacti and rocks scattered in the desert, clear of roads and the town core.
    for (let i = 0; i < 90; i++) {
      const x = -440 + rng() * 880;
      const z = -430 + rng() * 860;
      if (Math.abs(z) < 16 && x > -450 && x < 360) continue;
      if (x > -200 && x < 200 && z > -230 && z < 40) continue;
      if (x > 300 && x < 360) continue;
      if (rng() < 0.55) {
        const h = 2.5 + rng() * 3;
        this.cyl(0.5, 0.6, h, 0x4a7a3a, x, h / 2, z, 8);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8), boxMat(0x4a7a3a));
        arm.rotation.z = Math.PI / 2;
        arm.position.set(x + 0.9, h * 0.55, z);
        arm.castShadow = true;
        this.group.add(arm);
        this.addCollider(x - 0.7, z - 0.7, x + 0.7, z + 0.7);
      } else {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + rng() * 1.8), boxMat(0x8a6a4a));
        rock.position.set(x, 0.7, z);
        rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        rock.castShadow = true;
        this.group.add(rock);
      }
    }
    // Highway lamps.
    for (let x = -420; x <= 280; x += 70) {
      for (const z of [-11, 11]) {
        this.cyl(0.18, 0.22, 8, 0x3a3a3a, x, 4, z, 8);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffc46a, emissiveIntensity: 1.6 }),
        );
        head.position.set(x, 8.1, z);
        this.group.add(head);
      }
    }
  }

  buildDust() {
    const count = 700;
    const pos = new Float32Array(count * 3);
    const rng = this.rng;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -440 + rng() * 880;
      pos[i * 3 + 1] = 0.5 + rng() * 22;
      pos[i * 3 + 2] = -430 + rng() * 860;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // Soft round sprite so dust reads as haze, not confetti squares.
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 220, 160, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 210, 150, 0.35)');
    grad.addColorStop(1, 'rgba(255, 210, 150, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(c);
    const mat = new THREE.PointsMaterial({
      color: 0xffd9a0, size: 2.2, map: sprite, transparent: true, opacity: 0.4,
      depthWrite: false, sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.group.add(this.dust);
  }

  buildPickupSpots() {
    this.pickupSpots = [
      { kind: 'health', x: -178, z: 40 },
      { kind: 'health', x: 60, z: -60 },
      { kind: 'armor', x: 150, z: -40 },
      { kind: 'armor', x: -260, z: 210 },
      { kind: 'ammo', x: -40, z: -100 },
      { kind: 'ammo', x: 100, z: 40 },
      { kind: 'ammo', x: 380, z: 14 },
    ];
  }

  buildRoads() {
    // Traffic loops: highway both directions + a downtown rectangle.
    this.roads = [
      { loop: true, points: [[-440, 3.5], [295, 3.5], [365, 3.5], [445, 3.5], [445, -3.5], [365, -3.5], [295, -3.5], [-440, -3.5]] },
      { loop: true, points: [[-120, -65.5], [120, -65.5], [120, -194.5], [-120, -194.5]] },
      { loop: true, points: [[-40, -65.5], [-40, -194.5], [40, -194.5], [40, -65.5]] },
    ];
  }

  /** Per-frame life: dust drift and a soft sign glow pulse. */
  update(dt, t) {
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + dt * 3.2;
        if (x > 450) x = -450;
        pos.setX(i, x);
        pos.setY(i, pos.getY(i) + Math.sin(t * 0.6 + i) * dt * 0.25);
      }
      pos.needsUpdate = true;
    }
    const pulse = 0.85 + Math.sin(t * 2.2) * 0.15;
    for (const s of this.signs) s.material.emissiveIntensity = pulse;
  }
}
