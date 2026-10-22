import * as THREE from '../three-shim.js';

/* Target sphere geometry is created once and reused; size changes apply a
   scale instead of rebuilding geometry, which avoids mesh/memory churn. */
const BASE_RADIUS = 0.3;

export class Target {
  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BASE_RADIUS, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.0,
        transparent: true,
        opacity: 1
      })
    );
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.active = false;
  }

  init(position, size = 0.3, health = 1) {
    this.mesh.position.copy(position);
    const scale = size / BASE_RADIUS;
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.visible = true;
    /* Pool-reused targets must come back pristine (pop animations recolor them) */
    const material = this.mesh.material;
    material.color.set(0x00ffff);
    material.emissive.set(0x00ffff);
    material.emissiveIntensity = 0.9;
    material.opacity = 1;
    this.size = size;
    this.health = health;
    this.maxHealth = health;
    // attach back-reference so raycast hits can map to target objects reliably
    this.mesh.userData.target = this;
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
