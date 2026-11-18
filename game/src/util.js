// DUSTLINE shared math: a seeded RNG so the town, traffic and staged shots are
// identical on every load, plus the small numeric helpers every system reaches for.

/** mulberry32 — a tiny deterministic generator. Same seed in, same numbers out. */
export function makeRng(seed) {
  let state = seed >>> 0;
  return function roll() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let v = Math.imul(state ^ (state >>> 15), 1 | state);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp a value into [lo, hi]. */
export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/** Clamp a value into [0, 1]. */
export function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Linear blend between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smallest signed turn from angle a to angle b, wrapped into [-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move `current` toward `target` by no more than `step` radians. */
export function turnToward(current, target, step) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

/** Flat (x,z) distance between two points. */
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Choose one value from a [{ weight, value }] table using the given rng. */
export function pickWeighted(rng, table) {
  let total = 0;
  for (const row of table) total += row.weight;
  let roll = rng() * total;
  for (const row of table) {
    roll -= row.weight;
    if (roll <= 0) return row.value;
  }
  return table[table.length - 1].value;
}

/** Cash as "$1,250". */
export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
