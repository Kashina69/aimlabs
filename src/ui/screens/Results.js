import { h, fmt, prefersReducedMotion } from '../dom.js';
import { modeTitle, DIFFICULTY_PRESETS } from '../../modes/catalog.js';
import { scoreHistory } from '../../utils/records.js';
import { drawMissMap, drawTrend, describeMisses } from '../charts.js';

/* Results: score ticks up, record status, stat grid, shot placement map, score trend.
   summary = saved session + { shotLog, previousBest } */
export function createResultsScreen(game, summary) {
  const modeKey = summary.mode;
  const score = Math.round(summary.score || 0);
  const isBest = summary.previousBest === null || score > summary.previousBest;
  const difficulty = summary.difficulty === 'custom' ? 'Custom' : DIFFICULTY_PRESETS[summary.difficulty]?.label;

  const scoreNode = h('div', { class: 'results-score num', 'aria-label': `Score ${fmt.int(score)}` }, '0');
  const missMap = h('canvas', { class: 'miss-map', role: 'img', 'aria-label': 'Shot placement relative to targets' });
  const trend = h('canvas', { class: 'trend', role: 'img', 'aria-label': 'Score over recent runs' });
  const shots = summary.shotLog || [];
  const retry = h('button', { class: 'btn btn-primary btn-lg', onClick: () => game.restart() },
    h('span', {}, 'Retry'), h('span', { class: 'kbd' }, 'R'));

  const element = h('div', { class: 'results interactive', id: 'results' },
    h('article', { class: 'results-card panel', 'aria-labelledby': 'results-title' },
      h('section', { class: 'results-main' },
        h('div', { class: 'results-mode' },
          h('h2', { id: 'results-title', class: 'field-label' }, modeTitle(modeKey)),
          difficulty ? h('span', { class: 'badge badge-quiet' }, difficulty) : null
        ),
        scoreNode,
        h('div', { class: 'results-pb' }, ...recordLine(summary, score, isBest)),
        h('dl', { class: 'results-stats' }, ...statItems(summary).map(([label, value, extra], i) =>
          h('div', { style: `--i:${i}` }, h('dt', {}, label), h('dd', { class: 'num' }, value, extra ? h('small', {}, ` ${extra}`) : null))
        )),
        h('div', { class: 'results-actions' },
          retry,
          h('button', { class: 'btn btn-lg', onClick: () => game.showHome() }, 'Change drill')
        )
      ),
      h('section', { class: 'results-side' },
        h('figure', { class: 'figure' },
          h('div', { class: 'figure-head' },
            h('figcaption', { class: 'figure-title' }, 'Shot placement'),
            h('ul', { class: 'legend' },
              h('li', { style: '--key: var(--ink)' }, h('i'), 'Hit'),
              h('li', { style: '--key: var(--bad)' }, h('i'), 'Miss'))
          ),
          missMap,
          h('p', { class: 'figure-note' }, describeMisses(shots))
        ),
        h('figure', { class: 'figure' },
          h('div', { class: 'figure-head' },
            h('figcaption', { class: 'figure-title' }, 'Recent runs'),
            h('span', { class: 'figure-note' }, 'Best marked, this run circled')
          ),
          trend,
          scoreHistory(modeKey, 2).length < 2 ? h('p', { class: 'figure-note' }, 'Your trend appears after a second run.') : null
        )
      )
    )
  );

  requestAnimationFrame(() => {
    drawMissMap(missMap, shots);
    drawTrend(trend, scoreHistory(modeKey, 10));
    tickScore(scoreNode, score);
    retry.focus({ preventScroll: true });
  });
  if (isBest && score > 0) game.audio.play('best');
  return element;
}

function recordLine(summary, score, isBest) {
  if (score <= 0) return [h('span', {}, 'No score this run.')];
  if (summary.previousBest === null) return [h('span', { class: 'badge' }, 'First record'), h('span', {}, 'Your first run on this drill.')];
  if (isBest) {
    return [h('span', { class: 'badge' }, 'New best'),
      h('span', {}, 'Previous ', h('span', { class: 'num' }, fmt.int(summary.previousBest)))];
  }
  const gap = summary.previousBest - score;
  return [h('span', { class: 'badge badge-quiet' }, h('span', { class: 'num' }, `Best ${fmt.int(summary.previousBest)}`)),
    h('span', {}, h('span', { class: 'num' }, fmt.int(gap)), ' short of your best')];
}

function statItems(s) {
  const seconds = (s.duration || 60000) / 1000;
  const items = [
    ['Accuracy', fmt.pct(s.accuracy)],
    ['Hits', fmt.int(s.hits), `/ ${fmt.int(s.shots)}`],
    ['Kills per second', ((s.hits || 0) / seconds).toFixed(2)],
    ['Best streak', fmt.int(s.maxCombo)]
  ];
  if (s.avgReaction) {
    items.push(['Avg reaction', fmt.ms(s.avgReaction)]);
    items.push(['Best reaction', fmt.ms(s.bestReaction)]);
  } else if (s.avgKillMs) {
    items.push(['Avg time to kill', fmt.ms(s.avgKillMs)]);
    items.push(['Shots per kill', s.hits ? (s.shots / s.hits).toFixed(2) : '0']);
  }
  return items;
}

/* Number ticker: counts up over 600ms with a strong ease-out; instant under reduced motion */
function tickScore(node, target) {
  if (prefersReducedMotion() || target <= 0) {
    node.textContent = fmt.int(target);
    return;
  }
  const start = performance.now();
  const duration = 600;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    node.textContent = fmt.int(target * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
