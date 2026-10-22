import { h, svg, fmt } from './dom.js';
import { MODE_ORDER, modeTitle } from '../modes/catalog.js';
import { runsFor, summarize } from '../utils/records.js';
import { StatsManager } from '../utils/StatsManager.js';
import { drawTrend } from './charts.js';

const BACK_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l-6 6 6 6"/></svg>`;

/* Stats page: per-drill tabs, records, score trend with hover readout, recent runs.
   Run rows are built with text nodes only (stored sessions are untrusted input). */
export class StatsPage {
  constructor(game) {
    this.game = game;
    this.tab = MODE_ORDER.find((key) => runsFor(key).length) || MODE_ORDER[0];
    this.tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Drills' });
    this.content = h('div', { class: 'stats-inner' });

    this.el = h('div', { class: 'stats interactive', id: 'stats' },
      h('header', { class: 'stats-top' },
        h('div', { class: 'stats-top-left' },
          h('button', { class: 'btn btn-icon', 'aria-label': 'Back to menu', onClick: () => game.showHome() }, svg(BACK_ICON)),
          h('h1', { class: 'stats-title' }, 'Stats')
        ),
        this.tabs
      ),
      h('div', { class: 'stats-body' }, this.content)
    );
    this.render();
    this.onResize = () => this.drawChart();
    window.addEventListener('resize', this.onResize);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }

  render() {
    this.tabs.replaceChildren(...MODE_ORDER.map((key) => h('button', {
      role: 'tab',
      'aria-selected': String(key === this.tab),
      onClick: () => {
        this.tab = key;
        this.render();
      }
    }, modeTitle(key))));

    const summary = summarize(this.tab);
    if (!summary) {
      this.content.replaceChildren(this.buildEmpty());
      return;
    }

    const runs = runsFor(this.tab);
    this.chartCanvas = h('canvas', { role: 'img', 'aria-label': `Score trend for ${modeTitle(this.tab)}` });
    this.chartTip = h('div', { class: 'chart-tip hidden' });
    this.chartRuns = runs.slice(-40);

    this.content.replaceChildren(
      h('dl', { class: 'records' },
        record('Best score', fmt.int(summary.best)),
        record('Accuracy', fmt.pct(summary.accuracy)),
        record('Runs', fmt.int(summary.runs)),
        record('Time trained', `${Math.max(1, Math.round(summary.playMinutes))} min`)
      ),
      h('section', { class: 'figure' },
        h('div', { class: 'figure-head' },
          h('h2', { class: 'figure-title' }, 'Score trend'),
          h('span', { class: 'figure-note' }, `Last ${this.chartRuns.length} runs, best marked`)),
        h('div', { class: 'stats-chart' }, this.chartCanvas, this.chartTip)
      ),
      h('section', { class: 'figure' },
        h('h2', { class: 'figure-title' }, 'Recent runs'),
        this.buildTable(runs.slice(-15).reverse())
      ),
      h('div', { class: 'stats-foot' }, this.buildClearButton())
    );

    this.chartCanvas.addEventListener('mousemove', (e) => this.showTip(e));
    this.chartCanvas.addEventListener('mouseleave', () => this.chartTip.classList.add('hidden'));
    requestAnimationFrame(() => this.drawChart());
  }

  drawChart() {
    if (!this.chartCanvas?.isConnected) return;
    this.chartPoints = drawTrend(this.chartCanvas, this.chartRuns.map((r) => Number(r.score) || 0), { highlightLast: false });
  }

  /* Hover readout: nearest run to the cursor */
  showTip(event) {
    if (!this.chartPoints?.length) return;
    const rect = this.chartCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let nearest = 0;
    this.chartPoints.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(this.chartPoints[nearest].x - x)) nearest = i;
    });
    const run = this.chartRuns[nearest];
    const point = this.chartPoints[nearest];
    this.chartTip.textContent = `${fmt.int(run.score)} · ${fmt.date(run.end)}`;
    this.chartTip.style.left = `${point.x}px`;
    this.chartTip.style.top = `${point.y}px`;
    this.chartTip.classList.remove('hidden');
  }

  buildTable(runs) {
    return h('table', { class: 'runs' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Date'),
        h('th', { class: 'hide-sm' }, 'Time'),
        h('th', { class: 'num-col' }, 'Score'),
        h('th', { class: 'num-col' }, 'Accuracy'),
        h('th', { class: 'num-col hide-sm' }, 'Hits'),
        h('th', { class: 'num-col hide-sm' }, 'Best streak')
      )),
      h('tbody', {}, ...runs.map((run) => h('tr', {},
        h('td', {}, fmt.date(run.end)),
        h('td', { class: 'hide-sm' }, fmt.time(run.end)),
        h('td', { class: 'num num-col' }, fmt.int(run.score)),
        h('td', { class: 'num num-col' }, fmt.pct(run.accuracy)),
        h('td', { class: 'num num-col hide-sm' }, `${fmt.int(run.hits)} / ${fmt.int(run.shots)}`),
        h('td', { class: 'num num-col hide-sm' }, run.maxCombo == null ? '' : fmt.int(run.maxCombo))
      )))
    );
  }

  buildEmpty() {
    return h('div', { class: 'empty' },
      h('h3', {}, `No ${modeTitle(this.tab)} runs yet`),
      h('p', {}, 'Finish a run and your score, accuracy and trend will be tracked here.'),
      h('button', { class: 'btn btn-primary', onClick: () => this.game.startMode(this.tab) }, `Play ${modeTitle(this.tab)}`)
    );
  }

  /* Destructive: hold for 1.2s to confirm instead of a confirm() popup */
  buildClearButton() {
    const label = h('span', {}, 'Hold to clear all history');
    const button = h('button', { class: 'btn btn-text hold' }, label);
    let timer = null;
    const start = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      button.classList.add('is-holding');
      timer = setTimeout(() => {
        StatsManager.clear();
        this.render();
      }, 1200);
    };
    const cancel = () => {
      button.classList.remove('is-holding');
      clearTimeout(timer);
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', cancel);
    button.addEventListener('pointerleave', cancel);
    button.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) start(e); });
    button.addEventListener('keyup', cancel);
    return button;
  }
}

function record(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', { class: 'num' }, value));
}
