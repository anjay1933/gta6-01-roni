// NEON HARBOR — config: constants, districts, car types, mission data.
// All shared state lives on window.NH; every module adds its own section.
(function () {
  var NH = window.NH = window.NH || {};

  // Seeded RNG (deterministic city + staged screenshots).
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var params = new URLSearchParams(location.search);
  NH.seed = parseInt(params.get('seed') || '1', 10) || 1;
  NH.rng = mulberry32(NH.seed);
  NH.rand = function (a, b) { return a + NH.rng() * (b - a); };
  NH.randInt = function (a, b) { return Math.floor(NH.rand(a, b + 1)); };
  NH.randPick = function (arr) { return arr[Math.floor(NH.rng() * arr.length)]; };
  NH.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  NH.lerp = function (a, b, t) { return a + (b - a) * t; };
  NH.dist2d = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };

  NH.CFG = {
    worldHalf: 180,          // playable square: -180..180 on x and z
    streetGap: 40,           // streets every 40 units
    roadW: 9,                // road width
    walkW: 3,                // sidewalk width each side
    gravity: 22,
    walkSpeed: 7,
    sprintSpeed: 11,
    jumpSpeed: 8.5,
    maxWanted: 5,
    paynsprayCost: 150,
    startCash: 200
  };

  NH.DISTRICTS = [
    { name: 'DOCKS', x0: -180, x1: -100, z0: -180, z1: 180, color: 0x2a4a6b },
    { name: 'DOWNTOWN', x0: -100, x1: 100, z0: -180, z1: 100, color: 0x6b2a5e },
    { name: 'BEACH ROAD', x0: -180, x1: 180, z0: 100, z1: 180, color: 0x1a5e6b },
    { name: 'NORTH BRIDGE', x0: -180, x1: 180, z0: -180, z1: -140, color: 0x3a3a55 }
  ];

  // Car types: speed in m/s, accel, turn rate, body color, value.
  NH.CAR_TYPES = {
    sedan:  { top: 26, accel: 14, turn: 1.9, color: 0x8a97a8, name: 'Sedan' },
    taxi:   { top: 24, accel: 13, turn: 1.9, color: 0xf2c200, name: 'Taxi' },
    truck:  { top: 19, accel: 9,  turn: 1.3, color: 0x4a6b8a, name: 'Truck' },
    sport:  { top: 36, accel: 20, turn: 2.4, color: 0xd21f5e, name: 'Sport' },
    van:    { top: 21, accel: 10, turn: 1.5, color: 0x7a7a72, name: 'Van' },
    police: { top: 30, accel: 17, turn: 2.2, color: 0x1a1a2e, name: 'Police' }
  };

  // The 6-mission story arc for Dana Cruz and the Harbor Crew.
  NH.MISSIONS = [
    { id: 1, title: 'FIRST PICKUP', brief: 'Meet the crew contact at Pier 9. Grab the package and bring it back to the garage.',
      type: 'goto', target: { x: -150, z: 60 }, reward: 300 },
    { id: 2, title: 'BRIDGE RUN', brief: 'Smuggle the package across the North Bridge. A tail car is on you — lose it or outrun it.',
      type: 'deliver', target: { x: 120, z: -160 }, reward: 500, timed: 90 },
    { id: 3, title: 'CONTAINER YARD', brief: 'Steal the sport car from the container yard. Two armed guards watch it. Bring it to the garage.',
      type: 'steal', target: { x: -140, z: -40 }, reward: 800 },
    { id: 4, title: 'HOT GETAWAY', brief: 'The cops are onto you. Reach the safehouse with 3 stars on your tail — then lose them.',
      type: 'escape', target: { x: 60, z: 120 }, reward: 1000, wanted: 3 },
    { id: 5, title: 'DOWNTOWN SHOOTOUT', brief: 'Rival crew hit the plaza. Clear out all six shooters and protect the crew.',
      type: 'shootout', target: { x: 40, z: 40 }, reward: 1500, enemies: 6 },
    { id: 6, title: 'HARBOR ESCAPE', brief: 'Final run. Reach the speedboat at the pier with the whole harbor after you.',
      type: 'escape', target: { x: -165, z: 150 }, reward: 2500, wanted: 4 }
  ];

  NH.SAVE_KEY = 'neon-harbor-save-v1';
})();
