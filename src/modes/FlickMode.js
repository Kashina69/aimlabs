import * as THREE from '../three-shim.js';

export class FlickMode {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;
  }

  start() {
    this.spawn();
  }

  /* Timestamp-based lifetime instead of setTimeout: the pool reuses object
     instances, so timers scheduled on a killed target would later fire and
     prematurely kill the NEW target that got that same instance (the "target
     appears 0.1s then vanishes" cycle after a couple of shots). */
  spawn() {
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloat(0.7, 4.2),
      THREE.MathUtils.randFloat(5, 13)
    );
    const size = this.game.settings.targetSize || 0.2;
    const t = this.game.pool.acquire(pos, size, 1);
    this.game.scene.scene.add(t.mesh);
    t.spawnedAt = performance.now();
    t.lifeMs = Math.max(400, 1200 - (this.game.settings.spawnSpeed || 0) * 200);
    this.targets.push(t);
  }

  update() {
    const now = performance.now();
    const alive = [];
    for (const t of this.targets) {
      if (!t.active) continue;
      if (now - t.spawnedAt >= t.lifeMs) {
        try { t.deactivate(); this.game.pool.release(t); } catch (e) {}
        continue;
      }
      alive.push(t);
    }
    this.targets = alive;
    // refill targets to keep only 1 at a time
    if (this.targets.length === 0) this.spawn();
  }

  onClick(intersects) {
    this.shots++;
    let hit = false;
    for (const i of intersects) {
      const target = this.targets.find(t => t.mesh === i.object);
      if (target) {
        target.deactivate();
        this.game.pool.release(target);
        this.hits++;
        this.combo++;
        this.score += 100 * this.combo;
        this.game.audio.play('hit');
        hit = true;
        break;
      }
    }
    if (!hit) { this.combo = 0; this.game.audio.play('miss'); }
  }

  end() {
    for (const t of Array.from(this.targets || [])) {
      try { if (t.active) t.deactivate(); this.game.pool.release(t); } catch(e){}
    }
    return { accuracy: this.shots ? (this.hits / this.shots) * 100 : 0, score: this.score };
  }
}
