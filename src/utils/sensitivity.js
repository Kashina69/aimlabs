/**
 * What: Conversions between sensitivity, mouse counts and 360-distance.
 * Why:  Every sensitivity feature (rail, HUD, finder, report) must agree on one
 *       definition of a full turn, and the finder needs an exact inverse.
 * How:  A full turn is `counts = 360 / (sensitivity * yaw)` mouse counts, where
 *       `yaw` is degrees per count at sensitivity 1. `cpi` is counts per inch:
 *       entered DPI, or the effective CPI measured from a physical 360 turn.
 */

/**
 * What: Mouse counts for a full turn at a given cm/360.
 * Why:  Bridges the physical distance and the count-based game scale.
 * How:  cm → inches → counts.
 */
export function countsPer360(cm360, cpi = 800) {
  return (Math.max(0.0001, Number(cm360) || 0) / 2.54) * Math.max(1, Number(cpi) || 800);
}

/**
 * What: cm of mouse travel for a full turn (the canonical conversion).
 * Why:  The one value that transfers between games and converters.
 * How:  counts = 360 / (sens × yaw); cm = counts / cpi × 2.54.
 */
export function cmPer360(sensitivity, cpi = 800, yaw = 0.0176) {
  const sens = Number(sensitivity);
  if (!(sens > 0) || !(yaw > 0)) return 0;
  const counts = 360 / (sens * yaw);
  return (counts / (Number(cpi) || 800)) * 2.54;
}

/** What: Inches for a full turn. Why: Some users and converters work in inches. How: cm / 2.54. */
export function inPer360(cm360Value) {
  return (Number(cm360Value) || 0) / 2.54;
}

/**
 * What: The game sensitivity that produces a given cm/360.
 * Why:  The finder plans candidates in cm space and must play them in game scale.
 * How:  Inverse of cmPer360 via countsPer360.
 */
export function sensitivityForCm360(cm360, cpi = 800, yaw = 0.0176) {
  const counts = countsPer360(cm360, cpi);
  if (!(counts > 0) || !(yaw > 0)) return 0;
  return 360 / (counts * yaw);
}

/**
 * What: cm/360 from a partial physical turn and its measured distance.
 * Why:  The player does not have to stop at exactly 360°; the angle is known.
 * How:  Scale the measured distance by 360 / degrees turned.
 */
export function cm360FromTurn(degreesTurned, measuredCm) {
  const degrees = Number(degreesTurned);
  const cm = Number(measuredCm);
  if (!(degrees > 0) || !(cm > 0)) return null;
  return (360 / degrees) * cm;
}

/**
 * What: Effective counts-per-inch from a physical turn.
 * Why:  This absorbs DPI, OS scaling, browser zoom and pointer-ballistics error.
 * How:  counts = degrees / (sens × yaw); cpi = counts / cm × 2.54.
 */
export function effectiveCpiFromTurn(degreesTurned, measuredCm, sensitivity, yaw) {
  const degrees = Number(degreesTurned);
  const cm = Number(measuredCm);
  const sens = Number(sensitivity);
  if (!(degrees > 0) || !(cm > 0) || !(sens > 0) || !(yaw > 0)) return null;
  const counts = degrees / (sens * yaw);
  return (counts / cm) * 2.54;
}

/**
 * What: Effective CPI implied by "my current sensitivity takes N cm for a full turn".
 * Why:  The setup field only asks for the measured distance, so the yaw is implied.
 * How:  Calls effectiveCpiFromTurn with a 360° turn.
 */
export function effectiveCpiFromDistance(measuredCm, sensitivity, yaw) {
  return effectiveCpiFromTurn(360, measuredCm, sensitivity, yaw);
}

/** What: Rounds to N decimals. Why: Storage convention. How: Scale, round, unscale. */
export function round(value, dp = 4) {
  const factor = 10 ** dp;
  return Math.round((Number(value) || 0) * factor) / factor;
}

/** What: Fixed-decimal text without locale separators. Why: Copy/paste must be converter-safe. How: toFixed. */
export function fixed(value, dp = 5) {
  return (Number(value) || 0).toFixed(dp);
}
