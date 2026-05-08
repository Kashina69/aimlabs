import * as THREE from '../three-shim.js';

export class ReactionMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.score = 0; this.hits = 0; this.shots = 0;
    this.waiting = true;
    this._timers = [];
  }

  start() {
    this.waiting = true;
    const delay = Math.random() * 2000 + 500;
    const id = setTimeout(() => this.spawn(), delay);
    this._timers.push(id);
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
      this.game.pool.release(this.target);
      // spawn again after short delay
      const id = setTimeout(() => { this.waiting = true; const d = Math.random()*2000+300; const id2 = setTimeout(()=>this.spawn(), d); this._timers.push(id2); }, 400);
      this._timers.push(id);
    } else {
      this.game.audio.play('miss');
    }
  }

  end() {
    (this._timers || []).forEach(id => clearTimeout(id));
    this._timers = [];
    if (this.target) {
      try { if (this.target.active) this.target.deactivate(); this.game.pool.release(this.target); } catch(e){}
      this.target = null;
    }
    return {score:this.score, hits:this.hits, shots:this.shots};
  }
}
