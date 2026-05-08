export class HUD {
  constructor(container, game) {
    this.game = game;
    this.element = document.createElement('div');
    this.element.id = 'hud';
    this.element.style.cssText = `
      position: absolute; top: 10px; right: 10px;
      color: white; font-size: 14px;
    `;
    this.element.innerHTML = `
      <div class="glass" style="padding:10px; min-width:120px;">
        <div>Score: <span id="score">0</span></div>
        <div>Acc: <span id="acc">0%</span></div>
        <div>Combo: <span id="combo">0</span></div>
        <div>Sen: <span id="sensi-val">${this.game.settings.sensitivity}</span></div>
        <div>FPS: <span id="fps">60</span></div>
      </div>
    `;
    container.appendChild(this.element);
  }

  update(state) {
    this.element.querySelector('#score').textContent = state.score || 0;
    this.element.querySelector('#acc').textContent = `${state.accuracy?.toFixed(1) || 0}%`;
    this.element.querySelector('#combo').textContent = state.combo || 0;
    this.element.querySelector('#sensi-val').textContent = this.game.settings.sensitivity.toFixed(2);
  }

  setFPS(fps) {
    this.element.querySelector('#fps').textContent = `${fps || 0}`;
  }
}
