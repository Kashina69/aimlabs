import { bootstrapScore, percentile, scoreRound } from './Aggregate.js';
import { mulberry32 } from '../utils/rng.js';
import { cmPer360, sensitivityForCm360 } from '../utils/sensitivity.js';

/**
 * What: The bracket search that converges on the best 360-distance.
 * Why:  Ratios matter for sensitivity, and three measured points are enough to fit
 *       a parabola whose minimum is the next place to look.
 * How:  Works in ln(cm/360). Each round tests centre/step, centre and centre×step.
 *       An exact quadratic through their error scores gives the next centre; the
 *       step shrinks each round. The final round's three points bracket the answer.
 */

export const DEFAULT_STEP = 1.35;
const MIN_STEP = 1.03;
const ABS_MIN_CM = 8;
const ABS_MAX_CM = 120;

/**
 * What: The cm/360 range the selected game profile can physically express.
 * Why:  Never propose a sensitivity the game cannot store.
 * How:  Converts the profile's own min/max sensitivities at this CPI, intersects
 *       with a sane human range, and guards a degenerate result.
 */
export function cmBounds(profile, cpi) {
  const fastest = cmPer360(profile.max, cpi, profile.yaw);
  const slowest = cmPer360(profile.min, cpi, profile.yaw);
  const low = Math.max(ABS_MIN_CM, Math.min(fastest, slowest));
  const high = Math.min(ABS_MAX_CM, Math.max(fastest, slowest));
  if (high - low < 0.5) return { min: ABS_MIN_CM, max: Math.min(ABS_MAX_CM, ABS_MIN_CM * 3) };
  return { min: low, max: high };
}

/** What: Clamps a cm/360 value into a range. Why: Candidates and reports must be valid. How: min/max. */
export function clampCm(value, bounds) {
  return Math.max(bounds.min, Math.min(bounds.max, value));
}

/**
 * What: The three candidates for one round.
 * Why:  Symmetric geometric spacing keeps the parabola fit well-conditioned.
 * How:  Clamps the centre and both neighbours; slides inward at a bound instead
 *       of collapsing to duplicate points.
 */
export function roundCandidates(centerCm, step, bounds) {
  const center = clampCm(centerCm, bounds);
  let lo = clampCm(center / step, bounds);
  let hi = clampCm(center * step, bounds);
  if (hi - center < 0.005 * center) {
    hi = clampCm(center * step, bounds);
    if (hi - center < 0.005 * center) {
      center = clampCm(center / step, bounds);
      lo = clampCm(center / step, bounds);
      hi = clampCm(center * step, bounds);
    }
  }
  return [lo, center, hi].sort((a, b) => a - b);
}

/** What: The next (smaller) bracket step. Why: Convergence without overshooting. How: Geometric decay. */
export function nextStep(step) {
  return Math.max(MIN_STEP, 1 + (step - 1) * 0.45);
}

/**
 * What: Exact quadratic through three (u, e) points, u = ln(cm/360).
 * Why:  Its vertex is the model's optimum and the next bracket centre.
 * How:  Divided differences derive a, b, c; returns the vertex and curvature.
 */
export function fitQuadratic(points) {
  if (!points || points.length < 3) return null;
  const [p1, p2, p3] = points;
  const u1 = p1.u;
  const u2 = p2.u;
  const u3 = p3.u;
  if (Math.abs(u2 - u1) < 1e-9 || Math.abs(u3 - u2) < 1e-9 || Math.abs(u3 - u1) < 1e-9) return null;

  const d1 = (p2.e - p1.e) / (u2 - u1);
  const d2 = (p3.e - p2.e) / (u3 - u2);
  const a = (d2 - d1) / (u3 - u1);
  if (!Number.isFinite(a)) return null;
  const b = d1 - a * (u1 + u2);
  const c = p1.e - a * u1 * u1 - b * u1;
  if (Math.abs(a) < 1e-12) return null;
  const uStar = -b / (2 * a);
  return { a, b, c, uStar, eStar: a * uStar * uStar + b * uStar + c };
}

/**
 * What: The fitted minimum of a round, if the curve is genuinely U-shaped.
 * Why:  A non-positive curvature means the data do not support an interior optimum.
 * How:  Fits in log space, requires a > 0, and rejects vertices outside the bracket.
 */
export function vertexCm(candidates) {
  const points = candidates
    .filter((candidate) => Number.isFinite(candidate.cm360) && Number.isFinite(candidate.metrics?.E))
    .map((candidate) => ({ u: Math.log(candidate.cm360), e: candidate.metrics.E }));
  if (points.length < 3) return null;
  const fit = fitQuadratic(points);
  if (!fit || !(fit.a > 0) || !Number.isFinite(fit.uStar)) return null;
  const cm = Math.exp(fit.uStar);
  const us = points.map((point) => point.u);
  const lo = Math.min(...us) - 0.15;
  const hi = Math.max(...us) + 0.15;
  if (fit.uStar < lo || fit.uStar > hi) return null;
  return { cm, fit };
}

/**
 * What: 95% interval for the optimum.
 * Why:  The five-decimal figure alone would overstate experimental precision.
 * How:  Seeded bootstrap of each candidate's shots, refit the parabola, take the
 *       2.5/97.5 percentiles of the resulting vertices.
 */
export function vertexInterval(candidates, zoneMeans, iterations = 800) {
  const points = candidates.filter(
    (candidate) => Number.isFinite(candidate.cm360) && candidate.metrics?.E != null
  );
  if (points.length < 3) return null;
  const rand = mulberry32(0x5eed1234);
  const vertices = [];
  for (let i = 0; i < iterations; i += 1) {
    const sample = points.map((candidate) => ({
      u: Math.log(candidate.cm360),
      e: bootstrapScore(candidate, zoneMeans, rand)
    }));
    const fit = fitQuadratic(sample);
    if (!fit || !(fit.a > 0) || !Number.isFinite(fit.uStar)) continue;
    const cm = Math.exp(fit.uStar);
    if (Number.isFinite(cm) && cm > 1 && cm < 1000) vertices.push(cm);
  }
  if (vertices.length < iterations * 0.25) return null;
  vertices.sort((a, b) => a - b);
  return [percentile(vertices, 0.025), percentile(vertices, 0.975)];
}

/**
 * What: Chooses the reported optimum for a completed round.
 * Why:  A non-U-shaped fit must fall back to the best measured point instead of
 *       extrapolating nonsense.
 * How:  Prefers the fitted vertex, clamps it, otherwise takes the lowest-E candidate.
 */
export function resolveOptimum(candidates, bounds) {
  const best = candidates.reduce((a, b) => (a.metrics.E <= b.metrics.E ? a : b));
  const vertex = vertexCm(candidates);
  if (vertex) {
    const cm360 = clampCm(vertex.cm, bounds);
    return {
      cm360,
      sens: sensitivityForCm360(cm360, best.cpi, best.profileYaw),
      measuredCm360: best.cm360,
      fitted: true
    };
  }
  return { cm360: best.cm360, sens: best.sens, measuredCm360: best.cm360, fitted: false };
}

/** What: Scores a round. Why: One call site for the mode. How: Delegates to scoreRound. */
export function scoreCandidates(candidates) {
  const { zoneMeans } = scoreRound(candidates);
  return { zoneMeans };
}
