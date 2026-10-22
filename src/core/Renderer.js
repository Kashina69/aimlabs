import * as THREE from '../three-shim.js';
import { PALETTE } from './palette.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';

/* Owns the WebGL canvas. Quality presets change pixel ratio, shadows and whether
   frames go through the bloom composer (High only) or straight to the screen. */
export class Renderer {
  constructor() {
    const container = document.getElementById('container');
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.tabIndex = 0; // make focusable for pointer lock
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(PALETTE.bg);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true; // hand meshes are clipped at the wrist

    this.composer = null;
    this.quality = null;
    this.overlay = null;
  }

  /* A second scene drawn on top with depth cleared (the gun viewmodel) */
  setOverlay(scene, camera) {
    this.overlay = { scene, camera };
  }

  /* Applies a preset from Quality.js; scene is needed to refresh materials when shadows toggle */
  applyQuality(quality, scene, camera) {
    const shadowsChanged = this.quality && this.quality.shadows !== quality.shadows;
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.renderer.shadowMap.enabled = quality.shadows;
    if (shadowsChanged) {
      scene.traverse((object) => {
        if (object.material) object.material.needsUpdate = true;
      });
    }

    if (quality.bloom && !this.composer) this.buildComposer(scene, camera);
    if (!quality.bloom) this.disposeComposer();
    this.setSize(window.innerWidth, window.innerHeight);
  }

  buildComposer(scene, camera) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    if (this.overlay) {
      const overlayPass = new RenderPass(this.overlay.scene, this.overlay.camera);
      overlayPass.clear = false;
      overlayPass.clearDepth = true;
      this.composer.addPass(overlayPass);
    }
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  disposeComposer() {
    if (!this.composer) return;
    this.composer.dispose();
    this.composer = null;
    this.bloomPass = null;
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  render(scene, camera) {
    if (this.composer) {
      this.composer.render();
      return;
    }
    const gl = this.renderer;
    gl.autoClear = false;
    gl.clear();
    gl.render(scene, camera);
    if (this.overlay) {
      gl.clearDepth();
      gl.render(this.overlay.scene, this.overlay.camera);
    }
  }
}
