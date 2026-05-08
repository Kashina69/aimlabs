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

// Modes
import { StaticMode } from '../modes/StaticMode.js';

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
      (t) => { t.deactivate(); this.scene.scene.remove(t.mesh); }
    );

    this.settings = this.loadSettings();
    this.currentMode = null;
    this.isRunning = false;

    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = 0;

    this.initUI();
    // expose for debugging in browser console
    try { window.game = this; } catch (e) {}
  }

  initUI() {
    // Basic UI initialization so Menu/HUD can attach later
    this.uiRoot.innerHTML = '';
    this.crosshair.style.display = 'none';
    // create initial menu immediately so user can start
    try {
      this.menu = new Menu(this.uiRoot, this, { showResume: false });
    } catch (e) {
      // if Menu isn't available yet, create a simple fallback
      const el = document.createElement('div');
      el.className = 'glass';
      el.style.cssText = 'position:absolute; top:10%; left:10%; padding:12px;';
      el.innerHTML = '<button class="btn" id="start-btn">Start</button>';
      this.uiRoot.appendChild(el);
      el.querySelector('#start-btn').addEventListener('click', () => this.showModeSelect());
    }

    // create gun HUD element (simple, lightweight)
    this.gunEl = document.createElement('div');
    this.gunEl.id = 'gun-hud';
    this.gunEl.style.cssText = 'position:absolute; left:50%; bottom:6%; transform:translateX(-50%); width:140px; height:60px; pointer-events:none; z-index:9998;';
    this.gunEl.innerHTML = '<div id="gun-bar" style="width:100px;height:24px;background:linear-gradient(#222,#111);margin:0 auto;border-radius:6px;box-shadow:0 0 10px rgba(0,255,255,0.08);"></div>';
    this.uiRoot.appendChild(this.gunEl);

    // add a visible gun sprite centered near bottom
    this.gunSprite = document.createElement('div');
    this.gunSprite.id = 'gun-sprite';
    this.gunSprite.style.cssText = 'position:absolute; left:50%; bottom:4%; transform:translateX(-50%); width:220px; height:120px; pointer-events:none; z-index:9997;';
    this.gunSprite.innerHTML = '<div class="gun-body"></div>';
    this.uiRoot.appendChild(this.gunSprite);

    // muzzle flash
    this.muzzle = document.createElement('div');
    this.muzzle.id = 'muzzle-flash';
    this.muzzle.style.cssText = 'position:absolute; left:50%; bottom:18%; transform:translateX(-50%); width:60px; height:60px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,200,0.9) 0%, rgba(255,200,0,0.6) 40%, transparent 60%); mix-blend-mode:screen; opacity:0; pointer-events:none; z-index:9999;';
    this.uiRoot.appendChild(this.muzzle);

    // hit marker
    this.hitMarker = document.createElement('div');
    this.hitMarker.id = 'hit-marker';
    this.hitMarker.style.cssText = 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:140px; height:140px; border-radius:50%; border:2px solid rgba(0,255,255,0.0); pointer-events:none; transition: all 0.12s ease; z-index:10000;';
    this.uiRoot.appendChild(this.hitMarker);
  }

  loadSettings() {
    return {
      sensitivity: Storage.get('settings.sensitivity', 2.5),
      fov: Storage.get('settings.fov', 90),
      crosshair: Storage.get('settings.crosshair', { size: 6, color: '#0ff', thickness: 1, dot: false }),
      volume: Storage.get('settings.volume', 0.7),
      graphics: Storage.get('settings.graphics', 'medium'),
      targetSize: Storage.get('settings.targetSize', 0.3),
      invertY: Storage.get('settings.invertY', false),
    };
  }

  init() {
    this.bindEvents();
    this.hud = new HUD(this.uiRoot, this);
    // if returning from pause, show resume option
    const showResume = !!(this.currentMode && !this.isRunning);
    this.menu = new Menu(this.uiRoot, this, { showResume });
    this.applySettings();

    this.animate(0);
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.instance.aspect = window.innerWidth / window.innerHeight;
      this.camera.instance.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('keydown', (e) => {
      // first close active modal if present
      if (e.code === 'Escape') {
        if (this.currentModal) {
          try { this.currentModal.remove(); } catch(e) {}
          this.currentModal = null;
          return;
        }
        if (this.isRunning) { this.pause(); return; }
      }
      if (e.code === 'KeyR') {
        this.restart();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning) {
        this.pause(true);
      }
    });

    // listen on the actual canvas for pointer-lock/headshot inputs
    if (this.renderer && this.renderer.canvas) {
      this.renderer.canvas.addEventListener('mousedown', (e) => {
        if (!this.isRunning || !this.input.isLocked) return;
        this.shoot();
      });
    }
  }

  shoot() {
    // play shoot sound and show muzzle flash
    this.audio.play('shoot');
    this.muzzle.style.opacity = '1';
    this.muzzle.style.transform = 'translateX(-50%) scale(1.1)';
    setTimeout(() => { this.muzzle.style.opacity = '0'; this.muzzle.style.transform = 'translateX(-50%) scale(0.8)'; }, 80);

    // small gun recoil effect
    this.gunEl.querySelector('#gun-bar').style.transform = 'translateY(-6px) scaleX(0.98)';
    setTimeout(() => { this.gunEl.querySelector('#gun-bar').style.transform = ''; }, 120);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera.instance);
    const intersects = raycaster.intersectObjects(this.pool.objects.map(t => t.mesh).filter(m => m.visible));
    if (intersects.length > 0) {
      this.currentMode.onClick(intersects);
      this.triggerHit(true);
    } else {
      this.currentMode.onClick([]);
      this.triggerHit(false);
    }
  }

  triggerHit(hit = true) {
    try {
      this.hitMarker.classList.add(hit ? 'hit' : 'miss');
      setTimeout(() => { this.hitMarker.classList.remove('hit'); this.hitMarker.classList.remove('miss'); }, 160);
    } catch (e) {}
  }

  startMode(ModeClass) {
    // clean previous mode state
    if (this.currentMode) {
      try {
        const summary = this.currentMode.end && this.currentMode.end();
        if (summary) {
          const session = Object.assign({ mode: this.currentMode.constructor.name, start: this.sessionStart || Date.now(), end: Date.now() }, summary);
          try { StatsManager.push(session); } catch (e) {}
        }
      } catch(e){}
    }
    // release any active targets to avoid leftover objects
    this.clearActiveTargets();

    if (this.menu && this.menu.element) {
      try { this.menu.element.remove(); } catch(e){}
    }
    this.currentMode = new ModeClass(this);
    this.currentMode.start();
    // mark session start
    this.sessionStart = Date.now();
    this.isRunning = true;
    this.crosshair.style.display = 'block';
    this.hitMarker.style.borderColor = 'rgba(0,255,255,0.0)';
    // request pointer lock on the canvas as this is triggered by a user gesture
    try {
      if (this.renderer && this.renderer.canvas) {
        this.renderer.canvas.requestPointerLock();
      }
    } catch (e) {}
    // clear any modal reference
    this.currentModal = null;
  }

  clearActiveTargets() {
    try {
      if (this.pool && this.pool.active) {
        for (const t of Array.from(this.pool.active)) {
          try { this.pool.release(t); } catch(e) {}
        }
      }
    } catch (e) {}
  }

  async showModeSelect() {
    // clear UI so modal sits alone (prevents underlying menus showing through)
    this.uiRoot.innerHTML = '';
    try { this.menu.hide(); } catch(e) {}
    const div = document.createElement('div');
    div.className = 'glass';
    div.style.cssText = `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px;`;
    div.innerHTML = `<h3 class="neon-text">Select Mode</h3>`;

    // Build mode list robustly so one failing dynamic import doesn't block others
    const modes = { Static: StaticMode };
    const tryImport = async (path, key) => {
      try {
        const mod = await import(path);
        if (mod && mod[key]) modes[key.replace('Mode','')] = mod[key];
      } catch (err) {
        console.warn('Mode import failed', path, err);
      }
    };

    await Promise.all([
      tryImport('../modes/FlickMode.js', 'FlickMode'),
      tryImport('../modes/TrackingMode.js', 'TrackingMode'),
      tryImport('../modes/ReactionMode.js', 'ReactionMode')
    ]);

    for (const [name, Mode] of Object.entries(modes)) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = name;
      btn.onclick = () => {
        this.audio.play('click');
        this.uiRoot.innerHTML = '';
        this.startMode(Mode);
      };
      div.appendChild(btn);
    }
    // attach as current modal for ESC handling
    this.currentModal = div;

    // difficulty controls
    const diff = document.createElement('div');
    diff.style.marginTop = '12px';
    diff.innerHTML = `
      <div style="margin-top:8px">Difficulty: <select id="diff-select"><option>Easy</option><option selected>Medium</option><option>Hard</option><option>Insane</option></select></div>
      <label>Target size: <input id="targetSize" type="range" min="0.07" max="1.2" step="0.01" value="${this.settings.targetSize}"></label>
      <label>Spawn speed: <input id="spawnSpeed" type="range" min="0" max="5" step="0.1" value="1"></label>
      <label>Movement speed: <input id="moveSpeed" type="range" min="0" max="3" step="0.05" value="1"></label>
    `;
    div.appendChild(diff);

    diff.querySelector('#targetSize').addEventListener('input', (e) => { this.settings.targetSize = parseFloat(e.target.value); Storage.set('settings.targetSize', this.settings.targetSize); });
    diff.querySelector('#spawnSpeed').addEventListener('input', (e) => { this.settings.spawnSpeed = parseFloat(e.target.value); Storage.set('settings.spawnSpeed', this.settings.spawnSpeed); });
    diff.querySelector('#moveSpeed').addEventListener('input', (e) => { this.settings.movementSpeed = parseFloat(e.target.value); Storage.set('settings.movementSpeed', this.settings.movementSpeed); });
    this.uiRoot.appendChild(div);
  }

  pause() {
    this.isRunning = false;
    this.input.unlock();
    this.uiRoot.innerHTML = '';
    this.menu = new Menu(this.uiRoot, this, { showResume: true });
  }

  restart() {
    if (this.currentMode && this.isRunning) {
      this.currentMode.end();
      this.startMode(this.currentMode.constructor);
    }
  }

  animate(time) {
    requestAnimationFrame((t) => this.animate(t));

    // FPS Counter
    this.frameCount++;
    if (time - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = time;
    }

    if (this.isRunning && this.input.isLocked) {
      // Rotate camera
      const dx = this.input.mouse.x * this.settings.sensitivity * 0.002;
      const invertMul = this.settings.invertY ? 1 : -1;
      const dy = this.input.mouse.y * this.settings.sensitivity * 0.002 * invertMul;
      this.camera.instance.rotation.y -= dx;
      this.camera.instance.rotation.x -= dy;
      this.camera.instance.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.instance.rotation.x));

      // reset mouse deltas after applying
      this.input.mouse.x = 0;
      this.input.mouse.y = 0;

      // Update game mode
      this.currentMode.update();

      // Update HUD
      this.hud.update({
        score: this.currentMode.score,
        accuracy: this.currentMode.shots ? (this.currentMode.hits / this.currentMode.shots) * 100 : 0,
        combo: this.currentMode.combo
      });
    }

    this.renderer.render(this.scene.scene, this.camera.instance);
  }

  applySettings() {
    this.camera.updateFOV(this.settings.fov);
    const ch = this.settings.crosshair;
    this.crosshair.style.width = `${ch.dot ? 2 : ch.size}px`;
    this.crosshair.style.height = `${ch.dot ? 2 : ch.size}px`;
    this.crosshair.style.border = ch.dot ? 'none' : `${ch.thickness}px solid ${ch.color}`;
    this.crosshair.style.backgroundColor = ch.dot ? ch.color : 'transparent';
    this.crosshair.classList.toggle('dot', ch.dot);
    this.audio.setVolume(this.settings.volume);
  }

  showSettings() {
    new Settings(this.uiRoot, this);
  }

  showStats() {
    new StatsUI(this.uiRoot, this);
  }
}