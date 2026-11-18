// FROSTLINE — shared configuration: world layout, palette, cars, missions, prices.
// All values are authored for this game only. Units are metres, angles radians.

export const CFG = {
  title: 'FROSTLINE',
  worldSize: 700, // terrain spans -350..350 on x and z
  gravity: 22,
  // ---- dusk palette ----
  skyTop: 0x0b1026,
  skyHorizon: 0x3a2b52,
  fogColor: 0x2a2f4a,
  fogNear: 90,
  fogFar: 420,
  snowColor: 0xdfe8f2,
  snowShadow: 0x9fb4d8,
  roadColor: 0x2e3340,
  iceColor: 0x9fd8e8,
  auroraA: 0x37e6a0,
  auroraB: 0x7a5cff,
  // ---- player ----
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  jumpSpeed: 8.5,
  playerHealth: 100,
  // ---- money ----
  resprayCost: 150,
  startCash: 200,
  // ---- wanted ----
  heatDecaySeconds: 12,
  starDecaySeconds: 9,
  // ---- combat ----
  pistolAmmo: 24,
  pistolDamage: 34,
  fistDamage: 12,
};

// Roads as segments {ax, az, bx, bz, w}. Traffic and the minimap use these.
export const ROADS = [
  { name: 'Main Street', ax: -170, az: 0, bx: 170, bz: 0, w: 12 },
  { name: 'Cross Street', ax: 0, az: -140, bx: 0, bz: 140, w: 10 },
  { name: 'Lake Road', ax: -40, az: 0, bx: -180, bz: 60, w: 9 },
  { name: 'Lodge Road', ax: 0, az: -60, bx: 70, bz: -70, w: 9 },
  { name: 'Pass Road', ax: 60, az: -120, bx: 150, bz: -120, w: 9 },
  { name: 'Pass Road South', ax: 150, az: -120, bx: 150, bz: 220, w: 9 },
];

