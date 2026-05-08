import * as THREE from '../three-shim.js';

export class Target {
  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.9
      })
    );
    this.mesh.frustumCulled = false;
    this.active = false;
  }

  init(position, size = 0.3, health = 1) {
    this.mesh.position.copy(position);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.visible = true;
    this.size = size;
    this.health = health;
    this.maxHealth = health;
    this.mesh.geometry = new THREE.SphereGeometry(size, 16, 16);
  }

  takeDamage(damage = 1) {
    this.health -= damage;
    return this.health <= 0;
  }

  deactivate() {
    this.mesh.visible = false;
    this.active = false;
  }
}