/**
 * What: Deterministic pseudo-random helpers.
 * Why:  The sensitivity finder must replay the identical target sequence for every
 *       candidate; otherwise differences between candidates are luck, not aim.
 * How:  A small seeded PRNG (mulberry32) plus range/pick/shuffle helpers.
 */

/**
 * What: Creates a seeded random function in [0, 1).
 * Why:  Reproducible sequences and reproducible bootstrap intervals.
 * How:  mulberry32's 32-bit state mixing.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What: Uniform value in [min, max). Why: Spawn geometry. How: rand × span + min. */
export function range(rand, min, max) {
  return min + rand() * (max - min);
}

/** What: A random element. Why: Small selection helpers. How: Floor(rand × length). */
export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

/** What: A shuffled copy. Why: Rotating candidate order without mutating input. How: Fisher–Yates. */
export function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
