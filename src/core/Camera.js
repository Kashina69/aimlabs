import * as THREE from '../three-shim.js';
import { Storage } from '../utils/Storage.js';

export class Camera {
  constructor() {
    this.instance = new THREE.PerspectiveCamera(
      90,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.instance.position.set(0, 1.6, 0);
    this.sensitivity = Storage.get('settings.sensitivity', 2.5);
    this.fov = Storage.get('settings.fov', 90);
    this.instance.fov = this.fov;
    this.instance.updateProjectionMatrix();
  }

  updateFOV(fov) {
    this.fov = fov;
    this.instance.fov = fov;
    this.instance.updateProjectionMatrix();
  }
}