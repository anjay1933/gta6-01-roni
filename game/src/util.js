// DUSTLINE small helpers: a seeded random stream (so staged screenshots and the
// town layout are identical every run) plus the vector maths the systems share.

/** mulberry32 — tiny deterministic PRNG. Same seed, same town, same traffic. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp to 0..1 — the range every HUD bar and fade lives in. */
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference, in radians, wrapped to [-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Pick one entry from a weighted table using the given rng. */
export function pickWeighted(rng, entries) {
  let total = 0;
  for (const e of entries) total += e.weight;
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

/** Format cash like $1,250. */
export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
