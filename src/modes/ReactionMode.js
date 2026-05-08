import * as THREE from '../three-shim.js';

export class ReactionMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.score = 0; this.hits = 0; this.shots = 0;
    this.waiting = true;
  }

  start() {
    this.waiting = true;
    const delay = Math.random() * 2000 + 500;
    setTimeout(() => this.spawn(), delay);
    this.startTime = performance.now();
  }

  spawn() {
    this.waiting = false;
    const pos = new THREE.Vector3(THREE.MathUtils.randFloatSpread(6), THREE.MathUtils.randFloat(1,3), 8);
    this.target = this.game.pool.acquire(pos, this.game.settings.targetSize || 0.35, 1);
    this.game.scene.scene.add(this.target.mesh);
    this.spawnTime = performance.now();
  }

  update() {}

  onClick(intersects) {
    this.shots++;
    if (this.waiting) { this.game.audio.play('miss'); return; }
    if (!this.target) return;
    const hit = intersects.find(i => i.object === this.target.mesh);
    if (hit) {
      const rt = performance.now() - this.spawnTime;
      this.hits++;
      this.score += Math.max(0, 2000 - rt);
      this.game.audio.play('hit');
      this.target.deactivate();
      // spawn again after short delay
      setTimeout(() => { this.waiting = true; const d = Math.random()*2000+300; setTimeout(()=>this.spawn(), d); }, 400);
    } else {
      this.game.audio.play('miss');
    }
  }

  end() { return {score:this.score}; }
}
