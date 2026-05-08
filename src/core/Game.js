import { Camera } from './Camera.js';
import * as THREE from '../three-shim.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';
import { GameScene } from './Scene.js';
import { Pool } from './Pool.js';
import { Target } from './Target.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Storage } from '../utils/Storage.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { Settings } from '../ui/Settings.js';
import { StatsUI } from '../ui/Stats.js';
import { StatsManager } from '../utils/StatsManager.js';
import { OverlayManager } from '../ui/OverlayManager.js';
import { loadSelectableModes } from './ModeRegistry.js';

export class Game {
  constructor() {
    this.container = document.getElementById('container');
    this.uiRoot = document.getElementById('ui-root');
    this.crosshair = document.getElementById('crosshair');

    this.camera = new Camera();
    this.renderer = new Renderer();
    this.input = new Input(this.renderer.canvas);
    this.scene = new GameScene();
    this.audio = new AudioManager();
    this.pool = new Pool(
      () => new Target(),
      (target) => {
        target.deactivate();
        this.scene.scene.remove(target.mesh);
      }
    );

    this.settings = this.loadSettings();
    this.currentMode = null;
    this.currentModeName = null;
    this.isRunning = false;
    this.sessionStart = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = 0;
    this.uiTimers = [];

    this.initUI();
    try {
      window.game = this;
    } catch (error) {
      // no-op
    }
  }

  /* What/why/how: Build persistent UI layers once so mode/menu switches do not destroy HUD elements. */
  initUI() {
    this.uiRoot.innerHTML = '';
    this.persistentLayer = document.createElement('div');
    this.persistentLayer.id = 'ui-persistent';
    this.overlayLayer = document.createElement('div');
    this.overlayLayer.id = 'ui-overlay';
    this.uiRoot.appendChild(this.persistentLayer);
    this.uiRoot.appendChild(this.overlayLayer);
    this.overlay = new OverlayManager(this.overlayLayer);

    this.crosshair.style.display = 'none';
    this.createWeaponFeedbackUI();
  }

  createWeaponFeedbackUI() {
    this.gunEl = document.createElement('div');
    this.gunEl.id = 'gun-hud';
    this.gunEl.style.cssText = 'position:absolute; left:50%; bottom:6%; transform:translateX(-50%); width:140px; height:60px; pointer-events:none; z-index:9998;';
    this.gunEl.innerHTML = '<div id="gun-bar" style="width:100px;height:24px;background:linear-gradient(#222,#111);margin:0 auto;border-radius:6px;box-shadow:0 0 10px rgba(0,255,255,0.08);"></div>';
    this.persistentLayer.appendChild(this.gunEl);

    this.gunSprite = document.createElement('div');
    this.gunSprite.id = 'gun-sprite';
    this.gunSprite.style.cssText = 'position:absolute; left:50%; bottom:4%; transform:translateX(-50%); width:220px; height:120px; pointer-events:none; z-index:9997;';
    this.gunSprite.innerHTML = '<div class="gun-body"></div>';
    this.persistentLayer.appendChild(this.gunSprite);

    this.muzzle = document.createElement('div');
    this.muzzle.id = 'muzzle-flash';
    this.muzzle.style.cssText = 'position:absolute; left:50%; bottom:18%; transform:translateX(-50%); width:60px; height:60px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,200,0,0.6) 40%, transparent 60%); mix-blend-mode:screen; opacity:0; pointer-events:none; z-index:9999;';
    this.persistentLayer.appendChild(this.muzzle);

    this.hitMarker = document.createElement('div');
    this.hitMarker.id = 'hit-marker';
    this.hitMarker.style.cssText = 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:140px; height:140px; border-radius:50%; border:2px solid rgba(0,255,255,0.0); pointer-events:none; transition:all 0.12s ease; z-index:10000;';
    this.persistentLayer.appendChild(this.hitMarker);
  }

  loadSettings() {
    return {
      sensitivity: Storage.get('settings.sensitivity', 2.5),
      fov: Storage.get('settings.fov', 90),
      crosshair: Storage.get('settings.crosshair', { size: 6, color: '#0ff', thickness: 1, dot: false }),
      volume: Storage.get('settings.volume', 0.7),
      graphics: Storage.get('settings.graphics', 'medium'),
      targetSize: Storage.get('settings.targetSize', 0.3),
      spawnSpeed: Storage.get('settings.spawnSpeed', 1),
      movementSpeed: Storage.get('settings.movementSpeed', 1),
      invertY: Storage.get('settings.invertY', false)
    };
  }

  init() {
    this.bindEvents();
    this.hud = new HUD(this.persistentLayer, this);
    this.showMainMenu(false);
    this.applySettings();
    this.animate(0);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.instance.aspect = window.innerWidth / window.innerHeight;
      this.camera.instance.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('keydown', (event) => this.handleGlobalKeydown(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning) this.pause();
    });

