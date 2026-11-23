import { tickSessionClock } from './sessionClock.js';
import { ZONES, positionFor, randomSpawnSpec, zoneCameraLimits } from './spawnZones.js';
import { mulberry32 } from '../utils/rng.js';

/**
 * What: Cone 45 — a short pre-game warm-up restricted to the central 45 degrees.
 * Why:  Real fights are short corrections, not corner-to-corner spins. This drills
 *       the flicks that actually happen, with small far targets.
 * How:  Two concurrent pooled targets spawn inside the cone while the camera is
 *       clamped to it. Hits score Flick-style (100 × combo), so Stats and records
 *       work unchanged. The clamp is restored in `end()` on every exit path.
 */

const SESSION_SECONDS = 60;
const CONCURRENT = 2;
const BASE_LIFE_MS = 1900;
const MIN_LIFE_MS = 950;

export class ConeMode {
  constructor(game) {
    this.game = game;
    this.zone = ZONES.cone;
    this.savedLimits = { yaw: game.camera.maxYawOffset, pitch: game.camera.maxPitch };
    this.targets = [];
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.timeLeft = SESSION_SECONDS;
    this.rand = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
  }

  /**
   * What: Starts the drill: clamp the camera, recenter, spawn the first targets.
   * Why:  The cone must be in force before the first target can be faked.
   * How:  Applies the zone limits, resets the view to the anchor, fills the pool.
   */
  start() {
    this.applyLimits();
    this.game.camera.reset();
    this.timeLeft = SESSION_SECONDS;
    while (this.targets.length < CONCURRENT) this.spawnTarget();
  }

  /**
   * What: Restricts yaw/pitch to the cone for the duration of the drill.
   * Why:  A warm-up that lets you spin away stops being a 45° drill.
   * How:  Writes the zone's clamp values onto the camera.
   */
  applyLimits() {
    const limits = zoneCameraLimits(this.zone);
    this.game.camera.maxYawOffset = limits.yaw;
    this.game.camera.maxPitch = limits.pitch;
  }

  /**
   * What: Puts the camera limits back the way they were.
   * Why:  A leak here would silently narrow every later drill.
   * How:  Restores the values captured in the constructor.
   */
  restoreLimits() {
    this.game.camera.maxYawOffset = this.savedLimits.yaw;
    this.game.camera.maxPitch = this.savedLimits.pitch;
  }

  /* Difficulty still matters, but the cone keeps its small-and-far identity */
  targetSize() {
    const scale = (this.game.settings.targetSize || 0.3) / 0.3;
    return Math.max(0.12, Math.min(0.24, this.zone.targetSize * scale));
  }

  lifeMs() {
    return Math.max(MIN_LIFE_MS, BASE_LIFE_MS - (this.game.settings.spawnSpeed || 0) * 220);
  }

  /**
   * What: Spawns one target inside the cone.
   * Why:  The warm-up needs a steady supply of small, far, reachable targets.
   * How:  Builds a random cone spec, resolves its world position, and acquires a
   *       pooled target with a timestamped lifetime.
   */
  spawnTarget() {
    const micro = this.rand() < 0.34;
    const spec = randomSpawnSpec(this.zone, this.rand, { micro });
    const position = positionFor(this.zone, spec);
    const target = this.game.pool.acquire(position, this.targetSize(), 1);
    this.game.scene.scene.add(target.mesh);
    target.spawnedAt = performance.now();
    target.lifeMs = this.lifeMs();
    this.targets.push(target);
  }

  /**
   * What: Reaps expired targets and keeps two alive.
   * Why:  Lifetimes must be timestamp-based so a recycled pool instance cannot be
   *       killed by a stale timer.
   * How:  Compares `spawnedAt + lifeMs` against now, then refills.
   */
  update(deltaMs = 16) {
    if (tickSessionClock(this, deltaMs)) return;
    const now = performance.now();
    const alive = [];
    for (const target of this.targets) {
      if (!target.active) continue;
      if (now - target.spawnedAt >= target.lifeMs) {
        try {
          target.deactivate();
          this.game.pool.release(target);
        } catch (error) {
          // pool already reclaimed it
        }
        continue;
      }
      alive.push(target);
    }
    this.targets = alive;
    while (this.targets.length < CONCURRENT) this.spawnTarget();
  }

  /**
   * What: Scores a hit against the live targets.
   * Why:  Hits must resolve the same frame and the combo must drive the score.
   * How:  Finds the struck target, releases it, adds 100 × combo, spawns a replacement.
   */
  onClick(intersects) {
    if (this.finished) return;
    this.shots += 1;
    for (const hit of intersects) {
      const target = this.targets.find((candidate) => candidate.mesh === hit.object);
      if (!target) continue;
      this.hits += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += 100 * this.combo;
      this.game.audio.play('hit');
      if (this.combo > 1) this.game.audio.play('combo');
      this.targets = this.targets.filter((candidate) => candidate !== target);
      try {
        target.deactivate();
        this.game.pool.release(target);
      } catch (error) {
        // pool already reclaimed it
      }
      this.spawnTarget();
      return;
    }
    this.combo = 0;
    this.game.audio.play('miss');
  }

  /**
   * What: Ends the drill, releases everything, restores the camera.
   * Why:  Safe exit on finish, quit and restart; Stats reads the returned summary.
   * How:  Releases pooled targets first, then restores limits.
   */
  end() {
    for (const target of Array.from(this.targets)) {
      try {
        if (target.active) target.deactivate();
        this.game.pool.release(target);
      } catch (error) {
        // pool already reclaimed it
      }
    }
    this.targets = [];
    this.restoreLimits();
    return {
      accuracy: this.shots ? (this.hits / this.shots) * 100 : 0,
      score: this.score,
      hits: this.hits,
      shots: this.shots,
      maxCombo: this.maxCombo,
      duration: SESSION_SECONDS * 1000
    };
  }
}
