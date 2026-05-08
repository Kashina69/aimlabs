import * as THREE from '../three-shim.js';

export class TrackingMode {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.score = 0; this.hits = 0; this.shots = 0; this.combo = 0;
    this.speed = this.game.settings.movementSpeed || 0.02;
  }

  start() {
    this.spawnTarget();
    this.vx = 0.03; this.vy = 0.015;
  }

  /* What/why/how: Always respawn a target after a hit so tracking mode remains continuous. */
  spawnTarget() {
    const pos = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(4),
      THREE.MathUtils.randFloat(1, 3.5),
      THREE.MathUtils.randFloat(8, 12)
    );
    this.target = this.game.pool.acquire(pos, this.game.settings.targetSize || 0.4, 1);
    this.game.scene.scene.add(this.target.mesh);
  }

  update() {
    if (!this.target || !this.target.active) return;
    this.target.mesh.position.x += this.vx * (this.game.settings.movementSpeed || 1);
    this.target.mesh.position.y += this.vy * (this.game.settings.movementSpeed || 1);
    if (this.target.mesh.position.x > 6 || this.target.mesh.position.x < -6) this.vx *= -1;
    if (this.target.mesh.position.y > 4 || this.target.mesh.position.y < 0.5) this.vy *= -1;
  }

  onClick(intersects) {
    this.shots++;
    for (const i of intersects) {
      if (i.object === this.target.mesh) {
        this.hits++; this.combo++; this.score += 150 * this.combo; this.game.audio.play('hit');
        this.target.deactivate();
        this.game.pool.release(this.target);
        this.target = null;
        this.spawnTarget();
        return;
      }
    }
    this.combo = 0; this.game.audio.play('miss');
  }

  end() {
    if (this.target) {
      try { if (this.target.active) this.target.deactivate(); this.game.pool.release(this.target); } catch(e){}
      this.target = null;
    }
    return {score:this.score, accuracy: this.shots? (this.hits/this.shots)*100:0};
  }
}
