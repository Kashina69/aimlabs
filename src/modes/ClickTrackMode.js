import * as THREE from '../three-shim.js';
import { TargetMotion } from '../core/TargetMotion.js';

/* Click-drill on a moving target: one strafing target, click it with the
   crosshair; it respawns after every hit. Motion comes from TargetMotion so
   speed rises and falls gradually — no instant halts or direction snaps. */
export class ClickTrackMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.motion = null;
    this.score = 0; this.hits = 0; this.shots = 0; this.combo = 0;
    this.maxCombo = 0;
  }

  start() {
    this.spawnTarget();
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
    if (!this.motion) this.motion = new TargetMotion(1.4);
  }

  update(deltaMs = 16) {
    if (!this.target || !this.target.active) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.motion.update(this.target.mesh.position, dt, this.game.settings.movementSpeed || 1);
  }

  onClick(intersects) {
    this.shots++;
    for (const i of intersects) {
      if (i.object === this.target.mesh) {
        const target = this.target;
        target.deactivate();
        this.game.pool.release(target);
        this.target = null;
        this.hits++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 150 * this.combo;
        this.game.audio.play('hit');
        this.spawnTarget();
        return;
      }
    }
    this.combo = 0;
    this.game.audio.play('miss');
  }

  end() {
    if (this.target) {
      try { if (this.target.active) this.target.deactivate(); this.game.pool.release(this.target); } catch (e) {}
      this.target = null;
      this.motion = null;
    }
    return {
      score: this.score,
      accuracy: this.shots ? (this.hits / this.shots) * 100 : 0,
      maxCombo: this.maxCombo
    };
  }
}
