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

  spawn() {
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(10),
      THREE.MathUtils.randFloat(0, 4),
      THREE.MathUtils.randFloat(5, 20)
    );
    const size = this.game.settings.targetSize || 0.2;
    const t = this.game.pool.acquire(pos, size, 1);
    this.game.scene.scene.add(t.mesh);
    this.targets.push(t);
    // short lifetime
    setTimeout(() => {
      if (t.active) { t.deactivate(); }
    }, Math.max(400, 1200 - (this.game.settings.spawnSpeed || 0) * 200));
  }

  update() {
    // refill targets to keep only 1 at a time
    this.targets = this.targets.filter(t => t.active);
    if (this.targets.length === 0) this.spawn();
  }

  onClick(intersects) {
    this.shots++;
    let hit = false;
    for (const i of intersects) {
      const target = this.targets.find(t => t.mesh === i.object);
      if (target) {
        target.deactivate();
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
    return { accuracy: this.shots ? (this.hits / this.shots) * 100 : 0, score: this.score };
  }
}
