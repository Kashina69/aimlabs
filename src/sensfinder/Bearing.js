import * as THREE from '../three-shim.js';

/**
 * What: Angular aim measurement for the sensitivity finder.
 * Why:  Every metric must be dimensionless and comparable across target sizes, and
 *       the error must have a genuine minimum so the bracket has something to find.
 * How:  Errors are measured in TARGET RADII and split into a signed radial part
 *       (>0 past the target = overshoot) and a tangential part. Tracking samples
 *       split the error along the target's motion (lag) from everything across it
 *       (jitter). Module-level scratch vectors keep the tracking path allocation-free.
 */

const aim = new THREE.Vector3();
const camPos = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const tangentA = new THREE.Vector3();
const flick = new THREE.Vector3();
const error = new THREE.Vector3();
const scratch = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * What: The camera's world position and forward direction at this instant.
 * Why:  A trial's flick origin is where the crosshair actually sat when the target
 *       appeared, not where it was expected to be.
 * How:  Copies both values out so the caller owns them for the trial.
 */
export function readCameraBasis(camera) {
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(aim);
  return { position: camPos.clone(), direction: aim.clone() };
}

/**
 * What: Measures one click against a target and fills `out` in target radii.
 * Why:  The scoring needs a signed overshoot/undershoot signal, not just hit/miss.
 * How:  Computes the angular error, the target's angular radius, then projects the
 *       aim error onto the flick direction (radial) and its perpendicular (tangent).
 *       Returns false for a degenerate target instead of writing garbage.
 */
export function measureShotInto(out, camera, targetPos, worldRadius, originDir) {
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(aim);

  toTarget.copy(targetPos).sub(camPos);
  const distance = toTarget.length();
  if (distance < 0.001) return false;
  toTarget.divideScalar(distance);

  const angRad = Math.atan(Math.max(0.0001, worldRadius) / distance);
  const angleRad = Math.acos(THREE.MathUtils.clamp(aim.dot(toTarget), -1, 1));

  tangentA.crossVectors(WORLD_UP, toTarget);
  if (tangentA.lengthSq() < 1e-8) tangentA.set(1, 0, 0);
  tangentA.normalize();

  flick.copy(toTarget).sub(originDir);
  flick.addScaledVector(toTarget, -flick.dot(toTarget));
  if (flick.lengthSq() < 1e-8) flick.copy(tangentA);
  flick.normalize();

  error.copy(aim).sub(toTarget);
  error.addScaledVector(toTarget, -error.dot(toTarget));

  out.radial = error.dot(flick) / angRad;
  scratch.crossVectors(toTarget, flick).normalize();
  out.tangent = error.dot(scratch) / angRad;
  out.radii = angleRad / Math.max(1e-6, angRad);
  out.angRad = angRad;
  out.distance = distance;
  out.angleDeg = THREE.MathUtils.radToDeg(angleRad);
  return true;
}

/**
 * What: Convenience wrapper that allocates a result object (clicks only, never per frame).
 * Why:  Keeps tests and callers that do not care about reuse readable.
 * How:  Delegates to `measureShotInto`.
 */
export function measureShot(camera, targetPos, worldRadius, originDir) {
  const out = {};
  return measureShotInto(out, camera, targetPos, worldRadius, originDir) ? out : null;
}

/**
 * What: Samples the tracking error and fills `out` with lag and jitter in radii.
 * Why:  Runs every frame, so it must not allocate; the split tells us whether the
 *       player is trailing the target (a low-sensitivity symptom) or shaking on it.
 * How:  Projects the error along the target's motion direction (along) and across it.
 */
export function measureTrackingInto(out, camera, targetPos, previousPos, worldRadius) {
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(aim);

  toTarget.copy(targetPos).sub(camPos);
  const distance = toTarget.length();
  if (distance < 0.001) return false;
  toTarget.divideScalar(distance);
  const angRad = Math.atan(Math.max(0.0001, worldRadius) / distance);

  tangentA.crossVectors(WORLD_UP, toTarget);
  if (tangentA.lengthSq() < 1e-8) tangentA.set(1, 0, 0);
  tangentA.normalize();

  flick.copy(targetPos).sub(previousPos);
  flick.addScaledVector(toTarget, -flick.dot(toTarget));
  out.moving = flick.lengthSq() > 1e-8;
  if (!out.moving) flick.copy(tangentA);
  flick.normalize();

  error.copy(aim).sub(toTarget);
  error.addScaledVector(toTarget, -error.dot(toTarget));

  out.along = error.dot(flick) / angRad;
  scratch.crossVectors(toTarget, flick).normalize();
  out.across = error.dot(scratch) / angRad;
  out.angRad = angRad;
  return true;
}
