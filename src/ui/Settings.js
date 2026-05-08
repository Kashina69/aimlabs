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
      <label>Sensitivity: <input id="sensi" type="range" min="0.5" max="5" step="0.1" value="${this.game.settings.sensitivity}"></label>
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
    });
  }

  close() {
    this.el.remove();
  }
}
