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
      <div>FOV: <input id="fov" type="range" min="60" max="120" value="${this.game.settings.fov}"> <span id="fov-val">${this.game.settings.fov}</span></div>
      <div>Sensitivity: <input id="sensi" type="range" min="0.2" max="6" step="0.1" value="${this.game.settings.sensitivity}"> <span id="sensi-val">${this.game.settings.sensitivity}</span></div>
      <div style="margin-top:8px">Crosshair size: <input id="ch-size" type="range" min="2" max="28" value="${this.game.settings.crosshair.size}"> <span id="ch-size-val">${this.game.settings.crosshair.size}</span></div>
      <div>Crosshair thickness: <input id="ch-thick" type="range" min="0" max="6" value="${this.game.settings.crosshair.thickness}"> <span id="ch-thick-val">${this.game.settings.crosshair.thickness}</span></div>
      <div>Crosshair color: <input id="ch-color" type="color" value="${this.game.settings.crosshair.color}"></div>
      <div><label><input id="ch-dot" type="checkbox" ${this.game.settings.crosshair.dot ? 'checked' : ''}/> Dot</label></div>
      <div style="margin-top:8px"><label><input id="invertY" type="checkbox" ${this.game.settings.invertY ? 'checked' : ''}/> Invert Y</label></div>
      <div style="margin-top:10px; text-align:right;"><button id="close">Close</button></div>
    `;

    this.el.querySelector('#close').addEventListener('click', () => this.close());
    const fovEl = this.el.querySelector('#fov');
    const fovVal = this.el.querySelector('#fov-val');
    fovEl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      fovVal.textContent = v;
      this.game.settings.fov = v;
      Storage.set('settings.fov', v);
      this.game.camera.updateFOV(v);
      this.game.audio.play('click');
    });

    const sensEl = this.el.querySelector('#sensi');
    const sensVal = this.el.querySelector('#sensi-val');
    sensEl.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      sensVal.textContent = v;
      this.game.settings.sensitivity = v;
      Storage.set('settings.sensitivity', v);
    });
    const chSize = this.el.querySelector('#ch-size');
    const chSizeVal = this.el.querySelector('#ch-size-val');
    chSize.addEventListener('input', (e) => { this.game.settings.crosshair.size = parseInt(e.target.value); chSizeVal.textContent = e.target.value; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    const chThick = this.el.querySelector('#ch-thick');
    const chThickVal = this.el.querySelector('#ch-thick-val');
    chThick.addEventListener('input', (e) => { this.game.settings.crosshair.thickness = parseInt(e.target.value); chThickVal.textContent = e.target.value; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    this.el.querySelector('#ch-color').addEventListener('input', (e) => { this.game.settings.crosshair.color = e.target.value; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    this.el.querySelector('#ch-dot').addEventListener('change', (e) => { this.game.settings.crosshair.dot = e.target.checked; Storage.set('settings.crosshair', this.game.settings.crosshair); this.game.applySettings(); });
    const inv = this.el.querySelector('#invertY');
    inv.addEventListener('change', (e) => { this.game.settings.invertY = e.target.checked; Storage.set('settings.invertY', e.target.checked); });
  }

  close() {
    this.el.remove();
  }
}
