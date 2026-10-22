import * as THREE from '../three-shim.js';
import { Camera } from './Camera.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';
import { GameScene } from './Scene.js';
import { Pool } from './Pool.js';
import { Target, setTargetColor } from './Target.js';
import { Weapon } from './Weapon.js';
import { getQuality } from './Quality.js';
import { targetColorHex } from './palette.js';
import { loadSelectableModes } from './ModeRegistry.js';
import { Shards } from '../fx/Shards.js';
import { MissMarks } from '../fx/MissMarks.js';
import { MenuPreview } from '../fx/MenuPreview.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Storage } from '../utils/Storage.js';
import { StatsManager } from '../utils/StatsManager.js';
import { bestFor } from '../utils/records.js';
import { DIFFICULTY_PRESETS } from '../modes/catalog.js';
import { HUD } from '../ui/HUD.js';
import { SettingsDrawer } from '../ui/Settings.js';
import { StatsPage } from '../ui/Stats.js';
import { OverlayManager } from '../ui/OverlayManager.js';
import { HomeScreen } from '../ui/screens/Home.js';
import { createPauseScreen } from '../ui/screens/Pause.js';
import { createResultsScreen } from '../ui/screens/Results.js';
import { createLockPrompt, createCountdown, createDeviceGate } from '../ui/screens/Prompts.js';
import { buildCrosshairSVG, mergeCrosshairConfig } from '../ui/Crosshair.js';

/* Marvel Rivals (UE5) yaw constant: degrees turned per mouse count per
   sensitivity point. Using it 1:1 lets you paste the exact MR sens value
   and get the identical turn speed (browser movementX px ≈ mouse counts). */
const MARVEL_RIVALS_YAW_DEG = 0.0176;
const COUNTDOWN_STEP_MS = 400;
const LOCK_PROMPT_DELAY_MS = 250;
const SHOT_LOG_LIMIT = 400;
const SCREEN_CENTER = new THREE.Vector2(0, 0);

/* Session phases (this.phase):
   idle      home / stats, no drill
   arming    drill created, waiting for pointer lock (lock prompt may show)
   countdown 3-2-1 while locked, targets not spawned yet
   live      playing
   resuming  unpausing a live drill, waiting for pointer lock again
   paused    pause sheet open, drill frozen
   results   results screen, drill finished and saved */
export class Game {
  constructor() {
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

    /* The gun renders as an overlay pass with its own camera; the world camera is
       added to the range scene so the shot light parented to it renders */
    this.scene.scene.add(this.camera.instance);
    this.weapon = new Weapon();
    this.weapon.initEnvironment(this.renderer.renderer);
    this.weapon.attachRoomLight(this.camera.instance);
    this.renderer.setOverlay(this.weapon.scene, this.weapon.camera);
    this.shards = new Shards(this.scene.scene, this.camera.instance);
    this.missMarks = new MissMarks(this.scene.scene);
    this.preview = new MenuPreview(this.scene.scene, this.shards);
    this.raycaster = new THREE.Raycaster();

    this.settings = this.loadSettings();
    this.modes = {};
    this.phase = 'idle';
    this.currentMode = null;
    this.currentModeName = null;
    this.lastModeName = null;
    this.session = null;
    this.settingsDrawer = null;
    this.home = null;

    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsTime = 0;
    this.lastFrameTime = 0;

    this.initLayers();
    try {
      window.game = this;
    } catch (error) {
      // no-op
    }
  }

  /* ---------- Setup ---------- */

  /* UI layers, bottom to top: HUD, overlay (one screen at a time), settings drawer, prompts */
  initLayers() {
    this.uiRoot.innerHTML = '';
    const layer = (id) => {
      const el = document.createElement('div');
      el.id = id;
      this.uiRoot.appendChild(el);
      return el;
    };
    this.persistentLayer = layer('ui-persistent');
    this.overlayLayer = layer('ui-overlay');
    this.drawerLayer = layer('ui-drawer');
    this.promptLayer = layer('ui-prompt');
    this.overlay = new OverlayManager(this.overlayLayer);
    this.crosshair.style.display = 'none';
  }

