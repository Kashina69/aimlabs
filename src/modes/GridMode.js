import * as THREE from '../three-shim.js';

export class GridMode {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.score = 0; this.hits = 0; this.shots = 0; this.combo = 0;
  }

  start() {
    this.spawnGrid();
  }

  spawnGrid() {
    const cols = 4; const rows = 3;
    for (let x = -cols; x <= cols; x += 2) {
      for (let y = 1; y <= rows; y++) {
        const pos = new THREE.Vector3(x * 1.5, y * 0.9, 8);
        const t = this.game.pool.acquire(pos, this.game.settings.targetSize || 0.4, 1);
        this.game.scene.scene.add(t.mesh);
        this.targets.push(t);
      }
    }
  }

  update() {
    this.targets = this.targets.filter(t => t.active);
  }

  onClick(intersects) {
    this.shots++;
    for (const i of intersects) {
      const target = this.targets.find(t => t.mesh === i.object);
      if (target) {
        target.deactivate();
        this.hits++; this.combo++; this.score += 50 * this.combo;
        this.game.audio.play('hit');
        return;
      }
    }
    this.combo = 0; this.game.audio.play('miss');
  }

  end() { return { score: this.score, accuracy: this.shots ? (this.hits/this.shots)*100 : 0 } }
}
