import { Storage } from '../utils/Storage.js';

export class Settings {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'glass settings';
    this.el.style.cssText = 'position:absolute; top:10%; left:50%; transform:translateX(-50%); padding:20px; min-width:320px;';
    this.build();
    this.container.appendChild(this.el);
  }

  build() {
    this.el.innerHTML = `
      <h3 class="neon-text">Settings</h3>
      <div>FOV: <input id="fov" type="range" min="60" max="120" value="${this.game.settings.fov}"> <input id="fov-num" type="number" step="0.1" value="${this.game.settings.fov}" style="width:72px; margin-left:8px"></div>
      <div>Sensitivity: <input id="sensi" type="range" min="0.01" max="12" step="0.01" value="${this.game.settings.sensitivity}"> <input id="sensi-num" type="number" step="0.01" value="${this.game.settings.sensitivity}" style="width:72px; margin-left:8px"></div>
      <div style="margin-top:8px">Crosshair size: <input id="ch-size" type="range" min="0.1" max="60" step="0.1" value="${this.game.settings.crosshair.size}"> <input id="ch-size-num" type="number" step="0.1" value="${this.game.settings.crosshair.size}" style="width:72px; margin-left:8px"></div>
      <div>Crosshair thickness: <input id="ch-thick" type="range" min="0" max="12" step="0.1" value="${this.game.settings.crosshair.thickness}"> <input id="ch-thick-num" type="number" step="0.1" value="${this.game.settings.crosshair.thickness}" style="width:72px; margin-left:8px"></div>
      <div>Crosshair color: <input id="ch-color" type="color" value="${this.game.settings.crosshair.color}"></div>
      <div><label><input id="ch-dot" type="checkbox" ${this.game.settings.crosshair.dot ? 'checked' : ''}/> Dot</label></div>
      <div style="margin-top:8px"><label><input id="invertY" type="checkbox" ${this.game.settings.invertY ? 'checked' : ''}/> Invert Y</label></div>
      <div style="margin-top:10px; text-align:right;"><button id="close">Close</button></div>
    `;

    this.el.querySelector('#close').addEventListener('click', () => this.close());
    const fovEl = this.el.querySelector('#fov');
    const fovVal = this.el.querySelector('#fov-num');
    const syncFov = (v) => { fovEl.value = v; fovVal.value = v; this.game.settings.fov = parseFloat(v); Storage.set('settings.fov', parseFloat(v)); this.game.camera.updateFOV(parseFloat(v)); };
    fovEl.addEventListener('input', (e) => { const v = e.target.value; syncFov(v); this.game.audio.play('click'); });
    fovVal.addEventListener('change', (e) => { const v = e.target.value; syncFov(v); });

    const sensEl = this.el.querySelector('#sensi');
    const sensVal = this.el.querySelector('#sensi-num');
    const syncSens = (v) => { sensEl.value = v; sensVal.value = v; this.game.settings.sensitivity = parseFloat(v); Storage.set('settings.sensitivity', parseFloat(v)); };
    sensEl.addEventListener('input', (e) => { syncSens(e.target.value); });
    sensVal.addEventListener('change', (e) => { syncSens(e.target.value); });
    const chSize = this.el.querySelector('#ch-size');
    const chSizeVal = this.el.querySelector('#ch-size-num');
    const syncChSize = (v) => { chSize.value = v; chSizeVal.value = v; this.game.settings.crosshair.size = parseFloat(v); Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); };
    chSize.addEventListener('input', (e) => { syncChSize(e.target.value); });
    chSizeVal.addEventListener('change', (e) => { syncChSize(e.target.value); });
    const chThick = this.el.querySelector('#ch-thick');
    const chThickVal = this.el.querySelector('#ch-thick-num');
    const syncChThick = (v) => { chThick.value = v; chThickVal.value = v; this.game.settings.crosshair.thickness = parseFloat(v); Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); };
    chThick.addEventListener('input', (e) => { syncChThick(e.target.value); });
    chThickVal.addEventListener('change', (e) => { syncChThick(e.target.value); });
    this.el.querySelector('#ch-color').addEventListener('input', (e) => { this.game.settings.crosshair.color = e.target.value; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    this.el.querySelector('#ch-dot').addEventListener('change', (e) => { this.game.settings.crosshair.dot = e.target.checked; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    const inv = this.el.querySelector('#invertY');
    inv.addEventListener('change', (e) => { this.game.settings.invertY = e.target.checked; Storage.set('settings.invertY', e.target.checked); });
  }

  close() {
    this.el.remove();
  }
}