  loadSettings() {
    return {
      sensitivity: Storage.get('settings.sensitivity', 2.5),
      dpi: Storage.get('settings.dpi', 800),
      fov: Storage.get('settings.fov', 103),
      invertY: Storage.get('settings.invertY', false),
      crosshair: Storage.get('settings.crosshair', null),
      volume: Storage.get('audio.volume', 0.7),
      hitSound: Storage.get('audio.hitSound', 'tick'),
      graphics: Storage.get('settings.graphics', 'medium'),
      showWeapon: Storage.get('settings.showWeapon', true),
      showMeta: Storage.get('settings.showMeta', true),
      targetColor: Storage.get('settings.targetColor', 'lime'),
      difficulty: Storage.get('settings.difficulty', 'normal'),
      targetSize: Storage.get('settings.targetSize', 0.3),
      spawnSpeed: Storage.get('settings.spawnSpeed', 1),
      movementSpeed: Storage.get('settings.movementSpeed', 1)
    };
  }

  async init() {
    this.bindEvents();
    this.hud = new HUD(this.persistentLayer, this);
    this.applySettings();
    requestAnimationFrame((time) => this.animate(time));

    if (isTouchOnlyDevice()) {
      this.overlay.show(createDeviceGate());
      return;
    }
    this.modes = await loadSelectableModes();
    this.showHome({ animate: true });
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.updateFOV();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.weapon.resize();
      if (this.phase === 'idle' && this.overlay.is('home')) this.applyHomeViewOffset();
    });

    document.addEventListener('keydown', (event) => this.handleKeydown(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    /* Losing pointer lock mid-drill (Esc is usually swallowed by the browser) pauses;
       gaining it starts the countdown or resumes play */
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());

    this.renderer.canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (this.phase === 'live' && this.input.isLocked) this.shootAtCrosshair();
    });
  }

  /* ---------- Keyboard ---------- */

  /* Esc is the single "get me somewhere sane" key:
     settings open -> close it; playing -> pause; paused -> resume;
     results / stats -> home; home -> open settings */
  handleKeydown(event) {
    const typing = event.target?.matches?.('input, select, textarea');

    if (event.code === 'Escape') {
      if (this.settingsDrawer) return this.closeSettings();
      if (['live', 'countdown', 'arming', 'resuming'].includes(this.phase)) return this.pause();
      /* Chrome can deliver the same Esc as both a lock exit and a keydown; ignore the echo */
      if (this.phase === 'paused') return performance.now() - this.pausedAt > 300 ? this.resume() : undefined;
      if (this.phase === 'results' || this.overlay.is('stats')) return this.showHome();
      return this.openSettings();
    }

    if (typing || event.repeat) {
      if (!typing && (event.code === 'BracketLeft' || event.code === 'BracketRight')) this.handleSensKey(event);
      return;
    }

    if (event.code === 'KeyR' && this.phase !== 'idle') return this.restart();
    if (event.code === 'BracketLeft' || event.code === 'BracketRight') return this.handleSensKey(event);

    const onHome = this.phase === 'idle' && this.overlay.is('home') && !this.settingsDrawer;
    if (!onHome) return;
    if (event.code === 'Enter' && !event.target?.matches?.('button')) return this.home.start();
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') return this.home.moveSelection(event);
    if (/^Digit[1-9]$/.test(event.code)) return this.home.selectByNumber(Number(event.code.slice(5)));
    if (event.code === 'KeyS') return this.showStats();
    if (event.code === 'Comma') return this.openSettings();
  }

  handleSensKey(event) {
    const delta = event.code === 'BracketLeft' ? -0.05 : 0.05;
    const next = Math.round(Math.max(0.01, Math.min(12, this.settings.sensitivity + delta)) * 100) / 100;
    this.setSetting('sensitivity', next);
  }

  /* ---------- Drill lifecycle ---------- */

  startMode(modeName) {
    const ModeClass = this.modes[modeName];
    if (!ModeClass) return;

    this.abandonCurrentMode();
    this.closeSettings({ instant: true });
    this.overlay.close();
    this.shards.hideAll();
    this.missMarks.clear();

    this.currentMode = new ModeClass(this);
    this.currentModeName = modeName;
    this.lastModeName = modeName;
    this.session = { shotLog: [], killTimes: [], difficulty: this.settings.difficulty, startedAt: 0 };

    this.preview.setVisible(false);
    this.camera.instance.clearViewOffset();
    this.weapon.setVisible(this.settings.showWeapon);
    this.weapon.equip();
    this.camera.reset();
    this.phase = 'arming';
    this.setInGameUI({ hud: true, crosshair: true });
    this.updateHUD();
    this.requestLock();
  }

  /* Asks for pointer lock; if the browser refuses or is slow, a click prompt appears */
  requestLock() {
    this.input.lockEnabled = true;
    try {
      const request = this.renderer.canvas.requestPointerLock();
      if (request?.catch) request.catch(() => this.showLockPrompt());
    } catch (error) {
      this.showLockPrompt();
    }
    setTimeout(() => {
      if ((this.phase === 'arming' || this.phase === 'resuming') && !this.input.isLocked) this.showLockPrompt();
    }, LOCK_PROMPT_DELAY_MS);
  }

  onPointerLockChange() {
    const locked = document.pointerLockElement === this.renderer.canvas;
    if (locked) {
      this.hideLockPrompt();
      if (this.phase === 'arming') this.startCountdown();
      else if (this.phase === 'resuming') this.phase = 'live';
      return;
    }
    if (this.phase === 'live' || this.phase === 'countdown') this.pause();
  }

  showLockPrompt() {
    if (this.lockPrompt || !(this.phase === 'arming' || this.phase === 'resuming')) return;
    this.lockPrompt = createLockPrompt(() => this.requestLock(), { resuming: this.phase === 'resuming' });
    this.promptLayer.appendChild(this.lockPrompt);
  }

  hideLockPrompt() {
    this.lockPrompt?.remove();
    this.lockPrompt = null;
  }

  startCountdown() {
    this.phase = 'countdown';
    this.countdownStart = performance.now();
    this.countdownStep = -1;
    this.countdown = createCountdown();
    this.promptLayer.appendChild(this.countdown.element);
  }

  /* Stepped 3-2-1, one tick sound per digit, then targets spawn */
  updateCountdown(now) {
    const step = Math.floor((now - this.countdownStart) / COUNTDOWN_STEP_MS);
    if (step >= 3) return this.beginLive();
    if (step !== this.countdownStep) {
      this.countdownStep = step;
      this.countdown.set(String(3 - step));
      this.audio.play('countdown');
    }
  }

  removeCountdown() {
    this.countdown?.element.remove();
    this.countdown = null;
  }

  beginLive() {
    this.removeCountdown();
    this.phase = 'live';
    this.session.startedAt = Date.now();
    this.currentMode.start();
    this.audio.play('go');
  }

  pause() {
    if (!['live', 'countdown', 'arming', 'resuming'].includes(this.phase)) return;
    /* A countdown or an unconfirmed start restarts its countdown on resume */
    this.pausedFrom = this.phase === 'live' || this.phase === 'resuming' ? 'live' : 'countdown';
    this.phase = 'paused';
    this.pausedAt = performance.now();
    this.removeCountdown();
    this.hideLockPrompt();
    this.input.lockEnabled = false;
    if (this.input.isLocked) this.input.unlock();
    this.setInGameUI({ hud: true, crosshair: false });
    this.overlay.show(createPauseScreen(this));
  }

  resume() {
    if (this.phase !== 'paused' || !this.currentMode) return;
    this.closeSettings({ instant: true });
    this.overlay.close();
    this.phase = this.pausedFrom === 'live' ? 'resuming' : 'arming';
    this.setInGameUI({ hud: true, crosshair: true });
    this.requestLock();
  }

  restart() {
    const name = this.currentModeName || this.lastModeName;
    if (name) this.startMode(name);
  }

  quitToHome() {
    this.abandonCurrentMode();
    this.showHome();
  }

  /* Ends a drill without saving it (quit, restart, switching drills) */
  abandonCurrentMode() {
    const mode = this.currentMode;
    this.phase = 'idle';
    this.currentMode = null;
    this.currentModeName = null;
    if (mode) {
      try {
        mode.end?.();
      } catch (error) {
        console.warn('Mode end failed', error);
      }
    }
    this.clearActiveTargets();
    this.removeCountdown();
    this.hideLockPrompt();
    this.input.lockEnabled = false;
    if (this.input.isLocked) this.input.unlock();
  }

  /* Called when a drill sets `finished` (its clock ran out): save, then show results */
  endSession() {
    const modeName = this.currentModeName;
    const mode = this.currentMode;
    const session = this.session;
    this.phase = 'results';
    this.currentMode = null;
    this.currentModeName = null;

    let summary = {};
    try {
      summary = mode.end?.() || {};
    } catch (error) {
      console.warn('Mode end failed', error);
    }

    const previousBest = bestFor(modeName)?.score ?? null;
    const killTimes = session.killTimes;
    const record = {
      mode: modeName,
      start: session.startedAt || Date.now(),
      end: Date.now(),
      difficulty: session.difficulty,
      ...summary,
      ...(killTimes.length && !summary.avgReaction
        ? { avgKillMs: Math.round(killTimes.reduce((a, b) => a + b, 0) / killTimes.length) }
        : {})
    };
    StatsManager.push(record);

    this.input.lockEnabled = false;
    if (this.input.isLocked) this.input.unlock();
    this.setInGameUI({ hud: false, crosshair: false });
    this.clearActiveTargets();
    this.audio.play('complete');
    this.overlay.show(createResultsScreen(this, { ...record, shotLog: session.shotLog, previousBest }));
  }

  clearActiveTargets() {
    for (const target of Array.from(this.pool.active)) {
      this.pool.release(target);
    }
  }

  /* ---------- Shooting ---------- */

  shootAtCrosshair() {
    const mode = this.currentMode;
    if (!mode) return;
    this.audio.play('shoot');
    this.weapon.shoot();

    this.raycaster.setFromCamera(SCREEN_CENTER, this.camera.instance);
    /* Raycast live targets (pool.active), NOT pool.objects: that array is the
       free stack. Filtering userData.target keeps popped corpses unhittable. */
    const liveTargets = Array.from(this.pool.active).filter((t) => t.mesh.visible && t.mesh.userData.target);
    /* A target spawned this frame has not been rendered yet, so refresh its world matrix */
    for (const target of liveTargets) target.mesh.updateMatrixWorld();
    const intersects = this.raycaster.intersectObjects(liveTargets.map((t) => t.mesh), false);

    /* Snapshot before the mode reacts: a killed target is released or recycled in onClick */
    const struck = intersects[0]?.object.userData.target;
    const struckPos = struck ? struck.mesh.position.clone() : null;
    const struckRadius = struck ? struck.mesh.scale.x * 0.3 : 0;
    const struckAge = struck ? performance.now() - struck.bornAt : 0;
    const placement = this.measurePlacement(liveTargets);

    const hitsBefore = mode.hits || 0;
    mode.onClick(intersects);
    const killed = (mode.hits || 0) > hitsBefore;

    if (placement) this.logShot(placement, killed);
    if (killed && struck) {
      struck.spawning = false;
      this.session.killTimes.push(struckAge);
      this.hud.flashHit();
      this.shards.burst(struckPos, struckRadius);
    } else {
      const wall = this.raycaster.intersectObjects(this.scene.surfaces, false)[0];
      if (wall) this.missMarks.place(wall);
    }
  }

  /* Where the crosshair sat relative to the closest target, in target radii
     (x right, y up). Feeds the shot placement map on the results screen. */
  measurePlacement(targets) {
    const cam = this.camera.instance;
    let best = null;
    for (const target of targets) {
      const local = target.mesh.position.clone().applyMatrix4(cam.matrixWorldInverse);
      if (local.z >= 0) continue; // behind the camera
      const angX = Math.atan2(local.x, -local.z);
      const angY = Math.atan2(local.y, -local.z);
      const angRadius = Math.atan((target.mesh.scale.x * 0.3) / local.length());
      const distance = Math.hypot(angX, angY) / angRadius;
      if (!best || distance < best.distance) best = { x: -angX / angRadius, y: -angY / angRadius, distance };
    }
    return best;
  }

  logShot(placement, hit) {
    const log = this.session.shotLog;
    if (log.length >= SHOT_LOG_LIMIT) log.shift();
    log.push({ x: placement.x, y: placement.y, hit });
  }

  /* Tracking feedback: whichever target is under the crosshair glows brighter */
  updateTrackingFocus() {
    this.raycaster.setFromCamera(SCREEN_CENTER, this.camera.instance);
    for (const target of this.pool.active) {
      const onTarget = target.mesh.visible && this.raycaster.intersectObject(target.mesh, false).length > 0;
      target.setFocus(onTarget);
    }
  }

  /* ---------- Frame loop ---------- */

  animate(time) {
    requestAnimationFrame((nextTime) => this.animate(nextTime));

    const dt = Math.min(0.05, (time - this.lastFrameTime) / 1000 || 0);
    this.lastFrameTime = time;
    const now = performance.now();

    this.weapon.update(dt);
    this.shards.update(dt);
    this.missMarks.update(dt);
    this.updateFPSCounter(time);

    if (this.phase === 'idle') {
      this.driftIdleCamera(time / 1000);
      this.preview.update(dt);
    }

    if (this.phase === 'countdown') {
      this.updateCameraFromMouse();
      this.updateCountdown(now);
    } else if (this.phase === 'live' && this.input.isLocked && this.currentMode) {
      this.updateCameraFromMouse();
      for (const target of this.pool.active) target.updateSpawn(now);
      this.currentMode.update(dt * 1000);

      if (this.currentMode.finished) {
        this.endSession();
      } else {
        if (this.currentModeName === 'Tracking') this.updateTrackingFocus();
        this.updateHUD();
      }
    }

    this.renderer.render(this.scene.scene, this.camera.instance);
  }

  /* Behind the home menu the view looks at the target zone with a slow, small sway */
  driftIdleCamera(seconds) {
    const rotation = this.camera.instance.rotation;
    rotation.y = Math.PI + Math.sin(seconds * 0.11) * 0.012;
    rotation.x = 0.085 + Math.sin(seconds * 0.07) * 0.008;
  }

  updateFPSCounter(time) {
    this.frameCount += 1;
    if (time - this.lastFpsTime < 1000) return;
    this.fps = this.frameCount;
    this.frameCount = 0;
    this.lastFpsTime = time;
    if (this.phase === 'live' || this.phase === 'countdown') this.hud.setFPS(this.fps);
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
    const mode = this.currentMode;
    if (!mode) return;
    const shots = mode.shots || 0;
    const hits = mode.hits || 0;
    this.hud.update({
      score: mode.score || 0,
      accuracy: shots > 0 ? (hits / shots) * 100 : 0,
      combo: mode.combo || 0,
      timeLeft: mode.timeLeft
    });
  }

  setInGameUI({ hud, crosshair }) {
    this.crosshair.style.display = crosshair ? 'block' : 'none';
    document.body.classList.toggle('in-game', hud);
    this.hud?.setVisible(hud);
  }

  /* ---------- Screens ---------- */

  showHome({ animate = false } = {}) {
    if (this.phase !== 'idle') this.abandonCurrentMode();
    this.closeSettings({ instant: true });
    this.phase = 'idle';
    this.setInGameUI({ hud: false, crosshair: false });
    this.clearActiveTargets();
    this.shards.hideAll();
    this.missMarks.clear();
    this.weapon.setVisible(false);
    this.home = new HomeScreen(this, { animate });
    this.overlay.show(this.home.element);
    this.preview.setVisible(true);
    this.preview.setMode(this.home.selected);
    requestAnimationFrame(() => this.applyHomeViewOffset());
  }

  /* Home rail covers the left of the screen: shift the 3D view so the ghost run
     is centred in the free stage area above the drill card */
  applyHomeViewOffset() {
    if (!this.home?.element.isConnected) return;
    const { x, y } = this.home.stageOffset();
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    if (x || y) this.camera.instance.setViewOffset(w, hgt, -x, y, w, hgt);
    else this.camera.instance.clearViewOffset();
  }

  onHomeSelection(modeName) {
    this.preview.setMode(modeName);
    requestAnimationFrame(() => this.applyHomeViewOffset());
  }

  showStats() {
    this.closeSettings({ instant: true });
    const page = new StatsPage(this);
    this.overlay.show(page.el, page);
  }

  /* Settings drawer is modal: the rest of the UI goes inert so Tab stays inside,
     and focus returns to whatever opened it when it closes */
  openSettings(tab) {
    if (this.settingsDrawer) return;
    this.settingsReturnFocus = document.activeElement;
    this.settingsDrawer = new SettingsDrawer(this, { tab });
    this.drawerLayer.appendChild(this.settingsDrawer.element);
    this.overlayLayer.inert = true;
    this.persistentLayer.inert = true;
    this.settingsDrawer.open();
  }

  closeSettings({ instant = false } = {}) {
    const drawer = this.settingsDrawer;
    if (!drawer) return;
    this.settingsDrawer = null;
    if (instant) drawer.element.remove();
    else drawer.close();
    this.overlayLayer.inert = false;
    this.persistentLayer.inert = false;
    /* Home shows sensitivity and records; rebuild it so it reflects new settings */
    if (this.phase === 'idle' && this.overlay.is('home')) {
      this.home = new HomeScreen(this);
      this.overlay.show(this.home.element);
      this.preview.setMode(this.home.selected);
      requestAnimationFrame(() => this.applyHomeViewOffset());
    }
    const returnTo = this.settingsReturnFocus;
    this.settingsReturnFocus = null;
    if (!instant && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    else if (!instant) this.overlay.activeOverlay?.querySelector('[aria-pressed="true"], .btn-primary')?.focus({ preventScroll: true });
  }

  /* ---------- Settings ---------- */

  /* Single write path for every setting: memory, storage, then live effect */
  setSetting(key, value) {
    this.settings[key] = value;
    const storageKey = key === 'volume' || key === 'hitSound' ? `audio.${key}` : `settings.${key}`;
    Storage.set(storageKey, value);
    this.applySettings();
  }

  setDifficulty(id) {
    this.setSetting('difficulty', id);
    const preset = DIFFICULTY_PRESETS[id];
    if (!preset) return;
    for (const key of ['targetSize', 'spawnSpeed', 'movementSpeed']) this.setSetting(key, preset[key]);
  }

  updateCrosshair(patch) {
    const next = { ...mergeCrosshairConfig(this.settings.crosshair), ...patch };
    this.setSetting('crosshair', mergeCrosshairConfig(next));
  }

  applySettings() {
    const s = this.settings;
    this.camera.updateFOV(s.fov);
    this.crosshair.innerHTML = buildCrosshairSVG(mergeCrosshairConfig(s.crosshair));
    this.audio.setVolume(s.volume);
    this.audio.setHitSound(s.hitSound);
    this.weapon.setVisible(s.showWeapon && this.phase !== 'idle');
    this.hud?.setMetaVisible(s.showMeta);

    const color = targetColorHex(s.targetColor);
    setTargetColor(color);
    this.preview.setColor(color);
    this.shards.setColor(color);

    const quality = getQuality(s.graphics);
    if (this.renderer.quality !== quality) this.renderer.applyQuality(quality, this.scene.scene, this.camera.instance);
    this.shards.enabled = quality.effects;
    this.missMarks.enabled = quality.effects;
  }
}

/* Phones and tablets cannot pointer-lock or aim with a mouse */
function isTouchOnlyDevice() {
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
}
