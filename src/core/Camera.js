import * as THREE from '../three-shim.js';
import { Storage } from '../utils/Storage.js';

/* Horizontal look window targets spawn at +Z, so the player faces that way.
   MAX_YAW defines a 180 degree total horizontal view (90 degrees to each side). */
const MAX_YAW_OFFSET = Math.PI / 2;   // 90 deg either side of the target wall => 180 total
const MAX_PITCH = (82 * Math.PI) / 180; // ~164 deg total vertical view, can't stare at floor/sky

export class Camera {
  constructor() {
    this.instance = new THREE.PerspectiveCamera(
      90,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    /* YXZ order keeps yaw and pitch independent, which makes clamping behave like an FPS */
    this.instance.rotation.order = 'YXZ';
    this.instance.position.set(0, 1.6, 0);

    this.sensitivity = Storage.get('settings.sensitivity', 2.5);
    this.maxYawOffset = MAX_YAW_OFFSET;
    this.maxPitch = MAX_PITCH;
    this.reset();

    this.fov = Storage.get('settings.fov', 90);
    this.instance.fov = this.fov;
    this.instance.updateProjectionMatrix();
  }

  /* Snap the view back to looking straight at the target wall (+Z) at eye height */
  reset() {
    this.instance.rotation.set(0, 0, 0);
    this.instance.rotation.y = Math.PI;
    this.instance.rotation.x = 0;
  }

  clampRotation() {
    const rotation = this.instance.rotation;
    rotation.y = Math.max(Math.PI - this.maxYawOffset, Math.min(Math.PI + this.maxYawOffset, rotation.y));
    rotation.x = Math.max(-this.maxPitch, Math.min(this.maxPitch, rotation.x));
  }

  updateFOV(fov) {
    this.fov = fov;
    this.instance.fov = fov;
    this.instance.updateProjectionMatrix();
  }
}
