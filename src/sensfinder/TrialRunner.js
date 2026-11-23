import * as THREE from '../three-shim.js';
import { measureShotInto, measureTrackingInto, readCameraBasis } from './Bearing.js';
import { positionFor, trackingPositionAt } from '../modes/spawnZones.js';

/**
 * What: Runs exactly one flick or tracking trial against a pooled target.
 * Why:  Target lifetime, click measurement and release are one responsibility; the
 *       mode should orchestrate rounds, not manage pool objects.
 * How:  `beginFlick`/`beginTracking` acquire a target and a trial record; `update`
 *       advances and resolves it; `click` measures a shot. Each trial resolves into
 *       a small summary the mode folds into the candidate's zone data.
 */

const CORRECTION_WINDOW_MS = 900;
const MAX_SHOTS_PER_TRIAL = 6;

export class TrialRunner {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.trial = null;
    this.trackPos = new THREE.Vector3();
    this.trackSample = { along: 0, across: 0, angRad: 0, moving: false };
    this.shotSample = { radial: 0, tangent: 0, radii: 0, angRad: 0, distance: 0, angleDeg: 0 };
  }

  get kind() {
    return this.trial?.kind || null;
  }

  /**
   * What: Acquires a target at the planned flick position and opens the trial.
   * Why:  The flick origin must be captured the instant the target appears.
   * How:  Builds the world position, acquires from the pool, records the camera basis.
   */
  beginFlick(zone, spec, clock) {
    const position = positionFor(zone, spec);
    this.target = this.game.pool.acquire(position, zone.targetSize, 1);
    this.game.scene.scene.add(this.target.mesh);
    this.trial = {
      kind: 'flick',
      zone,
      spec,
      position,
      originDir: readCameraBasis(this.game.camera.instance).direction,
      spawnedAt: clock,
      liveUntil: clock + zone.lifeMs,
      shots: []
    };
  }

  /**
   * What: Acquires the tracking target at the start of the zone's arc.
   * Why:  Every candidate must follow the same path, and the first sample needs a
   *       previous position so the motion direction is meaningful.
   * How:  Samples progress 0 into a scratch vector, acquires, and clones it once.
   */
  beginTracking(zone, durationMs, clock) {
    trackingPositionAt(zone, 0, this.trackPos);
    this.target = this.game.pool.acquire(this.trackPos, zone.targetSize, 1);
    this.game.scene.scene.add(this.target.mesh);
    this.trial = {
      kind: 'track',
      zone,
      spawnedAt: clock,
      prevPos: this.trackPos.clone(),
      duration: durationMs,
      trackSum: 0,
      trackCount: 0
    };
  }

  /**
   * What: Advances a live trial and resolves it on timeout or completion.
   * Why:  Lifetimes are clock-based; tracking must move and be sampled every frame.
   * How:  Flicks check their clock. Tracking samples the precomputed arc into a
   *       scratch vector, measures without allocating, and accumulates a mean.
   * Returns the resolution summary, or null while the trial is still live.
   */
  update(clock) {
    if (!this.trial) return null;
    if (!this.target?.active) return this.resolve();

    if (this.trial.kind === 'flick') {
      return clock >= this.trial.liveUntil ? this.resolve() : null;
    }

    const progress = Math.min(1, (clock - this.trial.spawnedAt) / this.trial.duration);
    trackingPositionAt(this.trial.zone, progress, this.trackPos);
    this.target.mesh.position.copy(this.trackPos);

    if (measureTrackingInto(this.trackSample, this.game.camera.instance, this.trackPos, this.trial.prevPos, this.trial.zone.targetSize)) {
      this.trial.trackSum += this.trackSample.along * this.trackSample.along + this.trackSample.across * this.trackSample.across;
      this.trial.trackCount += 1;
    }
    this.trial.prevPos.copy(this.trackPos);
    return progress >= 1 ? this.resolve() : null;
  }

  /**
   * What: Measures a click against the live flick target.
   * Why:  The mode needs to score/audio it and decide when a miss window is spent.
   * How:  Reuses the shot scratch object; returns hit data, or null for no target.
   */
  click(clock) {
    if (!this.trial || this.trial.kind !== 'flick' || !this.target?.active) return null;
    const radius = this.target.mesh.scale.x * 0.3;
    if (!measureShotInto(this.shotSample, this.game.camera.instance, this.trial.position, radius, this.trial.originDir)) {
      return null;
    }

    const { radial, tangent, radii } = this.shotSample;
    const hit = radii < 1;
    this.trial.shots.push({
      kind: this.trial.spec.micro ? 'micro' : 'flick',
      err2: radial * radial + tangent * tangent,
      radial,
      tangent,
      hit,
      ttf: clock - this.trial.spawnedAt,
      t: clock
    });

    if (!hit && this.trial.shots.length === 1) {
      this.trial.liveUntil = Math.min(this.trial.liveUntil, clock + CORRECTION_WINDOW_MS);
    }
    return {
      hit,
      forceResolve: this.trial.shots.length >= MAX_SHOTS_PER_TRIAL
    };
  }

  /**
   * What: Closes the current trial and returns its summary.
   * Why:  Scoring needs one correction value or one tracking mean per trial.
   * How:  Reads the recorded shots/accumulators, releases the target, clears the trial.
   */
  resolve() {
    const trial = this.trial;
    this.release();
    this.trial = null;
    if (!trial) return null;

    if (trial.kind === 'flick') {
      const first = trial.shots[0];
      const firstHit = trial.shots.find((shot) => shot.hit);
      return {
        kind: 'flick',
        shots: trial.shots,
        correction: first ? (first.hit ? 0 : firstHit ? firstHit.t - first.t : CORRECTION_WINDOW_MS) : null
      };
    }
    return {
      kind: 'track',
      mean: trial.trackCount > 0 ? trial.trackSum / trial.trackCount : null
    };
  }

  /**
   * What: Returns the pooled target to the pool.
   * Why:  Every kill, timeout and quit must release exactly once.
   * How:  Deactivates first, then releases, tolerating an already-reclaimed object.
   */
  release() {
    const target = this.target;
    this.target = null;
    if (!target) return;
    try {
      if (target.active) target.deactivate();
      this.game.pool.release(target);
    } catch (error) {
      // pool already reclaimed it
    }
  }
}
