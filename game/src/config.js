// DUSTLINE balance sheet: every number that shapes Copper Flats, the cars, the
// law and the six jobs. Tune the game here, not by hunting through the systems.

export const WORLD = {
  size: 900,            // ground plane, metres across
  highwayZ: 0,          // the main east-west highway runs along x at z = 0
  highwayHalfWidth: 7,
  bridgeX: 300,         // the canyon bridge deck starts here (east edge)
  canyonX: 330,         // centre of the canyon gap
  quarry: { x: -270, z: 230 },
  downtown: { x0: -150, x1: 150, z0: -190, z1: -50 },
  gasStation: { x: -190, z: 26 },
  motel: { x: -120, z: -26 },
  diner: { x: 90, z: 26 },
  garage: { x: 170, z: -26 },   // respray garage — clears wanted for cash
  waterTower: { x: 0, z: -120 },
  fogColor: 0xe8a05c,
  sunColor: 0xffb36b,
  sunIntensity: 2.6,
  hemiSky: 0xffd9a0,
  hemiGround: 0x7a4a28,
};

export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11.5,
  jumpSpeed: 8.5,
  accel: 42,
  radius: 0.7,
  maxHealth: 100,
  maxArmor: 100,
  pistolAmmoStart: 24,
  pistolDamage: 34,
  punchDamage: 12,
  punchRange: 2.2,
  punchCooldown: 0.45,
  shootCooldown: 0.22,
};

export const CARS = {
  // label, top speed (m/s), acceleration, grip, paint, body length
  sedan:  { label: 'Sedan',     top: 34, accel: 15, grip: 2.6, color: 0x7a8ba0, len: 4.4 },
  pickup: { label: 'Pickup',    top: 30, accel: 13, grip: 2.2, color: 0xa8542e, len: 4.8 },
  muscle: { label: 'Muscle',    top: 42, accel: 20, grip: 2.0, color: 0xc22e2e, len: 4.6 },
  coupe:  { label: 'Coupe',     top: 38, accel: 17, grip: 2.9, color: 0x2e6db0, len: 4.2 },
  truck:  { label: 'Box Truck', top: 24, accel: 9,  grip: 1.8, color: 0xd8cdb0, len: 6.2 },
  police: { label: 'Police',    top: 40, accel: 19, grip: 2.8, color: 0x1c1e24, len: 4.5 },
};

export const WANTED = {
  maxStars: 5,
  crimeCarTheft: 1,
  crimeHitPed: 1,
  crimeShootNearCop: 1,
  crimeKillCop: 2,
  decaySeconds: 9,      // seconds out of cop sight before one star falls off
  resprayCost: 150,
  copChaseSpeed: 36,
  copRamDamage: 6,
  roadblockAt: 3,
};

export const MISSIONS = [
  { id: 1, name: 'First Pickup', giver: 'Dusty', reward: 250,
    text: 'Drive to the gas station and pick up the package',
    target: { x: -190, z: 26 }, kind: 'goto' },
  { id: 2, name: 'Bridge Run', giver: 'Dusty', reward: 400,
    text: 'Smuggle the package across the canyon bridge — the law is watching',
    target: { x: 380, z: 0 }, kind: 'goto', tail: true },
  { id: 3, name: 'Quarry Heist', giver: 'Mara', reward: 600,
    text: 'Steal 3 crates from the quarry. Guards shoot on sight',
    target: { x: -270, z: 230 }, kind: 'collect', count: 3 },
  { id: 4, name: 'Hot Getaway', giver: 'Mara', reward: 750,
    text: 'Lose the heat: reach the diner with 3 stars and survive 30 seconds',
    target: { x: 90, z: 26 }, kind: 'survive', seconds: 30 },
  { id: 5, name: 'Main Street', giver: 'Vic', reward: 900,
    text: 'Clear the ambush on main street — take down 5 of Vic\u2019s rivals',
    target: { x: 0, z: -120 }, kind: 'eliminate', count: 5 },
  { id: 6, name: 'Dustline', giver: 'Vic', reward: 1500,
    text: 'Final escape: outrun the roadblock and cross the east bridge',
    target: { x: 420, z: 0 }, kind: 'escape' },
];

export const PICKUPS = {
  health: { amount: 40, color: 0x37d67a, respawn: 45 },
  armor:  { amount: 50, color: 0x4fa8ff, respawn: 60 },
  ammo:   { amount: 24, color: 0xffd76a, respawn: 40 },
};

export const SAVE_KEY = 'dustline-save-v1';
