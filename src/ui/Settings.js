import { h, svg, syncSliderFill } from './dom.js';
import { buildCrosshairSVG, mergeCrosshairConfig, CROSSHAIR_DEFAULTS } from './Crosshair.js';
import { TARGET_COLORS } from '../core/palette.js';
import { QUALITY_PRESETS } from '../core/Quality.js';

const CLOSE_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>`;

const TABS = [
  ['controls', 'Controls'],
  ['crosshair', 'Crosshair'],
  ['targets', 'Targets'],
  ['video', 'Video'],
  ['audio', 'Audio']
];

const CROSSHAIR_PRESETS = [
  { name: 'Classic', cfg: { style: 'cross', size: 6, thickness: 2, gap: 3, dot: false, outline: true } },
  { name: 'Dot', cfg: { style: 'cross', size: 0, thickness: 0, gap: 0, dot: true, dotSize: 4, outline: true } },
  { name: 'Circle', cfg: { style: 'circle', size: 6, thickness: 1.5, gap: 2, dot: true, dotSize: 2, outline: true } },
  { name: 'Small', cfg: { style: 'cross', size: 3, thickness: 1.5, gap: 1.5, dot: false, outline: true } }
];

/* Settings drawer: slides in from the right over whatever opened it (home, pause,
   results). Every control applies live through game.setSetting / game.updateCrosshair. */
export class SettingsDrawer {
  constructor(game, { tab } = {}) {
    this.game = game;
    this.tab = TABS.some(([id]) => id === tab) ? tab : 'controls';
    this.body = h('div', { class: 'drawer-body' });
    this.tabList = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Settings sections' });

    this.element = h('div', { class: 'drawer-root interactive', id: 'settings' },
      h('div', { class: 'drawer-scrim', style: 'position:absolute; inset:0', onClick: () => game.closeSettings() }),
      h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' },
        h('header', { class: 'drawer-head' },
          h('h2', { class: 'drawer-title', id: 'settings-title' }, 'Settings'),
          h('button', { class: 'btn btn-icon', 'aria-label': 'Close settings', onClick: () => game.closeSettings() }, svg(CLOSE_ICON))
        ),
        this.tabList,
        this.body
      )
    );
    this.renderTabs();
    this.renderBody();
  }

  open() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.element.classList.add('is-open');
      this.tabList.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
    }));
  }

  /* Plays the exit slide, then removes itself */
  close(done) {
    this.element.classList.remove('is-open');
    setTimeout(() => {
      this.element.remove();
      done?.();
    }, 320);
  }

  renderTabs() {
    this.tabList.replaceChildren(...TABS.map(([id, label]) => h('button', {
      role: 'tab',
      'aria-selected': String(id === this.tab),
      onClick: () => {
        this.tab = id;
        this.renderTabs();
        this.renderBody();
      }
    }, label)));
  }

  renderBody() {
    const builders = {
      controls: () => this.buildControls(),
      crosshair: () => this.buildCrosshair(),
      targets: () => this.buildTargets(),
      video: () => this.buildVideo(),
      audio: () => this.buildAudio()
    };
    this.body.replaceChildren(...[builders[this.tab]()].flat());
    this.body.scrollTop = 0;
  }

  /* ---------- Tabs ---------- */

  buildControls() {
    const s = this.game.settings;
    const readout = h('p', { class: 'readout', style: 'margin-top: 8px' });
    const updateReadout = () => {
      const cm = cmPer360(this.game.settings.sensitivity, this.game.settings.dpi);
      readout.replaceChildren(h('span', { class: 'num' }, cm.toFixed(1)), ' cm per 360° at ',
        h('span', { class: 'num' }, String(this.game.settings.dpi)), ' DPI');
    };
    updateReadout();

    return h('div', { class: 'section' },
      this.slider({ label: 'Sensitivity', hint: 'Same scale as Marvel Rivals', key: 'sensitivity', min: 0.01, max: 12, step: 0.01, after: updateReadout }),
      readout,
      this.numberField({ label: 'Mouse DPI', hint: 'Only used for the cm/360 readout', key: 'dpi', min: 100, max: 32000, step: 50, after: updateReadout }),
      this.slider({ label: 'Field of view', hint: 'Horizontal degrees', key: 'fov', min: 70, max: 130, step: 1 }),
      this.toggle({ label: 'Invert vertical look', key: 'invertY' })
    );
  }

  buildCrosshair() {
    const ch = mergeCrosshairConfig(this.game.settings.crosshair);
    this.preview = h('div', { class: 'xh-preview', 'aria-hidden': 'true' });
    this.refreshPreview();

    const presets = h('div', { class: 'xh-presets' }, ...CROSSHAIR_PRESETS.map((preset) => {
      const icon = h('div', { class: 'xh-preset-icon' });
      icon.innerHTML = buildCrosshairSVG({ ...ch, ...preset.cfg, color: '#eff2f5', rotation: 0, opacity: 1 });
      return h('button', { class: 'xh-preset', onClick: () => this.applyCrosshair(preset.cfg) }, icon, preset.name);
    }));

    const style = h('select', { class: 'input', 'aria-label': 'Shape' },
      ...[['cross', 'Cross'], ['x', 'X'], ['t', 'T'], ['circle', 'Circle'], ['square', 'Square']]
        .map(([value, label]) => h('option', { value, selected: ch.style === value }, label)));
    style.addEventListener('change', (e) => this.applyCrosshair({ style: e.target.value }));

    const color = h('input', { class: 'color-input', type: 'color', value: ch.color, 'aria-label': 'Crosshair colour' });
    color.addEventListener('input', (e) => this.updateCrosshair({ color: e.target.value }));

    return [
      h('div', { class: 'section' }, this.preview, presets),
      h('div', { class: 'section' },
        h('h3', { class: 'section-title' }, 'Shape'),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Style'), style),
        this.crosshairSlider('Length', 'size', 0, 40, 0.5),
        this.crosshairSlider('Thickness', 'thickness', 0, 10, 0.25),
        this.crosshairSlider('Gap', 'gap', 0, 24, 0.5),
        this.crosshairSlider('Rotation', 'rotation', 0, 360, 1)
      ),
      h('div', { class: 'section' },
        h('h3', { class: 'section-title' }, 'Look'),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Colour'), color),
        this.crosshairSlider('Opacity', 'opacity', 0.1, 1, 0.05),
        this.crosshairToggle('Center dot', 'dot'),
        this.crosshairSlider('Dot size', 'dotSize', 1, 20, 0.5),
        this.crosshairToggle('Dark outline', 'outline')
      ),
      h('div', { class: 'section' },
        h('h3', { class: 'section-title' }, 'Share'),
        this.buildShareCode(),
        h('button', { class: 'btn', style: 'margin-top: 16px', onClick: () => this.applyCrosshair({ ...CROSSHAIR_DEFAULTS }) }, 'Reset to default')
      )
    ];
  }

  buildTargets() {
    const current = this.game.settings.targetColor;
    return h('div', { class: 'section' },
      h('div', { class: 'field' },
        h('div', { class: 'field-head' },
          h('span', { class: 'field-label' }, 'Target colour'),
          h('span', { class: 'field-hint' }, TARGET_COLORS.find((c) => c.id === current)?.label || 'Lime')),
        h('div', { class: 'swatches', role: 'group', 'aria-label': 'Target colour' },
          ...TARGET_COLORS.map((c) => h('button', {
            class: 'swatch',
            style: `--swatch:${c.hex}`,
            'aria-label': c.label,
            'aria-pressed': String(c.id === current),
            onClick: () => {
              this.game.setSetting('targetColor', c.id);
              this.renderBody();
            }
          })))
      ),
      h('p', { class: 'readout', style: 'margin-top: 12px' }, 'Pick the colour that stands out most for your eyes. Cyan and orange suit most colour-vision differences.')
    );
  }

  buildVideo() {
    const current = this.game.settings.graphics;
    return h('div', { class: 'section' },
      h('div', { class: 'field' },
        h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Quality')),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Quality' },
          ...Object.entries(QUALITY_PRESETS).map(([id, preset]) => h('button', {
            'aria-pressed': String(id === current),
            onClick: () => {
              this.game.setSetting('graphics', id);
              this.renderBody();
            }
          }, preset.label))),
        h('span', { class: 'field-hint' }, qualityHint(current))
      ),
      this.toggle({ label: 'Show weapon', key: 'showWeapon' }),
      this.toggle({ label: 'Show FPS and sensitivity', key: 'showMeta' })
    );
  }

  buildAudio() {
    const current = this.game.settings.hitSound;
    return h('div', { class: 'section' },
      this.slider({ label: 'Master volume', key: 'volume', min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` }),
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'Hit sound'),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Hit sound' },
          ...[['tick', 'Tick'], ['pop', 'Pop'], ['off', 'Off']].map(([id, label]) => h('button', {
            'aria-pressed': String(id === current),
            onClick: () => {
              this.game.setSetting('hitSound', id);
              this.game.audio.play('hit');
              this.renderBody();
            }
          }, label))))
    );
  }

  /* ---------- Field builders ---------- */

  slider({ label, hint, key, min, max, step, after, format }) {
    const value = this.game.settings[key];
    const slider = h('input', { class: 'slider', type: 'range', min, max, step, value, 'aria-label': label });
    const number = format
      ? h('span', { class: 'num field-hint' }, format(value))
      : h('input', { class: 'input input-num', type: 'number', min, max, step, value, 'aria-label': `${label} value` });
    syncSliderFill(slider);
    const commit = (raw) => {
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return;
      const clamped = Math.min(max, Math.max(min, parsed));
      slider.value = clamped;
      syncSliderFill(slider);
      if (format) number.textContent = format(clamped);
      else if (document.activeElement !== number) number.value = clamped;
      this.game.setSetting(key, clamped);
      after?.();
    };
    slider.addEventListener('input', (e) => commit(e.target.value));
    if (!format) number.addEventListener('change', (e) => { commit(e.target.value); number.value = slider.value; });
    return h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, label), hint ? h('span', { class: 'field-hint' }, hint) : null),
      h('div', { class: 'field-row' }, slider, number));
  }

  numberField({ label, hint, key, min, max, step, after }) {
    const input = h('input', { class: 'input input-num', type: 'number', min, max, step, value: this.game.settings[key], 'aria-label': label });
    input.addEventListener('change', (e) => {
      const value = Math.round(Math.min(max, Math.max(min, parseFloat(e.target.value) || min)));
      input.value = value;
      this.game.setSetting(key, value);
      after?.();
    });
    return h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-hint' }, hint)),
      input);
  }

  toggle({ label, key }) {
    const input = h('input', { type: 'checkbox', checked: !!this.game.settings[key] });
    input.addEventListener('change', (e) => this.game.setSetting(key, e.target.checked));
    return h('label', { class: 'switch' }, label, input);
  }

  crosshairSlider(label, key, min, max, step) {
    const ch = mergeCrosshairConfig(this.game.settings.crosshair);
    const slider = h('input', { class: 'slider', type: 'range', min, max, step, value: ch[key], 'aria-label': label, dataset: { key } });
    const number = h('input', { class: 'input input-num', type: 'number', min, max, step, value: ch[key], 'aria-label': `${label} value`, dataset: { key } });
    syncSliderFill(slider);
    slider.addEventListener('input', (e) => {
      number.value = e.target.value;
      syncSliderFill(slider);
      this.updateCrosshair({ [key]: parseFloat(e.target.value) });
    });
    number.addEventListener('change', (e) => {
      const value = parseFloat(e.target.value);
      if (Number.isNaN(value)) return;
      slider.value = value;
      syncSliderFill(slider);
      this.updateCrosshair({ [key]: value });
    });
    return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'field-row' }, slider, number));
  }

  crosshairToggle(label, key) {
    const ch = mergeCrosshairConfig(this.game.settings.crosshair);
    const input = h('input', { type: 'checkbox', checked: !!ch[key] });
    input.addEventListener('change', (e) => this.updateCrosshair({ [key]: e.target.checked }));
    return h('label', { class: 'switch' }, label, input);
  }

  /* Crosshair share code: base64 JSON, always run through the sanitizer on import */
  buildShareCode() {
    const field = h('input', { class: 'input', type: 'text', value: encodeCrosshair(this.game.settings.crosshair), 'aria-label': 'Crosshair code', spellcheck: 'false' });
    const message = h('p', { class: 'inline-msg', 'aria-live': 'polite' });
    const copy = h('button', { class: 'btn', onClick: async () => {
      field.value = encodeCrosshair(this.game.settings.crosshair);
      try {
        await navigator.clipboard.writeText(field.value);
        message.className = 'inline-msg';
        message.textContent = 'Code copied.';
      } catch (error) {
        field.select();
        message.textContent = 'Select the code and copy it with Ctrl+C.';
      }
    } }, 'Copy');
    const load = h('button', { class: 'btn', onClick: () => {
      const cfg = decodeCrosshair(field.value);
      if (!cfg) {
        message.className = 'inline-msg is-error';
        message.textContent = 'That code is not a valid crosshair. Check it was copied in full.';
        return;
      }
      this.applyCrosshair(cfg);
    } }, 'Load');
    return h('div', { class: 'field' },
      h('span', { class: 'field-label' }, 'Crosshair code'),
      h('div', { class: 'code-row' }, field, copy, load),
      message);
  }

  /* Live update while dragging: no re-render, only preview + game crosshair */
  updateCrosshair(patch) {
    this.game.updateCrosshair(patch);
    this.refreshPreview();
  }

  /* Whole-config change (preset, reset, import): re-render so every control matches */
  applyCrosshair(patch) {
    this.game.updateCrosshair(patch);
    this.renderBody();
  }

  refreshPreview() {
    if (this.preview) this.preview.innerHTML = buildCrosshairSVG(mergeCrosshairConfig(this.game.settings.crosshair));
  }
}

/* Marvel Rivals yaw: 0.0176 deg per count per sensitivity point (same constant as Game) */
export function cmPer360(sensitivity, dpi) {
  const counts = 360 / (sensitivity * 0.0176);
  return (counts / (dpi || 800)) * 2.54;
}

function qualityHint(id) {
  if (id === 'low') return 'Fastest. No effects, native resolution capped at 1x.';
  if (id === 'high') return 'Soft shadows and light bloom. Needs a stronger GPU.';
  return 'Balanced. Kill effects on, shadows off.';
}

function encodeCrosshair(cfg) {
  try {
    return btoa(JSON.stringify(mergeCrosshairConfig(cfg)));
  } catch (error) {
    return '';
  }
}

function decodeCrosshair(code) {
  try {
    const parsed = JSON.parse(atob(String(code).trim()));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return mergeCrosshairConfig(parsed);
  } catch (error) {
    return null;
  }
}
