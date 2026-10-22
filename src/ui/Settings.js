import { Storage } from '../utils/Storage.js';
import { buildCrosshairSVG, mergeCrosshairConfig } from './Crosshair.js';

export class Settings {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'glass settings';
    this.el.style.cssText = 'position:absolute; top:5%; left:50%; transform:translateX(-50%); padding:20px; min-width:380px; max-height:88vh; overflow:auto;';
    this.build();
    this.container.appendChild(this.el);
  }

  /* Keeps a settings value in storage and refreshes whatever uses it */
  commit(key, value, storageKey) {
    this.game.settings[key] = value;
    Storage.set(storageKey, value);
    this.game.applySettings();
    this.refreshPreview(key);
  }

  build() {
    const s = this.game.settings;
    const ch = mergeCrosshairConfig(s.crosshair);

    this.el.innerHTML = `
      <h3 class="neon-text">Settings</h3>
      <div style="line-height:2">
        <div>FOV:
          <input id="fov" type="range" min="60" max="120" step="0.1" value="${s.fov}">
          <input id="fov-num" type="number" step="0.1" value="${s.fov}" style="width:72px; margin-left:8px">
        </div>
        <div>Sensitivity <span style="opacity:.7">(Marvel Rivals value)</span>:
          <input id="sensi" type="range" min="0.01" max="12" step="0.01" value="${s.sensitivity}">
          <input id="sensi-num" type="number" step="0.01" value="${s.sensitivity}" style="width:72px; margin-left:8px">
        </div>
        <div><label><input id="invertY" type="checkbox" ${s.invertY ? 'checked' : ''}/> Invert Y</label></div>
      </div>

      <h4 class="neon-text" style="margin-top:14px">Crosshair Builder</h4>
      <div style="display:flex; gap:16px; align-items:flex-start;">
        <div id="ch-preview"
             style="position:relative; width:110px; height:110px; min-width:110px; overflow:hidden; border:1px solid rgba(0,255,255,.25); border-radius:8px; background:
               repeating-conic-gradient(#1b2530 0% 25%, #141c26 0% 50%) 50% / 20px 20px;">
        </div>
        <div style="flex:1; line-height:1.9; font-size:13px">
          <div>Shape:
            <select id="ch-style">
              <option value="cross">Cross</option>
              <option value="x">X</option>
              <option value="t">T</option>
              <option value="circle">Circle</option>
              <option value="square">Square</option>
            </select>
          </div>
          <div>Rotation: <input id="ch-rot" type="range" min="0" max="360" step="1" value="${ch.rotation}">
            <input id="ch-rot-num" type="number" min="0" max="360" step="1" value="${ch.rotation}" style="width:60px"></div>
          <div>Length: <input id="ch-size" type="range" min="0" max="40" step="0.5" value="${ch.size}">
            <input id="ch-size-num" type="number" min="0" max="40" step="0.5" value="${ch.size}" style="width:60px"></div>
          <div>Thickness: <input id="ch-thick" type="range" min="0" max="10" step="0.25" value="${ch.thickness}">
            <input id="ch-thick-num" type="number" min="0" max="10" step="0.25" value="${ch.thickness}" style="width:60px"></div>
          <div>Gap: <input id="ch-gap" type="range" min="0" max="24" step="0.5" value="${ch.gap}">
            <input id="ch-gap-num" type="number" min="0" max="24" step="0.5" value="${ch.gap}" style="width:60px"></div>
        </div>
      </div>
      <div style="line-height:2; font-size:13px; margin-top:8px">
        <div>Color: <input id="ch-color" type="color" value="${ch.color}"></div>
        <div>Opacity: <input id="ch-opacity" type="range" min="0.1" max="1" step="0.05" value="${ch.opacity}">
          <input id="ch-opacity-num" type="number" min="0.1" max="1" step="0.05" value="${ch.opacity}" style="width:60px"></div>
        <div>Dot: <label><input id="ch-dot" type="checkbox" ${ch.dot ? 'checked' : ''}/> enabled</label>
          <input id="ch-dot-size" type="number" min="1" max="20" step="0.5" value="${ch.dotSize}" style="width:60px; margin-left:8px"></div>
        <div><label><input id="ch-outline" type="checkbox" ${ch.outline ? 'checked' : ''}/> Outline (dark edge for visibility)</label></div>
        <div><button id="ch-reset" style="margin-top:4px">Reset to default</button></div>
      </div>

      <div style="margin-top:12px; text-align:right;"><button id="close">Close</button></div>
    `;

    this.el.querySelector('#close').addEventListener('click', () => this.close());
    this.el.querySelector('#invertY').addEventListener('change', (e) => this.commit('invertY', e.target.checked, 'settings.invertY'));

    this.bindSlider('fov', 'fov-num', (v) => this.commit('fov', v, 'settings.fov'));
    this.bindSlider('sensi', 'sensi-num', (v) => this.commit('sensitivity', v, 'settings.sensitivity'));

    this.buildCrosshairControls(ch);
  }

  /* Wires every crosshair control; any change re-renders preview + in-game crosshair */
  buildCrosshairControls(ch) {
    const controls = [
      { slider: 'ch-size', number: 'ch-size-num', apply: (v) => this.updateCrosshair({ size: v }) },
      { slider: 'ch-thick', number: 'ch-thick-num', apply: (v) => this.updateCrosshair({ thickness: v }) },
      { slider: 'ch-gap', number: 'ch-gap-num', apply: (v) => this.updateCrosshair({ gap: v }) },
      { slider: 'ch-rot', number: 'ch-rot-num', apply: (v) => this.updateCrosshair({ rotation: v }) },
      { slider: 'ch-opacity', number: 'ch-opacity-num', apply: (v) => this.updateCrosshair({ opacity: v }) }
    ];
    for (const control of controls) {
      this.bindSlider(control.slider, control.number, (v) => control.apply(v));
    }

    this.el.querySelector('#ch-style').value = ch.style;
    this.el.querySelector('#ch-style').addEventListener('change', (e) => this.updateCrosshair({ style: e.target.value }));
    this.el.querySelector('#ch-color').addEventListener('input', (e) => this.updateCrosshair({ color: e.target.value }));
    this.el.querySelector('#ch-dot').addEventListener('change', (e) => this.updateCrosshair({ dot: e.target.checked }));
    this.el.querySelector('#ch-dot-size').addEventListener('change', (e) => this.updateCrosshair({ dotSize: parseFloat(e.target.value) }));
    this.el.querySelector('#ch-outline').addEventListener('change', (e) => this.updateCrosshair({ outline: e.target.checked }));
    this.el.querySelector('#ch-reset').addEventListener('click', () => {
      this.updateCrosshair({ style: 'cross', size: 8, thickness: 2, gap: 3, dot: false, dotSize: 4, color: '#00ffff', outline: true, rotation: 0, opacity: 1 });
      this.el.querySelector('#ch-style').value = 'cross';
      this.el.querySelector('#ch-dot').checked = false;
      this.el.querySelector('#ch-outline').checked = true;
      this.el.querySelector('#ch-color').value = '#00ffff';
      this.syncSlidersFromConfig();
    });

    this.refreshPreview();
  }

  /* Pushes stored config values back into the visible inputs after a reset */
  syncSlidersFromConfig() {
    const ch = mergeCrosshairConfig(this.game.settings.crosshair);
    const pairs = [
      ['ch-size', 'ch-size-num', ch.size],
      ['ch-thick', 'ch-thick-num', ch.thickness],
      ['ch-gap', 'ch-gap-num', ch.gap],
      ['ch-rot', 'ch-rot-num', ch.rotation],
      ['ch-opacity', 'ch-opacity-num', ch.opacity],
      ['ch-dot-size', null, ch.dotSize]
    ];
    for (const [sliderId, numberId, value] of pairs) {
      const slider = this.el.querySelector(`#${sliderId}`);
      if (slider) slider.value = value;
      if (numberId) this.el.querySelector(`#${numberId}`).value = value;
    }
  }

  /* Merges one changed property into the stored crosshair config */
  updateCrosshair(patch) {
    const current = mergeCrosshairConfig(this.game.settings.crosshair);
    const next = { ...current, ...patch };
    this.game.settings.crosshair = next;
    Storage.set('settings.crosshair', next);
    this.game.applySettings();
    this.refreshPreview();
  }

  /* Re-renders the builder preview box */
  refreshPreview() {
    const preview = this.el.querySelector('#ch-preview');
    if (!preview) return;
    preview.innerHTML = buildCrosshairSVG(mergeCrosshairConfig(this.game.settings.crosshair));
  }

  bindSlider(sliderId, numberId, apply) {
    const slider = this.el.querySelector(`#${sliderId}`);
    const number = this.el.querySelector(`#${numberId}`);
    if (!slider || !number) return;
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      number.value = value;
      apply(value);
    });
    number.addEventListener('change', (e) => {
      const value = parseFloat(e.target.value);
      if (Number.isNaN(value)) return;
      slider.value = value;
      apply(value);
    });
  }

  close() {
    if (this.game?.closeOverlayToMenu) {
      this.game.closeOverlayToMenu();
      return;
    }
    this.el.remove();
  }
}
