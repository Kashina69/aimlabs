import { countsPer360, inPer360, sensitivityForCm360 } from '../utils/sensitivity.js';
import { clampCm, resolveOptimum, vertexInterval } from './Bracket.js';

/**
 * What: Turns the completed bracket into the persisted sensitivity report.
 * Why:  The mode should own the test, not the report schema; this keeps the
 *       statistics, confidence rules and record shape in one auditable place.
 * How:  Resolves the fitted optimum, bootstraps its interval, classifies confidence,
 *       and flattens the rounds into the stored/displayed record.
 */

/**
 * What: Builds the finder's result record from the finished rounds.
 * Why:  One canonical record feeds the results screen, the history store and Apply.
 * How:  Reads the LAST round (its candidates are on one normalised scale), fits the
 *       optimum, clamps it to the profile, and copies only aggregates plus the
 *       current checks.
 */
export function buildSensResult({
  rounds,
  bounds,
  cpi,
  profile,
  cfg,
  checks,
  saved,
  calibrated,
  attemptCap,
  attemptTotal
}) {
  const last = rounds[rounds.length - 1];
  const optimum = resolveOptimum(last.candidates, bounds);
  const bestCm = clampCm(optimum.cm360, bounds);
  const bestSens = sensitivityForCm360(bestCm, cpi, profile.yaw);
  const interval = vertexInterval(last.candidates, last.zoneMeans);
  const ci = interval
    ? [Math.max(bounds.min, interval[0]), Math.min(bounds.max, interval[1])]
    : null;

  let confidence = 'low';
  if (ci) {
    const relative = (ci[1] - ci[0]) / bestCm;
    if (relative < 0.04) confidence = 'high';
    else if (relative < 0.08) confidence = 'medium';
  }
  if (checks.acceleration === 'detected') confidence = 'low';
  else if (!calibrated && checks.dpr !== 1 && confidence === 'high') confidence = 'medium';

  const winner = last.candidates.reduce((a, b) => (a.metrics.E <= b.metrics.E ? a : b));

  return {
    kind: 'sens-finder',
    profileId: profile.id,
    profileName: profile.name,
    length: cfg.length,
    dpi: cfg.dpi,
    effectiveCpi: cpi,
    calibrated,
    measuredCm360: cfg.measuredCm360,
    bestCm360: bestCm,
    bestIn360: inPer360(bestCm),
    bestSensitivity: bestSens,
    countsPer360: countsPer360(bestCm, cpi),
    edpi: bestSens * cpi,
    ci,
    confidence,
    fitted: optimum.fitted,
    testedCm: last.candidates.map((candidate) => candidate.cm360),
    rounds: rounds.map(summariseRound),
    zones: {
      cone: winner.metrics.zones.cone,
      wide: winner.metrics.zones.wide
    },
    checks: { ...checks },
    attemptRate: attemptCap ? Math.min(1, attemptTotal / attemptCap) : 0,
    originalSensitivity: saved.sensitivity,
    originalGame: saved.game
  };
}

/**
 * What: Flattens one round into chart-friendly numbers.
 * Why:  The report shows only E and the zone scores, never raw trial arrays.
 * How:  Maps each candidate to its measured cm/360 and aggregate error values.
 */
function summariseRound(round) {
  return {
    centerCm360: round.centerCm360,
    candidates: round.candidates.map((candidate) => ({
      cm360: candidate.cm360,
      E: candidate.metrics.E,
      cone: candidate.metrics.zones.cone.score,
      wide: candidate.metrics.zones.wide.score,
      hitRate: (candidate.metrics.zones.cone.hitRate + candidate.metrics.zones.wide.hitRate) / 2,
      bias: (candidate.metrics.zones.cone.bias + candidate.metrics.zones.wide.bias) / 2
    }))
  };
}
