import * as THREE from '../three-shim.js';
import { tickSessionClock } from './sessionClock.js';

/* Reflex drill: after an unknowable delay (max 3s) one ball appears and
   immediately starts aging away. Hit it for a reaction-time score; let it
   vanish and you must wait for the next. Higher difficulty shortens the
   response window. */
const MAX_SPAWN_DELAY_MS = 3000;
const MIN_SPAWN_DELAY_MS = 500;
const SESSION_SECONDS = 30;

export class ReactionMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.reactionTimes = [];
    this.waiting = true;
    this.timeLeft = SESSION_SECONDS;
    this._timers = [];
  }

  start() {
    this.waiting = true;
    this.scheduleSpawn(MIN_SPAWN_DELAY_MS, MAX_SPAWN_DELAY_MS);
  }

  scheduleSpawn(minDelay = 400, maxDelay = MAX_SPAWN_DELAY_MS) {
    this.waiting = true;
    const delay = THREE.MathUtils.randFloat(minDelay, maxDelay);
    const id = setTimeout(() => this.spawn(), delay);
    this._timers.push(id);
  }

  spawn() {
    this.waiting = false;
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(6),
      THREE.MathUtils.randFloat(1, 3.5),
      8
    );
    this.target = this.game.pool.acquire(pos, this.game.settings.targetSize || 0.35, 1);
    this.game.scene.scene.add(this.target.mesh);
    this.target.spawnedAt = performance.now();
    /* Difficulty: faster spawn speed = less time on screen before it vanishes */
    this.target.lifeMs = Math.max(500, 1800 - (this.game.settings.spawnSpeed || 0) * 250);
    this.spawnTime = performance.now();
  }

  clearTarget() {
    if (this.target) {
      this.target.deactivate();
      this.game.pool.release(this.target);
      this.target = null;
    }
  }

  update(deltaMs = 16) {
    if (tickSessionClock(this, deltaMs)) return;
    if (this.waiting || !this.target || !this.target.active) return;
    if (performance.now() - this.target.spawnedAt >= this.target.lifeMs) {
      /* Ball faded out unanswered: combo resets and the drill moves on */
      this.game.audio.play('miss');
      this.combo = 0;
      this.clearTarget();
      this.scheduleSpawn(500, 1600);
    }
  }

  onClick(intersects) {
    if (this.finished) return;
    this.shots++;

    const hit = !this.waiting && this.target && intersects.find(i => i.object === this.target.mesh);
    if (!hit) {
      /* Includes early shots while waiting for the ball to spawn */
      this.combo = 0;
      this.game.audio.play('miss');
      return;
    }

    const reactionMs = performance.now() - this.spawnTime;
    this.reactionTimes.push(reactionMs);
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += Math.max(100, Math.round(2000 - reactionMs));
    this.game.audio.play('hit');

    this.clearTarget();
    this.scheduleSpawn(300, 1600);
  }

  end() {
    (this._timers || []).forEach(id => clearTimeout(id));
    this._timers = [];
    this.clearTarget();
    const avg = this.reactionTimes.length
      ? this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length
      : 0;
    return {
      score: this.score,
      accuracy: this.shots ? (this.hits / this.shots) * 100 : 0,
      hits: this.hits,
      shots: this.shots,
      maxCombo: this.maxCombo,
      avgReaction: Math.round(avg),
      bestReaction: this.reactionTimes.length ? Math.round(Math.min(...this.reactionTimes)) : 0,
      duration: SESSION_SECONDS * 1000
    };
  }
}
