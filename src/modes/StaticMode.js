import * as THREE from '../three-shim.js';

/* Gridshot-style drill: several targets visible at once, each fading in then
   fading out on its own clock. Hit a target before it fully fades and it pops
   instantly; the clock counts down one session, and the score reflects how
   hard you can flick and still land clicks. */
const CONCURRENT_TARGETS = 4;
const SESSION_SECONDS = 60;
const FADE_IN_MS = 220;
const FADE_OUT_MS = 700;
const BASE_LIFETIME_MS = 2600;
const POP_MS = 110;

export class StaticMode {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.corpses = []; // popped targets playing their brief kill animation
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.timeLeft = SESSION_SECONDS;
    this._lastTick = performance.now();
  }

  start() {
    this._lastTick = performance.now();
    this.timeLeft = SESSION_SECONDS;
    for (let i = 0; i < CONCURRENT_TARGETS; i++) {
      this.spawnTarget();
    }
  }

  /* Targets spawn inside the room bounds so they are always reachable
     inside the camera's 180 degree look window */
  spawnRandomPosition() {
    return new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloat(0.7, 4.5),
      THREE.MathUtils.randFloat(5, 13)
    );
  }

  spawnTarget() {
    const size = this.game.settings.targetSize;
    const target = this.game.pool.acquire(this.spawnRandomPosition(), size, 1);
    this.game.scene.scene.add(target.mesh);
    /* Lifetime shortens as spawn difficulty rises so higher difficulty = snappier windows */
    target.spawnedAt = performance.now();
    target.lifeMs = Math.max(900, BASE_LIFETIME_MS - (this.game.settings.spawnSpeed || 0) * 300);
    this.targets.push(target);
  }

  replaceTarget(target) {
    this.releaseTarget(target);
    this.spawnTarget();
  }

  releaseTarget(target) {
    target.deactivate();
    this.game.pool.release(target);
    this.targets = this.targets.filter(t => t !== target);
    this.corpses = this.corpses.filter(t => t !== target);
  }

  /* Kills are instantaneous: the live target leaves the playable set the same
     frame it is hit. Its mesh stays ~100ms as a cosmetic white pop-flash so
     the kill reads on screen, then the pool takes it back. */
  killTarget(target) {
    this.targets = this.targets.filter(t => t !== target);
    target.popAt = performance.now();
    target.baseScale = target.mesh.scale.x;
    const material = target.mesh.material;
    material.color.set(0xffffff);
    material.emissive.set(0xffffff);
    material.emissiveIntensity = 4;
    material.opacity = 1;
    this.corpses.push(target);
    this.spawnTarget();
  }

  animateCorpses(now) {
    for (const corpse of Array.from(this.corpses)) {
      const progress = (now - corpse.popAt) / POP_MS;
      if (progress >= 1) {
        corpse.deactivate();
        this.game.pool.release(corpse);
        this.corpses = this.corpses.filter(t => t !== corpse);
        continue;
      }
      corpse.mesh.scale.setScalar(corpse.baseScale * (1 + progress * 0.9));
      corpse.mesh.material.opacity = 1 - progress;
      corpse.mesh.material.emissiveIntensity = 4 - 3 * progress;
    }
  }

  /* Fade in on spawn, hold, then fade out over the last stretch of life */
  applyTargetFade(target, ageMs) {
    const material = target.mesh.material;
    let opacity = 1;
    if (ageMs < FADE_IN_MS) {
      opacity = ageMs / FADE_IN_MS;
    } else {
      const fadeOutStart = target.lifeMs - FADE_OUT_MS;
      if (ageMs > fadeOutStart) {
        opacity = Math.max(0, 1 - (ageMs - fadeOutStart) / FADE_OUT_MS);
      }
    }
    material.opacity = opacity;
  }

  update(deltaMs = 16) {
    if (this.timeLeft > 0 && !this.finished) {
      this.timeLeft = Math.max(0, this.timeLeft - deltaMs / 1000);
      if (this.timeLeft === 0) {
        this.finishSession();
        return;
      }
    }

    const now = performance.now();
    this.animateCorpses(now);

    /* Expired targets vanish (no score penalty, combo survives) and are replaced */
    for (const target of Array.from(this.targets)) {
      const age = now - target.spawnedAt;
      if (age >= target.lifeMs) {
        this.replaceTarget(target);
        continue;
      }
      this.applyTargetFade(target, age);
    }
  }

  onClick(intersects) {
    if (this.finished) return;
    this.shots++;

    let hit = false;
    for (const i of intersects) {
      const target = this.targets.find(t => t.mesh === i.object);
      if (target) {
        this.hits++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 100 * this.combo;
        this.game.audio.play('hit');
        if (this.combo > 1) this.game.audio.play('combo');
        this.killTarget(target);
        hit = true;
        break;
      }
    }

    if (!hit) {
      this.combo = 0;
      this.game.audio.play('miss');
    }
  }

  finishSession() {
    this.finished = true;
  }

  end() {
    for (const target of Array.from(this.targets)) {
      try { this.releaseTarget(target); } catch (e) {}
    }
    for (const corpse of Array.from(this.corpses)) {
      try { corpse.deactivate(); this.game.pool.release(corpse); } catch (e) {}
    }
    this.corpses = [];
    return {
      accuracy: this.shots > 0 ? (this.hits / this.shots) * 100 : 0,
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.hits,
      shots: this.shots,
      duration: SESSION_SECONDS * 1000
    };
  }
}
