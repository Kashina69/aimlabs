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
      <label>FOV: <input id="fov" type="range" min="60" max="120" value="${this.game.settings.fov}"></label>
      <label>Sensitivity: <input id="sensi" type="range" min="0.2" max="6" step="0.1" value="${this.game.settings.sensitivity}"></label>
      <div style="margin-top:8px">Crosshair size: <input id="ch-size" type="range" min="2" max="28" value="${this.game.settings.crosshair.size}"></div>
      <div>Crosshair thickness: <input id="ch-thick" type="range" min="0" max="6" value="${this.game.settings.crosshair.thickness}"></div>
      <div>Crosshair color: <input id="ch-color" type="color" value="${this.game.settings.crosshair.color}"></div>
      <div><label><input id="ch-dot" type="checkbox" ${this.game.settings.crosshair.dot ? 'checked' : ''}/> Dot</label></div>
      <div style="margin-top:10px; text-align:right;"><button id="close">Close</button></div>
    `;

    this.el.querySelector('#close').addEventListener('click', () => this.close());
    this.el.querySelector('#fov').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.game.settings.fov = v;
      this.game.camera.updateFOV(v);
      this.game.audio.play('click');
    });
    this.el.querySelector('#sensi').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.game.settings.sensitivity = v;
      localStorage.setItem('settings.sensitivity', JSON.stringify(v));
    });
    this.el.querySelector('#ch-size').addEventListener('input', (e) => { this.game.settings.crosshair.size = parseInt(e.target.value); localStorage.setItem('settings.crosshair', JSON.stringify(this.game.settings.crosshair)); this.game.applySettings(); });
    this.el.querySelector('#ch-thick').addEventListener('input', (e) => { this.game.settings.crosshair.thickness = parseInt(e.target.value); localStorage.setItem('settings.crosshair', JSON.stringify(this.game.settings.crosshair)); this.game.applySettings(); });
    this.el.querySelector('#ch-color').addEventListener('input', (e) => { this.game.settings.crosshair.color = e.target.value; localStorage.setItem('settings.crosshair', JSON.stringify(this.game.settings.crosshair)); this.game.applySettings(); });
    this.el.querySelector('#ch-dot').addEventListener('change', (e) => { this.game.settings.crosshair.dot = e.target.checked; localStorage.setItem('settings.crosshair', JSON.stringify(this.game.settings.crosshair)); this.game.applySettings(); });
  }

  close() {
    this.el.remove();
  }
}
