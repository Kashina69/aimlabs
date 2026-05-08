import * as THREE from '../three-shim.js';

export class StrafingMode {
  constructor(game) {
    this.game = game; this.targets = []; this.score=0; this.hits=0; this.shots=0; this.combo=0;
  }

  start() { this.spawnMany(); }

  spawnMany() {
    for (let i=0;i<3;i++) {
      const pos = new THREE.Vector3(THREE.MathUtils.randFloat(-6,6), THREE.MathUtils.randFloat(1,3), 9 + i*2);
      const t = this.game.pool.acquire(pos, this.game.settings.targetSize || 0.35,1);
      t.vx = (Math.random()*0.06+0.02) * (Math.random()<0.5?-1:1);
      this.game.scene.scene.add(t.mesh);
      this.targets.push(t);
    }
  }

  update() {
    this.targets = this.targets.filter(t => t.active);
    for (const t of this.targets) {
      t.mesh.position.x += t.vx * (this.game.settings.movementSpeed || 1);
      if (t.mesh.position.x > 8 || t.mesh.position.x < -8) t.vx *= -1;
    }
    if (this.targets.length < 3) this.spawnMany();
  }

  onClick(intersects) {
    this.shots++;
    for (const i of intersects) {
      const target = this.targets.find(t=>t.mesh === i.object);
      if (target) { target.deactivate(); this.hits++; this.combo++; this.score+=120*this.combo; this.game.audio.play('hit'); return; }
    }
    this.combo=0; this.game.audio.play('miss');
  }

  end() { return {score:this.score, accuracy: this.shots? (this.hits/this.shots)*100:0}; }
}
