import { h, svg, fmt, syncSliderFill, prefersReducedMotion } from '../dom.js';
import { MODE_ORDER, MODE_INFO, DIFFICULTY_PRESETS } from '../../modes/catalog.js';
import { bestFor, lastFor, scoreHistory, summarize } from '../../utils/records.js';
import { drawSparkline } from '../charts.js';
import { Storage } from '../../utils/Storage.js';
import { buildCrosshairSVG, mergeCrosshairConfig } from '../Crosshair.js';
import { cmPer360 } from '../Settings.js';

const BRAND_MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>`;
const STATS_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 16V9M10 16V4M16 16v-5"/></svg>`;
const GEAR_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/></svg>`;

/* Home is a launcher, not a landing page:
   - rail (left): pick a drill, see your loadout, reach Stats / Settings
   - stage (right): the 3D range plays a ghost run of the selected drill, and the
     drill card at the bottom holds its record, difficulty and Start.
   Game offsets the 3D camera by stageOffset() so the ghost run is centred in the stage. */
export class HomeScreen {
  constructor(game, { animate = false } = {}) {
    this.game = game;
    const stored = Storage.get('ui.lastMode', MODE_ORDER[0]);
    this.selected = MODE_ORDER.includes(stored) ? stored : MODE_ORDER[0];

    this.list = h('ul', { class: 'drill-list', role: 'list' });
    this.card = h('article', { class: 'drill-card panel', 'aria-live': 'polite', 'aria-labelledby': 'drill-title' });
    this.rail = h('aside', { class: 'rail', 'aria-label': 'Drills and loadout' },
      h('header', { class: 'rail-head' }, h('div', { class: 'brand' }, svg(BRAND_MARK), 'AimLabs')),
      h('section', { class: 'rail-section rail-drills', 'aria-labelledby': 'drills-label' },
        h('h2', { class: 'rail-label', id: 'drills-label' }, 'Drills'),
        this.list
      ),
      this.buildLoadout(),
      this.buildRailFoot()
    );

    this.element = h('div', { class: `home interactive${animate ? ' is-entering' : ''}`, id: 'home' },
      this.rail,
      h('section', { class: 'stage', 'aria-label': 'Selected drill' }, this.card)
    );

    this.renderList();
    this.renderCard();
    if (animate) setTimeout(() => this.element.classList.remove('is-entering'), 900);
  }

  /* How far to shift the 3D view (px) so the ghost run sits centred in the stage */
  stageOffset() {
    const rail = this.rail.getBoundingClientRect();
    const card = this.card.getBoundingClientRect();
    if (window.innerWidth < 980 || !rail.width) return { x: 0, y: 0 };
    return { x: rail.width / 2, y: Math.max(0, (window.innerHeight - card.top) / 2 - 24) };
  }

  /* ---------- Rail ---------- */

  renderList() {
    this.list.replaceChildren(...MODE_ORDER.map((key, i) => {
      const info = MODE_INFO[key];
      const best = bestFor(key);
      return h('li', { style: `--i:${i}` },
        h('button', {
          class: 'drill-row',
          'aria-pressed': String(key === this.selected),
          'aria-keyshortcuts': String(i + 1),
          dataset: { mode: key },
          onClick: () => this.select(key)
        },
          h('span', { class: 'drill-icon' }, svg(info.diagram)),
          h('span', { class: 'drill-text' },
            h('span', { class: 'drill-name' }, info.title),
            h('span', { class: 'drill-sub' }, info.sub)),
          h('span', { class: 'drill-meta' },
            best
              ? h('span', { class: 'drill-best num', title: 'Best score' }, fmt.int(best.score))
              : h('span', { class: 'drill-best is-empty' }, 'New'),
            h('span', { class: 'kbd drill-key', 'aria-hidden': 'true' }, String(i + 1)))
        )
      );
    }));
  }

  /* Loadout: what the player is about to aim with. One click to change it. */
  buildLoadout() {
    const s = this.game.settings;
    const xh = h('span', { class: 'loadout-xh', 'aria-hidden': 'true' });
    xh.innerHTML = buildCrosshairSVG(mergeCrosshairConfig(s.crosshair));
    const neverSet = Storage.get('settings.sensitivity', null) === null;

    return h('section', { class: 'rail-section rail-loadout', 'aria-labelledby': 'loadout-label' },
      h('h2', { class: 'rail-label', id: 'loadout-label' }, 'Loadout'),
      h('button', { class: 'loadout', onClick: () => this.game.openSettings('controls'), 'aria-label': 'Edit sensitivity, field of view and crosshair' },
        xh,
        h('dl', { class: 'loadout-stats' },
          stat('Sens', s.sensitivity.toFixed(2)),
          stat('cm/360', cmPer360(s.sensitivity, s.dpi).toFixed(1)),
          stat('FOV', String(Math.round(s.fov)))),
        h('span', { class: 'loadout-edit' }, 'Edit')
      ),
      neverSet
        ? h('p', { class: 'loadout-nudge' }, 'Set the sensitivity you use in your main game so aim transfers 1:1.')
        : null
    );
  }

  buildRailFoot() {
    const totals = summarize(null);
    return h('footer', { class: 'rail-foot' },
      h('div', { class: 'rail-actions' },
        h('button', { class: 'btn btn-text', onClick: () => this.game.showStats(), 'aria-keyshortcuts': 'S' },
          svg(STATS_ICON), 'Stats', h('span', { class: 'kbd' }, 'S')),
        h('button', { class: 'btn btn-text', onClick: () => this.game.openSettings(), 'aria-keyshortcuts': ',' },
          svg(GEAR_ICON), 'Settings', h('span', { class: 'kbd' }, ','))
      ),
      h('p', { class: 'rail-progress' },
        totals
          ? [h('span', { class: 'num' }, fmt.int(totals.runs)), totals.runs === 1 ? ' run' : ' runs', ' · ',
             h('span', { class: 'num' }, String(Math.max(1, Math.round(totals.playMinutes)))), ' min trained']
          : 'Your runs and training time will add up here.')
    );
  }

  /* ---------- Drill card ---------- */

  select(key) {
    if (key === this.selected) return;
    this.selected = key;
    Storage.set('ui.lastMode', key);
    this.game.audio.play('click');
    for (const row of this.list.querySelectorAll('.drill-row')) {
      row.setAttribute('aria-pressed', String(row.dataset.mode === key));
    }
    this.renderCard();
    this.game.onHomeSelection?.(key);
    if (!prefersReducedMotion()) {
      this.card.animate(
        [{ opacity: 0.4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      );
    }
  }

  renderCard() {
    const key = this.selected;
    const info = MODE_INFO[key];
    const best = bestFor(key);
    const last = lastFor(key);
    const summary = summarize(key);

    const records = summary
      ? h('div', { class: 'card-records' },
          h('dl', { class: 'card-stats' },
            stat('Best', fmt.int(best.score)),
            stat('Last', fmt.int(last.score)),
            stat('Runs', fmt.int(summary.runs)),
            stat('Accuracy', fmt.pct(summary.accuracy))),
          h('canvas', { class: 'sparkline', 'aria-hidden': 'true' }))
      : h('div', { class: 'card-records is-empty' },
          h('p', { class: 'card-empty-title' }, 'No runs yet'),
          h('p', { class: 'card-empty' }, 'Start one to set your first record.'));

    this.card.replaceChildren(...[
      h('div', { class: 'card-top' },
        h('div', { class: 'card-main' },
          h('h1', { class: 'card-title', id: 'drill-title' }, info.title),
          h('p', { class: 'card-desc' }, info.desc),
          h('ul', { class: 'facts' }, ...info.facts.map((f) => h('li', {}, f)))
        ),
        records
      ),
      this.buildDifficulty(),
      h('div', { class: 'card-bottom' },
        this.buildDifficultyControl(),
        h('button', { class: 'btn btn-primary btn-lg card-start', onClick: () => this.start() },
          h('span', {}, `Start ${info.title}`), h('span', { class: 'kbd' }, 'Enter'))
      )
    ].filter(Boolean));

    const spark = this.card.querySelector('.sparkline');
    if (spark) requestAnimationFrame(() => drawSparkline(spark, scoreHistory(key, 12)));
  }

  buildDifficultyControl() {
    const current = this.game.settings.difficulty || 'normal';
    const options = [...Object.entries(DIFFICULTY_PRESETS).map(([id, p]) => [id, p.label]), ['custom', 'Custom']];
    return h('div', { class: 'card-difficulty' },
      h('span', { class: 'field-label', id: 'difficulty-label' }, 'Difficulty'),
      h('div', { class: 'segmented', role: 'group', 'aria-labelledby': 'difficulty-label' },
        ...options.map(([id, label]) => h('button', {
          'aria-pressed': String(id === current),
          onClick: () => {
            this.game.setDifficulty(id);
            this.renderCard();
          }
        }, label)))
    );
  }

  /* Custom difficulty reveals the three raw sliders above the controls */
  buildDifficulty() {
    if ((this.game.settings.difficulty || 'normal') !== 'custom') return null;
    const s = this.game.settings;
    const row = (label, key, min, max, step) => {
      const slider = h('input', { class: 'slider', type: 'range', min, max, step, value: s[key], 'aria-label': label });
      const number = h('input', { class: 'input input-num', type: 'number', min, max, step, value: s[key], 'aria-label': `${label} value` });
      syncSliderFill(slider);
      const commit = (raw) => {
        const value = parseFloat(raw);
        if (Number.isNaN(value)) return;
        slider.value = value;
        number.value = value;
        syncSliderFill(slider);
        this.game.setSetting(key, value);
      };
      slider.addEventListener('input', (e) => commit(e.target.value));
      number.addEventListener('change', (e) => commit(e.target.value));
      return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'field-row' }, slider, number));
    };
    return h('div', { class: 'custom-difficulty' },
      row('Target size', 'targetSize', 0.05, 1, 0.01),
      row('Spawn speed', 'spawnSpeed', 0, 5, 0.05),
      row('Movement speed', 'movementSpeed', 0, 3, 0.05)
    );
  }

  start() {
    this.game.audio.play('click');
    this.game.startMode(this.selected);
  }

  /* Keyboard paths, routed here by Game's global key handler */
  moveSelection(event) {
    event.preventDefault();
    const index = MODE_ORDER.indexOf(this.selected);
    const next = (index + (event.code === 'ArrowDown' ? 1 : -1) + MODE_ORDER.length) % MODE_ORDER.length;
    this.selectAndFocus(next);
  }

  selectByNumber(n) {
    if (n >= 1 && n <= MODE_ORDER.length) this.selectAndFocus(n - 1);
  }

  selectAndFocus(index) {
    this.select(MODE_ORDER[index]);
    this.list.querySelector(`[data-mode="${MODE_ORDER[index]}"]`)?.focus();
  }
}

function stat(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', { class: 'num' }, value));
}
