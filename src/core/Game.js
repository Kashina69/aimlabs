import { Camera } from './Camera.js';
import * as THREE from '../three-shim.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';
import { GameScene } from './Scene.js';
import { Pool } from './Pool.js';
import { Target } from './Target.js';
import { Weapon } from './Weapon.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Storage } from '../utils/Storage.js';
import { Menu } from '../ui/Menu.js';
import { HUD } from '../ui/HUD.js';
import { Settings } from '../ui/Settings.js';
import { StatsUI } from '../ui/Stats.js';
import { StatsManager } from '../utils/StatsManager.js';
import { OverlayManager } from '../ui/OverlayManager.js';
import { buildCrosshairSVG, mergeCrosshairConfig } from '../ui/Crosshair.js';
import { loadSelectableModes } from './ModeRegistry.js';

/* Marvel Rivals (UE5) yaw constant: degrees turned per mouse count per
   sensitivity point. Using it 1:1 lets you paste the exact MR sens value
   and get the identical turn speed (browser movementX px ≈ mouse counts). */
const MARVEL_RIVALS_YAW_DEG = 0.0176;

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

    /* Weapon lives on the camera, and the camera must be in the scene for it to render */
    this.scene.scene.add(this.camera.instance);
    this.weapon = new Weapon(this.camera.instance);
    this.lastFrameTime = 0;

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
      volume: Storage.get('audio.volume', 0.7),
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
    this.setInGameUI(false);
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

    /* Losing pointer lock mid-session (Esc key is often swallowed by the browser)
       must pause instead of leaving a frozen "running but unlocked" state */
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.isRunning) this.pause();
    });

    this.renderer.canvas.addEventListener('mousedown', () => {
      if (!this.isRunning || !this.input.isLocked) return;
      this.shootAtCrosshair();
    });
  }

  /* Escape is the single "get me somewhere sane" key:
     - pause menu open + session exists -> resume (Escape toggles pause, like any FPS)
     - other modal open  -> close it and land somewhere usable (menu when paused)
     - running           -> pause (shows main menu)
     - idle              -> open settings so Escape always does something useful */
  handleGlobalKeydown(event) {
    if (event.code === 'Escape') {
      if (this.input.isLocked && !this.isRunning) {
        this.input.unlock();
      }
      if (this.overlay.activeOverlay) {
        if (this.overlay.activeOverlay.id === 'main-menu' && this.currentMode) {
          this.resume();
          return;
        }
        this.overlay.close();
        if (!this.isRunning) this.showMainMenu(!!this.currentMode);
        return;
      }
      if (this.isRunning) {
        this.pause();
        return;
      }
      this.showSettings();
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
    /* Raycast live targets (pool.active), NOT pool.objects — that array is the
       free stack, so active targets are not in it and shots land on nothing. */
    const visibleMeshes = Array.from(this.pool.active)
      .map((target) => target.mesh)
      .filter((mesh) => mesh.visible && mesh.userData.target);
    const intersects = raycaster.intersectObjects(visibleMeshes);
    const hit = intersects.length > 0;
    this.currentMode.onClick(intersects);
    this.triggerHitFeedback(hit);
  }

  playShotAnimation() {
    this.weapon.shoot();
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

  /* Toggles the in-game-only UI (crosshair + HUD) together so menus stay clean */
  setInGameUI(visible) {
    this.crosshair.style.display = visible ? 'block' : 'none';
    const display = visible ? 'block' : 'none';
    if (this.hud) this.hud.element.style.display = display;
  }

  showMainMenu(showResume) {
    const menu = new Menu(document.createElement('div'), this, { showResume });
    this.overlay.show(menu.element);
  }

  endCurrentModeAndSaveSession() {
    if (!this.currentMode) return null;
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
      return summary;
    } catch (error) {
      console.warn('Mode end failed', error);
      return null;
    }
  }

  /* Called when a mode signals `finished` (session timer expired).
     Saves stats, tears the session down and shows the results modal. */
  endSession() {
    if (!this.currentMode) return;
    const ModeClass = this.currentMode.constructor;
    const modeName = this.currentModeName || ModeClass.name;
    const summary = { name: modeName, ...this.endCurrentModeAndSaveSession() };

    this.isRunning = false;
    this.input.lockEnabled = false;
    this.input.unlock();
    this.setInGameUI(false);
    this.clearActiveTargets();
    this.clearUITimers();
    this.audio.play('complete');
    this.showSummary(summary, ModeClass, modeName);
  }

  /* Results screen shown after every completed session */
  showSummary(summary, ModeClass, modeName) {
    const modal = document.createElement('div');
    modal.className = 'glass';
    modal.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); padding:24px; min-width:320px; text-align:center;';
    modal.innerHTML = `
      <h3 class="neon-text">${summary.name} Complete</h3>
      <div style="text-align:left; margin: 12px 0; line-height:1.7;">
        <div>Score: <strong>${Math.round(summary.score || 0)}</strong></div>
        <div>Accuracy: <strong>${(summary.accuracy || 0).toFixed(1)}%</strong> (${summary.hits || 0}/${summary.shots || 0})</div>
        ${summary.maxCombo !== undefined ? `<div>Best combo: <strong>${summary.maxCombo}</strong></div>` : ''}
        ${summary.avgReaction !== undefined ? `<div>Avg reaction: <strong>${summary.avgReaction}ms</strong> (best ${summary.bestReaction || '-'}ms)</div>` : ''}
      </div>
    `;

    const retry = document.createElement('button');
    retry.className = 'btn';
    retry.textContent = 'Retry';
    retry.onclick = () => {
      this.audio.play('click');
      this.startMode(ModeClass, modeName);
    };
    const menu = document.createElement('button');
    menu.className = 'btn';
    menu.textContent = 'Main Menu';
    menu.onclick = () => {
      this.audio.play('click');
      this.overlay.close();
      this.showMainMenu(false);
    };
    modal.appendChild(retry);
    modal.appendChild(menu);

    this.overlay.show(modal);
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
    this.setInGameUI(true);

    /* Fresh session starts with the view centered on the target wall */
    this.camera.reset();
    this.input.lockEnabled = true;

    try {
      const request = this.renderer.canvas.requestPointerLock();
      if (request?.catch) request.catch(() => {});
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
    this.input.lockEnabled = false;
    this.input.unlock();
    this.setInGameUI(false);
    this.showMainMenu(true);
  }

  resume() {
    if (!this.currentMode) return;
    this.overlay.close();
    this.isRunning = true;
    this.input.lockEnabled = true;
    this.setInGameUI(true);
    try {
      const request = this.renderer.canvas.requestPointerLock();
      if (request?.catch) request.catch(() => {});
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

    /* Weapon recoil/sway runs every frame, even when the game is paused */
    const dt = Math.min(0.05, (time - this.lastFrameTime) / 1000 || 0);
    this.lastFrameTime = time;
    this.weapon.update(dt);

    this.updateFPSCounter(time);

    if (this.isRunning && this.input.isLocked && this.currentMode) {
      this.updateCameraFromMouse();
      const deltaMs = Math.min(50, dt * 1000);
      this.currentMode.update(deltaMs);

      /* A mode can declare the session over (e.g. time ran out) */
      if (this.currentMode.finished) {
        this.endSession();
      } else {
        this.updateHUD();
      }
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

  /* Applies accumulated mouse deltas with clamped look angles:
     180 degrees horizontal facing the target wall, ~164 degrees vertical.
     Sensitivity follows the Marvel Rivals scale (0.0176 deg per count),
     so numbers from Marvel Rivals transfer 1:1. invertY only flips pitch. */
  updateCameraFromMouse() {
    const radiansPerPx = this.settings.sensitivity * MARVEL_RIVALS_YAW_DEG * (Math.PI / 180);
    const dx = this.input.mouse.x * radiansPerPx;
    const dy = this.input.mouse.y * radiansPerPx * (this.settings.invertY ? -1 : 1);

    this.camera.instance.rotation.y -= dx;
    this.camera.instance.rotation.x -= dy;
    this.camera.clampRotation();

    this.weapon.sway(dx, dy);
    this.input.mouse.x = 0;
    this.input.mouse.y = 0;
  }

  updateHUD() {
    const shots = this.currentMode.shots || 0;
    const hits = this.currentMode.hits || 0;
    this.hud.update({
      score: this.currentMode.score || 0,
      accuracy: shots > 0 ? (hits / shots) * 100 : 0,
      combo: this.currentMode.combo || 0,
      timeLeft: this.currentMode.timeLeft
    });
    this.hud.setFPS(this.fps);
  }

  applySettings() {
    this.camera.updateFOV(this.settings.fov);
    this.applyCrosshair();
    this.audio.setVolume(this.settings.volume);
  }

  /* Renders the configured crosshair into the DOM overlay element */
  applyCrosshair() {
    this.crosshair.innerHTML = buildCrosshairSVG(mergeCrosshairConfig(this.settings.crosshair));
  }

  /* Any modal close while idle must land back on the main menu, never an empty screen */
  closeOverlayToMenu() {
    this.overlay.close();
    this.showMainMenu(!!this.currentMode);
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
