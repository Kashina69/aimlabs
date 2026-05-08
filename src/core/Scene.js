import * as THREE from '../three-shim.js';

export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000011, 20, 50);

    // Add ambient glow
    const light = new THREE.AmbientLight(0x222222);
    this.scene.add(light);

    // Grid floor
    const grid = new THREE.GridHelper(20, 20, 0x0088ff, 0x004488);
    grid.position.y = -0.5;
    this.scene.add(grid);
  }

  resize(width, height) {
    // Handle resize
  }
}