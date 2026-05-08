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

// Modes
import { StaticMode } from '../modes/StaticMode.js';

export class Game {
  constructor() {
    this.container = document.getElementById('container');
    this.uiRoot = document.getElementById('ui-root');
    this.crosshair = document.getElementById('crosshair');

    this.camera = new Camera();
    this.input = new Input(this.container);
    this.renderer = new Renderer();
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
  }

  initUI() {
    // Basic UI initialization so Menu/HUD can attach later
    this.uiRoot.innerHTML = '';
    this.crosshair.style.display = 'none';
    // create initial menu immediately so user can start
    try {
      this.menu = new Menu(this.uiRoot, this);
    } catch (e) {
      // if Menu isn't available yet, create a simple fallback
      const el = document.createElement('div');
      el.className = 'glass';
      el.style.cssText = 'position:absolute; top:10%; left:10%; padding:12px;';
      el.innerHTML = '<button class="btn" id="start-btn">Start</button>';
      this.uiRoot.appendChild(el);
      el.querySelector('#start-btn').addEventListener('click', () => this.showModeSelect());
    }
  }

  loadSettings() {
    return {
      sensitivity: Storage.get('settings.sensitivity', 2.5),
      fov: Storage.get('settings.fov', 90),
      crosshair: Storage.get('settings.crosshair', { size: 6, color: '#0ff', thickness: 1, dot: false }),
      volume: Storage.get('settings.volume', 0.7),
      graphics: Storage.get('settings.graphics', 'medium'),
      targetSize: Storage.get('settings.targetSize', 0.3),
    };
  }

  init() {
    this.bindEvents();
    this.hud = new HUD(this.uiRoot, this);
    this.menu = new Menu(this.uiRoot, this);
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
      if (e.code === 'Escape' && this.isRunning) {
        this.pause();
      }
      if (e.code === 'KeyR') {
        this.restart();
      }
    });

    this.container.addEventListener('mousedown', (e) => {
      if (!this.isRunning || !this.input.isLocked) return;
      this.shoot();
    });
  }

  shoot() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera.instance);

    const intersects = raycaster.intersectObjects(this.pool.objects.map(t => t.mesh).filter(m => m.visible));
    if (intersects.length > 0) {
      this.currentMode.onClick(intersects);
    } else {
      this.currentMode.onClick([]);
    }
  }

  startMode(ModeClass) {
    this.menu.element.remove();
    this.currentMode = new ModeClass(this);
    this.currentMode.start();
    this.isRunning = true;
    this.crosshair.style.display = 'block';
  }

  showModeSelect() {
    this.menu.hide();
    const div = document.createElement('div');
    div.className = 'glass';
    div.style.cssText = `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px;`;
    div.innerHTML = `<h3 class="neon-text">Select Mode</h3>`;
    const modes = { Static: StaticMode };
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
    this.uiRoot.appendChild(div);
  }

  pause() {
    this.isRunning = false;
    this.input.unlock();
    this.uiRoot.innerHTML = '';
    this.menu = new Menu(this.uiRoot, this);
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
      const dy = this.input.mouse.y * this.settings.sensitivity * 0.002;
      this.camera.instance.rotation.y -= dx;
      this.camera.instance.rotation.x -= dy;
      this.camera.instance.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.instance.rotation.x));

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