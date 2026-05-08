import * as THREE from '../three-shim.js';

export class StaticMode {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;
    this.maxCombo = 0;
  }

  start() {
    // release any existing targets and spawn fresh
    if (this.game.pool && this.game.pool.active) {
      for (const t of Array.from(this.game.pool.active)) this.game.pool.release(t);
    }
    this._timers = [];
    this.spawnTarget();
  }

  spawnTarget() {
    const size = this.game.settings.targetSize;
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloat(0, 5),
      THREE.MathUtils.randFloat(5, 12)
    );
    const target = this.game.pool.acquire(pos, size, 1);
    this.game.scene.scene.add(target.mesh);
    this.targets.push(target);
  }

  update() {
    this.targets = this.targets.filter(t => {
      if (!t.active) {
        this.game.pool.release(t);
        this.spawnTarget();
        return false;
      }
      return true;
    });
  }

  onClick(intersects) {
    let hit = false;
    for (const i of intersects) {
      const target = this.targets.find(t => t.mesh === i.object);
      if (target) {
        const isDead = target.takeDamage();
        if (isDead) {
          target.deactivate();
          this.game.audio.play('hit');
          this.hits++;
          this.shots++;
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.score += 100 * this.combo;
          if (this.combo > 1) this.game.audio.play('combo');
        }
        hit = true;
        break;
      }
    }

    if (!hit) {
      this.game.audio.play('miss');
      this.shots++;
      this.combo = 0;
    }
  }

  end() {
    // release targets and clear timers
    for (const t of Array.from(this.targets || [])) {
      try { if (t.active) t.deactivate(); this.game.pool.release(t); } catch(e){}
    }
    (this._timers || []).forEach(id => clearTimeout(id));
    return {
      accuracy: this.shots > 0 ? (this.hits / this.shots) * 100 : 0,
      score: this.score,
      maxCombo: this.maxCombo,
      hits: this.hits,
      shots: this.shots
    };
  }
}