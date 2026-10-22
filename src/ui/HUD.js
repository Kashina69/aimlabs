import { h, svg, fmt } from './dom.js';

const TICKS = `<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <path d="M8 8l6 6M36 8l-6 6M8 36l6-6M36 36l-6-6"/></svg>`;

/* In-game HUD. Score, timer and accuracy sit top-center away from the crosshair;
   values swap instantly (they change constantly, so they never animate).
   Text nodes are cached and only written when the shown string changes. */
export class HUD {
  constructor(container, game) {
    this.game = game;
    this.cache = {};

    this.score = h('span', { class: 'hud-value num' }, '0');
    this.time = h('span', { class: 'hud-value num' }, '0.0');
    this.accuracy = h('span', { class: 'hud-value num' }, '0.0%');
    this.streak = h('span', { class: 'hud-streak num' });
    this.timerCell = h('div', { class: 'hud-cell hud-timer' }, this.time, this.streak);
    this.fps = h('span', { class: 'num' });
    this.sens = h('span', { class: 'num' });
    this.meta = h('div', { class: 'hud-meta' }, this.fps, this.sens);

    this.element = h('div', { class: 'hud', id: 'hud', 'aria-hidden': 'true' },
      h('div', { class: 'hud-top' },
        h('div', { class: 'hud-cell' }, h('span', { class: 'hud-label' }, 'Score'), this.score),
        this.timerCell,
        h('div', { class: 'hud-cell' }, h('span', { class: 'hud-label' }, 'Accuracy'), this.accuracy)
      ),
      this.meta
    );
    container.appendChild(this.element);

    this.ticks = h('div', { class: 'hit-ticks', 'aria-hidden': 'true' }, svg(TICKS));
    container.appendChild(this.ticks);
    this.setVisible(false);
  }

  setVisible(visible) {
    this.element.classList.toggle('hidden', !visible);
    this.ticks.classList.toggle('hidden', !visible);
  }

  setMetaVisible(visible) {
    this.meta.classList.toggle('hidden', !visible);
  }

  update(state) {
    this.write('score', this.score, fmt.int(state.score));
    this.write('accuracy', this.accuracy, fmt.pct(state.accuracy));
    this.write('time', this.time, state.timeLeft == null ? '' : fmt.clock(state.timeLeft));
    this.write('streak', this.streak, state.combo >= 5 ? `${state.combo} streak` : '');
    const low = state.timeLeft != null && state.timeLeft <= 10;
    if (this.cache.low !== low) {
      this.cache.low = low;
      this.timerCell.classList.toggle('is-low', low);
    }
    this.write('sens', this.sens, `sens ${this.game.settings.sensitivity.toFixed(2)}`);
  }

  setFPS(fps) {
    this.write('fps', this.fps, `${fps || 0} fps`);
  }

  /* Kill confirmation around the crosshair: in fast, out slower (CSS transition) */
  flashHit() {
    this.ticks.classList.add('is-hit');
    clearTimeout(this.tickTimer);
    this.tickTimer = setTimeout(() => this.ticks.classList.remove('is-hit'), 70);
  }

  write(key, node, text) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    node.textContent = text;
  }
}