    this.renderer.canvas.addEventListener('mousedown', () => {
      if (!this.isRunning || !this.input.isLocked) return;
      this.shootAtCrosshair();
    });
  }

  handleGlobalKeydown(event) {
    if (event.code === 'Escape') {
      if (this.overlay.activeOverlay) {
        this.overlay.close();
        return;
      }
      if (this.isRunning) this.pause();
      return;
    }

    if (event.code === 'KeyR') this.restart();
    if (event.code === 'BracketLeft') this.adjustSensitivityBy(-0.05);
    if (event.code === 'BracketRight') this.adjustSensitivityBy(0.05);
  }

  adjustSensitivityBy(delta) {
    this.settings.sensitivity = Math.max(0.01, Math.min(12, this.settings.sensitivity + delta));
    Storage.set('settings.sensitivity', this.settings.sensitivity);
  }

  shootAtCrosshair() {
    if (!this.currentMode) return;
    this.audio.play('shoot');
    this.playShotAnimation();

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera.instance);
    const visibleMeshes = this.pool.objects.map((target) => target.mesh).filter((mesh) => mesh.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes);
    const hit = intersects.length > 0;
    this.currentMode.onClick(hit ? intersects : []);
    this.triggerHitFeedback(hit);
  }

  playShotAnimation() {
    this.muzzle.style.opacity = '1';
    this.muzzle.style.transform = 'translateX(-50%) scale(1.1)';
    this.gunEl.querySelector('#gun-bar').style.transform = 'translateY(-6px) scaleX(0.98)';

    this.queueUITimer(() => {
      this.muzzle.style.opacity = '0';
      this.muzzle.style.transform = 'translateX(-50%) scale(0.8)';
      this.gunEl.querySelector('#gun-bar').style.transform = '';
    }, 100);
  }

  triggerHitFeedback(hit) {
    this.hitMarker.classList.add(hit ? 'hit' : 'miss');
    this.queueUITimer(() => {
      this.hitMarker.classList.remove('hit');
      this.hitMarker.classList.remove('miss');
    }, 160);
  }

  queueUITimer(fn, delay) {
    const timerId = setTimeout(() => {
      this.uiTimers = this.uiTimers.filter((id) => id !== timerId);
      fn();
    }, delay);
    this.uiTimers.push(timerId);
  }

  clearUITimers() {
    this.uiTimers.forEach((timerId) => clearTimeout(timerId));
    this.uiTimers = [];
  }

  showMainMenu(showResume) {
    const menu = new Menu(document.createElement('div'), this, { showResume });
    this.overlay.show(menu.element);
  }

  endCurrentModeAndSaveSession() {
    if (!this.currentMode) return;
    try {
      const summary = this.currentMode.end?.();
      if (summary) {
        StatsManager.push({
          mode: this.currentModeName || this.currentMode.constructor.name,
          start: this.sessionStart || Date.now(),
          end: Date.now(),
          ...summary
        });
      }
    } catch (error) {
      console.warn('Mode end failed', error);
    }
  }

  clearActiveTargets() {
    for (const target of Array.from(this.pool.active)) {
      this.pool.release(target);
    }
  }

  startMode(ModeClass, modeName = 'Unknown') {
    this.endCurrentModeAndSaveSession();
    this.clearActiveTargets();
    this.overlay.close();
    this.clearUITimers();

    this.currentMode = new ModeClass(this);
    this.currentModeName = modeName;
    this.currentMode.start();
    this.sessionStart = Date.now();
    this.isRunning = true;
    this.crosshair.style.display = 'block';

    try {
      this.renderer.canvas.requestPointerLock();
    } catch (error) {
      // no-op
    }
  }

  async showModeSelect() {
    const modal = document.createElement('div');
    modal.className = 'glass';
    modal.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); padding:20px;';
    modal.innerHTML = '<h3 class="neon-text">Select Mode</h3>';

    const modes = await loadSelectableModes();
    for (const [name, ModeClass] of Object.entries(modes)) {
      const button = document.createElement('button');
      button.className = 'btn';
      button.textContent = name;
      button.onclick = () => {
        this.audio.play('click');
        this.startMode(ModeClass, name);
      };
      modal.appendChild(button);
    }

    modal.appendChild(this.buildDifficultySettingsSection());
    this.overlay.show(modal);
  }

  /* What/why/how: Keep difficulty controls in one reusable panel so mode tuning is consistent and persisted. */
  buildDifficultySettingsSection() {
    const panel = document.createElement('div');
    panel.style.marginTop = '12px';
    panel.innerHTML = `
      <div style="margin-top:6px">Target size: <input id="targetSize" type="range" min="0.01" max="2" step="0.01" value="${this.settings.targetSize}"> <input id="targetSizeVal" type="number" step="0.01" value="${this.settings.targetSize}" style="width:72px; margin-left:8px"></div>
      <div>Spawn speed: <input id="spawnSpeed" type="range" min="0" max="5" step="0.01" value="${this.settings.spawnSpeed}"> <input id="spawnSpeedVal" type="number" step="0.01" value="${this.settings.spawnSpeed}" style="width:72px; margin-left:8px"></div>
      <div>Movement speed: <input id="moveSpeed" type="range" min="0" max="3" step="0.01" value="${this.settings.movementSpeed}"> <input id="moveSpeedVal" type="number" step="0.01" value="${this.settings.movementSpeed}" style="width:72px; margin-left:8px"></div>
      <div style="font-size:12px; opacity:.8; margin-top:8px;">Quick sensitivity: '[' and ']'</div>
    `;

    this.bindRangeAndNumber(panel, 'targetSize', 'targetSizeVal', 'targetSize');
    this.bindRangeAndNumber(panel, 'spawnSpeed', 'spawnSpeedVal', 'spawnSpeed');
    this.bindRangeAndNumber(panel, 'moveSpeed', 'moveSpeedVal', 'movementSpeed');
    return panel;
  }

  bindRangeAndNumber(panel, rangeId, numberId, settingKey) {
    const rangeInput = panel.querySelector(`#${rangeId}`);
    const numberInput = panel.querySelector(`#${numberId}`);
    const syncValue = (raw) => {
      const value = parseFloat(raw);
      if (Number.isNaN(value)) return;
      rangeInput.value = value;
      numberInput.value = value;
      this.settings[settingKey] = value;
      Storage.set(`settings.${settingKey}`, value);
    };
    rangeInput.addEventListener('input', (event) => syncValue(event.target.value));
    numberInput.addEventListener('change', (event) => syncValue(event.target.value));
  }

  pause() {
    this.isRunning = false;
    this.input.unlock();
    this.crosshair.style.display = 'none';
    this.showMainMenu(true);
  }

  resume() {
    if (!this.currentMode) return;
    this.overlay.close();
    this.isRunning = true;
    this.crosshair.style.display = 'block';
    try {
      this.renderer.canvas.requestPointerLock();
    } catch (error) {
      // no-op
    }
  }

  restart() {
    if (!this.currentMode) return;
    const ModeClass = this.currentMode.constructor;
    const name = this.currentModeName || ModeClass.name;
    this.startMode(ModeClass, name);
  }

  animate(time) {
    requestAnimationFrame((nextTime) => this.animate(nextTime));
    this.updateFPSCounter(time);

    if (this.isRunning && this.input.isLocked && this.currentMode) {
      this.updateCameraFromMouse();
      this.currentMode.update();
      this.updateHUD();
    }

    this.renderer.render(this.scene.scene, this.camera.instance);
  }

  updateFPSCounter(time) {
    this.frameCount += 1;
    if (time - this.lastTime < 1000) return;
    this.fps = this.frameCount;
    this.frameCount = 0;
    this.lastTime = time;
  }

  updateCameraFromMouse() {
    const sensitivityMultiplier = this.settings.sensitivity * 0.002;
    const dx = this.input.mouse.x * sensitivityMultiplier;
    const dy = this.input.mouse.y * sensitivityMultiplier * (this.settings.invertY ? 1 : -1);
    this.camera.instance.rotation.y -= dx;
    this.camera.instance.rotation.x -= dy;
    this.camera.instance.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.instance.rotation.x));
    this.input.mouse.x = 0;
    this.input.mouse.y = 0;
  }

  updateHUD() {
    const shots = this.currentMode.shots || 0;
    const hits = this.currentMode.hits || 0;
    this.hud.update({
      score: this.currentMode.score || 0,
      accuracy: shots > 0 ? (hits / shots) * 100 : 0,
      combo: this.currentMode.combo || 0
    });
    this.hud.setFPS(this.fps);
  }

  applySettings() {
    this.camera.updateFOV(this.settings.fov);
    const crosshair = this.settings.crosshair;
    this.crosshair.style.width = `${crosshair.dot ? 2 : crosshair.size}px`;
    this.crosshair.style.height = `${crosshair.dot ? 2 : crosshair.size}px`;
    this.crosshair.style.border = crosshair.dot ? 'none' : `${crosshair.thickness}px solid ${crosshair.color}`;
    this.crosshair.style.backgroundColor = crosshair.dot ? crosshair.color : 'transparent';
    this.crosshair.classList.toggle('dot', crosshair.dot);
    this.audio.setVolume(this.settings.volume);
  }

  showSettings() {
    const settingsModal = new Settings(document.createElement('div'), this);
    this.overlay.show(settingsModal.el);
  }

  showStats() {
    const statsModal = new StatsUI(document.createElement('div'), this);
    this.overlay.show(statsModal.el);
  }
}
