import * as THREE from '../three-shim.js';
import { PALETTE } from './palette.js';

/* Target sphere geometry is created once and reused; size changes apply a
   scale instead of rebuilding geometry, which avoids mesh/memory churn. */
const BASE_RADIUS = 0.3;
const SHARED_GEOMETRY = new THREE.SphereGeometry(BASE_RADIUS, 32, 20);
const SPAWN_MS = 90;
const BODY_GLOW = 0.75;
const FOCUS_GLOW = 1.15;
/* Diffuse albedo is a dim copy of the colour: lights give the ball its shading,
   emissive carries the hue, and skipping tone mapping keeps the hue pure */
const ALBEDO_SCALE = 0.28;

/* The player's chosen target colour; every newly spawned target picks it up */
const currentColor = new THREE.Color(PALETTE.signal);

export function setTargetColor(color) {
  currentColor.set(color);
}

export function getTargetColor() {
  return currentColor;
}

/* Target material: matte body in the target colour plus a fresnel rim, so a target
   reads as a solid ball from any angle instead of a flat glowing disc.
   One shared program (customProgramCacheKey) even though each target owns its
   material, because each target fades its own opacity. */
export function createTargetMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: currentColor.clone().multiplyScalar(ALBEDO_SCALE),
    emissive: currentColor.clone(),
    emissiveIntensity: BODY_GLOW,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 1,
    toneMapped: false
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimFactor = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
      totalEmissiveRadiance += emissive * pow(rimFactor, 2.6) * 0.55;`
    );
  };
  material.customProgramCacheKey = () => 'target-rim-v2';
  return material;
}

export class Target {
  constructor() {
    this.mesh = new THREE.Mesh(SHARED_GEOMETRY, createTargetMaterial());
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.active = false;
    this.spawning = false;
  }

  init(position, size = 0.3, health = 1) {
    this.mesh.position.copy(position);
    this.fullScale = size / BASE_RADIUS;
    this.mesh.scale.setScalar(this.fullScale * 0.8);
    this.mesh.visible = true;
    /* Pool-reused targets must come back pristine (pop animations recolor them) */
    const material = this.mesh.material;
    material.color.copy(currentColor).multiplyScalar(ALBEDO_SCALE);
    material.emissive.copy(currentColor);
    material.emissiveIntensity = BODY_GLOW;
    material.opacity = 1;
    this.bornAt = performance.now();
    this.spawning = true;
    this.focused = false;
    this.size = size;
    this.health = health;
    this.maxHealth = health;
    // attach back-reference so raycast hits can map to target objects reliably
    this.mesh.userData.target = this;
  }

  /* Spawn settle: 80% -> 100% scale over 90ms ease-out, so targets arrive instead of popping in */
  updateSpawn(now) {
    if (!this.spawning) return;
    const progress = Math.min(1, (now - this.bornAt) / SPAWN_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    this.mesh.scale.setScalar(this.fullScale * (0.8 + 0.2 * eased));
    if (progress >= 1) this.spawning = false;
  }

  /* Tracking feedback: the target brightens while the crosshair is on it */
  setFocus(focused) {
    if (this.focused === focused) return;
    this.focused = focused;
    this.mesh.material.emissiveIntensity = focused ? FOCUS_GLOW : BODY_GLOW;
  }

  takeDamage(damage = 1) {
    this.health -= damage;
    return this.health <= 0;
  }

  deactivate() {
    this.mesh.visible = false;
    this.active = false;
    this.spawning = false;
  }
}
