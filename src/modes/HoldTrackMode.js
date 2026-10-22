import * as THREE from '../three-shim.js';
import { TargetMotion } from '../core/TargetMotion.js';

/* Hold-tracking drill: one drifting target; keep the crosshair ON it while
   holding the mouse button. Score accrues per second held. The streak meter
   shows how long the current continuous hold is against your best hold, so
   you can see exactly how long you hung on before losing the target. */
const SESSION_SECONDS = 45;
const SCORE_PER_SECOND = 100;
const MIN_STREAK_SFX = 0.4;

export class HoldTrackMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.motion = null;
    this.timeLeft = SESSION_SECONDS;
    this.score = 0;
    this.streak = 0;        // seconds of the current continuous hold
    this.bestStreak = 0;    // longest continuous hold this session
    this.trackedTotal = 0;  // seconds on target across the whole session
    this.finished = false;
    this._raycaster = new THREE.Raycaster();
    this._center = { x: 0, y: 0 };
  }

  start() {
    this.spawnTarget();
    this._lastTick = performance.now();
  }

  spawnTarget() {
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(7),
      THREE.MathUtils.randFloat(1.2, 3.8),
      THREE.MathUtils.randFloat(8, 12)
    );
    const size = this.game.settings.targetSize || 0.4;
    this.target = this.game.pool.acquire(pos, size, 1);
    this.game.scene.scene.add(this.target.mesh);
    this.motion = new TargetMotion(1.4);
  }

  update(deltaMs = 16) {
    const dt = Math.min(0.05, deltaMs / 1000);

    if (this.timeLeft > 0 && !this.finished) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft === 0) {
        this.finished = true;
        return;
      }
    }

    if (!this.target || !this.target.active) return;
    this.motion.update(this.target.mesh.position, dt, this.game.settings.movementSpeed || 1);

    /* Keep the button held with the crosshair over the target to score time */
    this._raycaster.setFromCamera(this._center, this.game.camera.instance);
    const onTarget = this.game.input.primaryDown &&
      this._raycaster.intersectObject(this.target.mesh).length > 0;

    const material = this.target.mesh.material;
    if (onTarget) {
      if (this.streak === 0) this.game.audio.play('hit');
      this.streak += dt;
      this.trackedTotal += dt;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.score += dt * SCORE_PER_SECOND;
      material.emissiveIntensity = 3.2;
    } else {
      if (this.streak >= MIN_STREAK_SFX) this.game.audio.play('miss');
      this.streak = 0;
      material.emissiveIntensity = 0.9;
    }
  }

  /* Drives the HUD streak meter: current hold vs this session's best hold */
  trackMeter() {
    return { current: this.streak, best: this.bestStreak };
  }

  end() {
    if (this.target) {
      try { if (this.target.active) this.target.deactivate(); this.game.pool.release(this.target); } catch (e) {}
      this.target = null;
      this.motion = null;
    }
    return {
      score: Math.round(this.score),
      accuracy: (this.trackedTotal / SESSION_SECONDS) * 100,
      bestStreak: Math.round(this.bestStreak * 10) / 10,
      hits: Math.round(this.trackedTotal * 10) / 10,
      shots: SESSION_SECONDS,
      duration: SESSION_SECONDS * 1000
    };
  }
}
