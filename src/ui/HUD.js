import { getProfileOrDefault } from './GameProfiles.js';

export class HUD {
  constructor(container, game) {
    this.game = game;
    this.element = document.createElement('div');
    this.element.id = 'hud';
    this.element.style.cssText = `
      position: absolute; top: 46px; right: 10px;
      color: white; font-size: 14px;
    `;
    this.element.innerHTML = `
      <div class="glass" style="padding:10px; min-width:120px;">
        <div>Score: <span id="score">0</span></div>
        <div>Acc: <span id="acc">0%</span></div>
        <div>Combo: <span id="combo">0</span></div>
        <div id="time-row" class="hidden">Time: <span id="time">0</span></div>
        <div id="track-row" class="hidden">
          <div>Track: <span id="track-cur">0.0s</span> <span style="opacity:.7">best <span id="track-best">0.0s</span></span></div>
          <div style="height:4px; margin-top:3px; background:rgba(0,255,255,.14); border-radius:2px; overflow:hidden;">
            <div id="track-bar" style="height:100%; width:0%; background:#0ff; box-shadow:0 0 6px #0ff;"></div>
          </div>
        </div>
        <div>Sen: <span id="sensi-val"></span></div>
        <div>FPS: <span id="fps">60</span></div>
      </div>
    `;
    this.element.querySelector('#sensi-val').textContent =
      `${getProfileOrDefault(this.game.settings.game).short} ${this.game.settings.sensitivity}`;
    container.appendChild(this.element);
  }

  update(state) {
    this.element.querySelector('#score').textContent = state.score || 0;
    this.element.querySelector('#acc').textContent = `${state.accuracy?.toFixed(1) || 0}%`;
    this.element.querySelector('#combo').textContent = state.combo || 0;
    const profile = getProfileOrDefault(this.game.settings.game);
    this.element.querySelector('#sensi-val').textContent = `${profile.short} ${this.game.settings.sensitivity.toFixed(2)}`;
    /* Modes with a session clock surface the remaining time */
    const timeRow = this.element.querySelector('#time-row');
    if (state.timeLeft === undefined || state.timeLeft === null) {
      timeRow.classList.add('hidden');
    } else {
      timeRow.classList.remove('hidden');
      this.element.querySelector('#time').textContent = `${state.timeLeft.toFixed(1)}s`;
    }

    /* Hold-tracking modes drive the streak meter (current hold vs best) */
    const trackRow = this.element.querySelector('#track-row');
    if (state.track) {
      trackRow.classList.remove('hidden');
      this.element.querySelector('#track-cur').textContent = `${state.track.current.toFixed(1)}s`;
      this.element.querySelector('#track-best').textContent = `${state.track.best.toFixed(1)}s`;
      const fraction = state.track.best > 0 ? Math.min(1, state.track.current / state.track.best) : 0;
      this.element.querySelector('#track-bar').style.width = `${fraction * 100}%`;
    } else {
      trackRow.classList.add('hidden');
    }
  }

  setFPS(fps) {
    this.element.querySelector('#fps').textContent = `${fps || 0}`;
  }
}