// Buildings: {name, x, z, w, d, h, color, roof, sign, signColor}
// x/z is the centre, w along x, d along z. The town reads as a resort strip.
export const BUILDINGS = [
  { name: 'Frostline Lodge', x: 70, z: -78, w: 34, d: 20, h: 14, color: 0x6b4a2f, roof: 0xe8eef7, sign: 'LODGE', signColor: 0xffd27a },
  { name: 'Pine Diner', x: -40, z: -16, w: 18, d: 12, h: 7, color: 0x7a3b2e, roof: 0xe8eef7, sign: 'DINER', signColor: 0xff9a5c },
  { name: 'Ski Rental', x: -15, z: -16, w: 14, d: 10, h: 6, color: 0x2e4a6b, roof: 0xe8eef7, sign: 'SKI', signColor: 0x7fd4ff },
  { name: 'General Store', x: 15, z: -16, w: 16, d: 11, h: 6, color: 0x4a5d3a, roof: 0xe8eef7, sign: 'STORE', signColor: 0xb8ff9a },
  { name: 'Chapel', x: 80, z: -16, w: 12, d: 14, h: 9, color: 0x8a8578, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Post Office', x: 110, z: -16, w: 14, d: 10, h: 6, color: 0x5d4a6b, roof: 0xe8eef7, sign: 'POST', signColor: 0xffd27a },
  { name: 'Snowline Garage', x: -100, z: -20, w: 22, d: 14, h: 8, color: 0x37424f, roof: 0xdfe8f2, sign: 'GARAGE', signColor: 0x7fd4ff },
  { name: 'Aurora Motel', x: -120, z: -34, w: 26, d: 12, h: 8, color: 0x6b2e4a, roof: 0xe8eef7, sign: 'MOTEL', signColor: 0xff7ad4 },
  { name: 'Ice House Bar', x: -80, z: -42, w: 16, d: 11, h: 7, color: 0x2e3a4a, roof: 0xe8eef7, sign: 'BAR', signColor: 0xff5c5c },
  { name: 'Ski Patrol HQ', x: 30, z: -96, w: 14, d: 10, h: 7, color: 0xa03a2e, roof: 0xe8eef7, sign: 'PATROL', signColor: 0xff6b6b },
  { name: 'Lift Base', x: 40, z: -124, w: 12, d: 10, h: 8, color: 0x4a3a2e, roof: 0xe8eef7, sign: 'LIFT', signColor: 0xffe27a },
  { name: 'Lift Depot', x: 48, z: -146, w: 14, d: 12, h: 7, color: 0x3a3f4a, roof: 0xdfe8f2, sign: '', signColor: 0xffffff },
  { name: 'Cabin 1', x: -60, z: 62, w: 10, d: 9, h: 5, color: 0x5d4030, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 2', x: -30, z: 82, w: 10, d: 9, h: 5, color: 0x4a3527, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 3', x: 0, z: 70, w: 10, d: 9, h: 5, color: 0x6b4a2f, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 4', x: 40, z: 86, w: 10, d: 9, h: 5, color: 0x54402e, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 5', x: 90, z: 66, w: 10, d: 9, h: 5, color: 0x5d4030, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 6', x: -110, z: 72, w: 10, d: 9, h: 5, color: 0x4a3527, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Cabin 7', x: 120, z: 82, w: 10, d: 9, h: 5, color: 0x6b4a2f, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Hideout Cabin', x: -30, z: 118, w: 11, d: 9, h: 5, color: 0x3a2e22, roof: 0xe8eef7, sign: '', signColor: 0xffffff },
  { name: 'Ice Hut', x: -180, z: 60, w: 8, d: 7, h: 4, color: 0x7a6a55, roof: 0xdfe8f2, sign: '', signColor: 0xffffff },
  { name: 'South Gate', x: 150, z: 220, w: 16, d: 6, h: 7, color: 0x37424f, roof: 0xdfe8f2, sign: 'GATE', signColor: 0x7fd4ff },
];

// Car types the player can steal and drive.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', topSpeed: 34, accel: 16, grip: 1.0, tough: 1.0, colors: [0x8a2f2f, 0x2f4a8a, 0x3a3f4a, 0x7a7f8a] },
  pickup: { name: 'Pickup', topSpeed: 28, accel: 13, grip: 1.1, tough: 1.6, colors: [0x4a5d3a, 0x6b4a2f, 0x37424f] },
  suv: { name: 'Trail SUV', topSpeed: 32, accel: 15, grip: 1.15, tough: 1.3, colors: [0x2e4a6b, 0x5d4a6b, 0x8a7a3a] },
  sport: { name: 'Sport Coupe', topSpeed: 44, accel: 22, grip: 0.85, tough: 0.8, colors: [0xa03a2e, 0xd4a02e, 0x2e8a7a] },
  snowcat: { name: 'Snowcat', topSpeed: 20, accel: 10, grip: 1.4, tough: 2.2, colors: [0xc25a1e] },
  police: { name: 'Patrol SUV', topSpeed: 38, accel: 19, grip: 1.1, tough: 1.4, colors: [0xe8eef7] },
};

// The frozen lake ellipse (driving on it is slick ice).
export const LAKE = { x: -180, z: 60, rx: 88, rz: 56 };

// The six story missions. Each step: {text, at:[x,z], radius, kind}
// kind: 'goto' (reach marker), 'pickup', 'deliver', 'survive' (stay alive with wanted), 'defeat' (count set in code), 'timed' (reach before timer).
export const MISSIONS = [
  {
    id: 1, title: 'First Pickup', pay: 250,
    intro: 'Vera needs a package moved. Pick it up at the Frostline Lodge, then drop it at the Pine Diner. Keep it quiet.',
    steps: [
      { text: 'Pick up the package at the Frostline Lodge', at: [70, -62], radius: 6, kind: 'pickup' },
      { text: 'Deliver the package to the Pine Diner', at: [-40, -8], radius: 6, kind: 'deliver' },
    ],
  },
  {
    id: 2, title: 'Powder Run', pay: 400,
    intro: 'A buyer waits at the ice-fishing hut on the frozen lake. Drive out across the ice and back to the garage. The patrols are watching the lake tonight.',
    steps: [
      { text: 'Drive to the ice-fishing hut on the frozen lake', at: [-180, 60], radius: 8, kind: 'goto' },
      { text: 'Bring the payment back to the Snowline Garage', at: [-100, -10], radius: 7, kind: 'deliver' },
    ],
  },
  {
    id: 3, title: 'Lift House Heist', pay: 600,
    intro: 'The crew needs the snowcat parked at the lift depot. Steal it and bring it down to the garage. No witnesses.',
    steps: [
      { text: 'Steal the snowcat at the Lift Depot', at: [48, -138], radius: 7, kind: 'pickup' },
      { text: 'Deliver the snowcat to the Snowline Garage', at: [-100, -10], radius: 8, kind: 'deliver' },
    ],
  },
  {
    id: 4, title: 'Hot Getaway', pay: 800,
    intro: 'The job went loud. Three stars on you. Lose the patrols and reach the hideout cabin south of town.',
    steps: [
      { text: 'Reach the hideout cabin — lose the patrols', at: [-30, 118], radius: 7, kind: 'goto' },
    ],
  },
  {
    id: 5, title: 'Lodge Shootout', pay: 1000,
    intro: 'Rivals hit the lodge while Vera is inside. Get to the lodge and clear them out. Five of them. Make it count.',
    steps: [
      { text: 'Get to the Frostline Lodge', at: [70, -62], radius: 8, kind: 'goto' },
      { text: 'Clear out the rivals at the lodge (0/5)', at: [70, -62], radius: 26, kind: 'defeat', count: 5 },
      { text: 'Check on Vera at the lodge door', at: [70, -60], radius: 5, kind: 'deliver' },
    ],
  },
  {
    id: 6, title: 'Whiteout Escape', pay: 1500,
    intro: 'Blizzard coming down the pass. Drive the pass road to the south gate before the whiteout closes it. Do not stop.',
    steps: [
      { text: 'Drive the pass road to the South Gate before time runs out', at: [150, 220], radius: 12, kind: 'timed', seconds: 150 },
    ],
  },
];

// Pickups scattered around town: {kind, x, z}
export const PICKUPS = [
  { kind: 'health', x: -52, z: -8 }, { kind: 'health', x: 24, z: -8 }, { kind: 'health', x: -120, z: 40 },
  { kind: 'armor', x: 60, z: -50 }, { kind: 'armor', x: -88, z: -8 }, { kind: 'armor', x: 130, z: 60 },
  { kind: 'ammo', x: -28, z: -8 }, { kind: 'ammo', x: 96, z: -8 }, { kind: 'ammo', x: -170, z: 40 },
  { kind: 'health', x: 40, z: -110 }, { kind: 'ammo', x: 150, z: 40 }, { kind: 'armor', x: -180, z: 30 },
];

// Parked / traffic cars: {type, x, z, angle, traffic}
export const CARS = [
  { type: 'sedan', x: -24, z: 8, angle: 0.1, traffic: false },
  { type: 'suv', x: 30, z: -8, angle: -0.1, traffic: false },
  { type: 'pickup', x: -70, z: 8, angle: 0.05, traffic: false },
  { type: 'sport', x: 100, z: 8, angle: 0, traffic: false },
  { type: 'sedan', x: -130, z: -8, angle: 0.2, traffic: false },
  { type: 'suv', x: 140, z: -8, angle: -0.2, traffic: false },
  { type: 'sedan', x: -20, z: 30, angle: 1.57, traffic: true },
  { type: 'pickup', x: 10, z: -40, angle: -1.57, traffic: true },
  { type: 'suv', x: 60, z: 20, angle: 3.14, traffic: true },
  { type: 'sedan', x: -90, z: -20, angle: 0, traffic: true },
  { type: 'sedan', x: 120, z: 30, angle: 1.57, traffic: true },
  { type: 'pickup', x: -150, z: 50, angle: -1.2, traffic: true },
];

// Pedestrian spawn points (sidewalk wanderers).
export const PEDS = [
  [-30, -10], [-10, 10], [20, -10], [45, 8], [-60, -8], [90, 10], [-110, -10],
  [10, 50], [-45, 55], [70, 40], [-100, 55], [130, -10], [-140, 20], [0, -40],
];

export const SPAWN = { x: -8, z: 24, angle: Math.PI };
export const GARAGE = { x: -100, z: -10 };
export const LODGE = { x: 70, z: -62 };
