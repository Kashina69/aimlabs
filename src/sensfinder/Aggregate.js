/**
 * What: Turns raw trial records into per-candidate error scores.
 * Why:  The finder needs one number per candidate that is comparable across zones
 *       and target sizes, and a principled reason for the minimum to exist.
 * How:  Every shot contributes squared angular error in TARGET RADII. The primary
 *       objective is a mean squared error, so `mse = bias² + spread²`: too high a
 *       sensitivity inflates spread, too low a sensitivity grows the bias. Zone
 *       scores are normalised by the round mean before mixing at 60/40.
 */

const ZONE_IDS = ['cone', 'wide'];
const WEIGHTS = { flick: 0.45, micro: 0.4, track: 0.15 };

/** What: Arithmetic mean. Why: Repeated by several aggregates. How: Sum / length. */
export function mean(values) {
  if (!values || !values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** What: Population variance. Why: Spread feeds the error objective. How: Mean squared deviation. */
export function variance(values) {
  if (!values || values.length < 2) return 0;
  const m = mean(values);
  return mean(values.map((v) => (v - m) ** 2));
}

/** What: Standard deviation. Why: Reported beside the bias. How: √variance. */
export function stdev(values) {
  return Math.sqrt(variance(values));
}

/** What: Middle value. Why: Robust centre for history summaries. How: Sort and pick. */
export function median(values) {
  if (!values || !values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What: Value at a quantile. Why: Bootstrap confidence intervals. How: Linear interpolation. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function err2Of(shots) {
  return shots.map((shot) => shot.err2);
}

/**
 * What: Summarises one zone for one candidate.
 * Why:  The objective, bias/spread diagnostics and hit rate all come from here.
 * How:  Splits flick and micro shots, folds in the tracking-trial means, and keeps
 *       the raw arrays needed for bootstrapping.
 */
function summarizeZone(zone) {
  const shots = zone?.shots || [];
  const flicks = shots.filter((shot) => shot.kind === 'flick');
  const micros = shots.filter((shot) => shot.kind === 'micro');
  const track = zone?.track || [];

  const flickMse = mean(err2Of(flicks));
  const microMse = mean(err2Of(micros));
  const trackMse = mean(track);

  const radial = shots.map((shot) => shot.radial);
  const score = flickMse || microMse
    ? WEIGHTS.flick * flickMse + WEIGHTS.micro * microMse + WEIGHTS.track * trackMse
    : trackMse;

  return {
    n: shots.length + track.length,
    shotCount: shots.length,
    flickMse,
    microMse,
    trackMse,
    score,
    bias: mean(radial),
    spread: stdev(radial),
    hitRate: shots.length ? shots.filter((shot) => shot.hit).length / shots.length : 0,
    ttf: mean(shots.map((shot) => shot.ttf)),
    correction: mean(zone?.corrections || []),
    raw: { flick: err2Of(flicks), micro: err2Of(micros), track: track.slice() }
  };
}

/**
 * What: Fills a candidate's `metrics` with its zone summaries.
 * Why:  Scoring and the report both read from one prepared object.
 * How:  Summarises both zones and resets the mixed score to zero.
 */
export function summarizeCandidate(candidate) {
  const zones = {};
  for (const id of ZONE_IDS) zones[id] = summarizeZone(candidate.zones?.[id]);
  candidate.metrics = { E: 0, zones };
  return candidate.metrics;
}

/**
 * What: Scores one round's three candidates on a single comparable scale.
 * Why:  Zone error magnitudes differ by design (smaller 45° targets), so a raw
 *       60/40 mix would silently change the intended weights.
 * How:  Divides each zone by the round's mean for that zone, then mixes 60/40.
 */
export function scoreRound(candidates) {
  for (const candidate of candidates) summarizeCandidate(candidate);
  const zoneMeans = {};
  for (const id of ZONE_IDS) {
    zoneMeans[id] = mean(candidates.map((candidate) => candidate.metrics.zones[id].score)) || 1;
  }
  for (const candidate of candidates) {
    candidate.metrics.E =
      (0.6 * candidate.metrics.zones.cone.score) / zoneMeans.cone +
      (0.4 * candidate.metrics.zones.wide.score) / zoneMeans.wide;
  }
  return { zoneMeans };
}

function resample(values, rand) {
  if (!values.length) return 0;
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[Math.floor(rand() * values.length)];
  return total / values.length;
}

/**
 * What: One bootstrap sample of a candidate's mixed score.
 * Why:  The confidence interval needs resampling of the actual per-shot errors.
 * How:  Resamples each shot group independently, keeps the observed zone normalisation.
 */
export function bootstrapScore(candidate, zoneMeans, rand) {
  const zoneScore = (id) => {
    const raw = candidate.metrics.zones[id].raw;
    return (
      WEIGHTS.flick * resample(raw.flick, rand) +
      WEIGHTS.micro * resample(raw.micro, rand) +
      WEIGHTS.track * resample(raw.track, rand)
    );
  };
  return (
    (0.6 * zoneScore('cone')) / (zoneMeans.cone || 1) +
    (0.4 * zoneScore('wide')) / (zoneMeans.wide || 1)
  );
}

export { ZONE_IDS, WEIGHTS };
