import { h, prepareCanvas, token } from '../dom.js';
import { GAME_PROFILES, getProfileOrDefault } from '../GameProfiles.js';
import { fixed, inPer360, sensitivityForCm360 } from '../../utils/sensitivity.js';
import { fitQuadratic } from '../../sensfinder/Bracket.js';
import { SensTestStore } from '../../utils/SensTestStore.js';
import { drawMissMap } from '../charts.js';

/**
 * What: The finder's result report.
 * Why:  The player needs a precise, copyable value plus honest uncertainty, proof of
 *       how it was measured, and a one-click way to adopt it.
 * How:  Renders the fitted optimum, interval, diagnostics, error curve, zone split,
 *       shot map, per-game table and input checks; Apply writes the 6-dp sensitivity.
 *
 * The five-decimal figure is the exact conversion of the fitted optimum, NOT a
 * claim of five-decimal experimental truth: the interval line under it is the
 * real uncertainty, and the tested candidates are printed on the curve so the
 * interpolation is visible.
 */

const CONFIDENCE = {
  high: { label: 'High confidence', tone: '' },
  medium: { label: 'Medium confidence', tone: 'badge-quiet' },
  low: { label: 'Low confidence', tone: 'badge-quiet' }
};

/**
 * What: Builds the report overlay and wires Apply/Undo, copy and navigation.
 * Why:  The stored record should stay data-only; DOM and clipboard live here.
 * How:  One closure holds the apply state; chart/canvas work is deferred to rAF.
 */
export function createSensResultsScreen(game, record) {
  const profile = getProfileOrDefault(record.profileId);
  const cm = record.bestCm360;
  const inches = record.bestIn360 ?? inPer360(cm);
  const confidence = CONFIDENCE[record.confidence] || CONFIDENCE.low;
  const interval = Array.isArray(record.ci) ? record.ci : null;

  const message = h('p', { class: 'inline-msg', 'aria-live': 'polite' });
  const undoBtn = h('button', { class: 'btn hidden' }, 'Undo');
  const applyBtn = h('button', { class: 'btn btn-primary btn-lg' }, 'Apply to settings');
  let applied = false;

  applyBtn.addEventListener('click', () => {
    if (applied) return;
    game.applySensResult(record);
    applied = true;
    applyBtn.textContent = 'Applied';
    applyBtn.disabled = true;
    undoBtn.classList.remove('hidden');
    message.className = 'inline-msg';
    message.textContent = `Settings now use ${profile.short} ${fixed(record.bestSensitivity, 4)}.`;
  });
  undoBtn.addEventListener('click', () => {
    game.setSetting('game', record.originalGame);
    game.setSetting('sensitivity', record.originalSensitivity);
    applied = false;
    applyBtn.textContent = 'Apply to settings';
    applyBtn.disabled = false;
    undoBtn.classList.add('hidden');
    message.textContent = 'Previous sensitivity restored.';
  });

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      message.className = 'inline-msg';
      message.textContent = `${label} copied.`;
    } catch (error) {
      message.className = 'inline-msg is-error';
      message.textContent = 'Clipboard blocked — select the value and copy it manually.';
    }
  };

  const curve = h('canvas', { class: 'sens-curve', role: 'img', 'aria-label': 'Landing error against sensitivity' });
  const missMap = h('canvas', { class: 'miss-map', role: 'img', 'aria-label': 'Shot placement relative to targets' });
  const lastRound = record.rounds?.[record.rounds.length - 1];

  const history = SensTestStore.summary(record.profileId);
  const historyText = history && history.count > 1
    ? [
        history.previous ? `Previous ${history.previous.toFixed(2)}` : null,
        `median of ${history.count} tests ${history.median.toFixed(2)} cm/360`
      ].filter(Boolean).join(' · ')
    : 'This is your first test on this profile.';

  const gameRows = GAME_PROFILES.map((entry) => {
    const exact = sensitivityForCm360(cm, record.effectiveCpi, entry.yaw);
    const inRange = exact >= entry.min && exact <= entry.max;
    return { entry, exact, inRange };
  });

  const allGamesText = [
    `cm/360: ${fixed(cm, 5)}`,
    `in/360: ${fixed(inches, 5)}`,
    ...gameRows.map(({ entry, exact }) => `${entry.name}: ${fixed(exact, 6)}`)
  ].join('\n');

  const element = h('div', { class: 'sens-results interactive', id: 'sens-results' },
    h('article', { class: 'sens-card panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sens-results-title' },
      h('section', { class: 'sens-main' },
        h('div', { class: 'sens-result-head' },
          h('h2', { class: 'field-label', id: 'sens-results-title' }, 'Your sensitivity'),
          h('span', { class: `badge ${confidence.tone}` }, confidence.label)
        ),
        h('div', { class: 'sens-hero' },
          h('span', { class: 'sens-big num' }, fixed(cm, 5)),
          h('span', { class: 'sens-unit' }, 'cm / 360°')
        ),
        h('p', { class: 'sens-hero-sub' },
          h('span', { class: 'num' }, fixed(inches, 5)), ' in / 360° · ',
          h('span', { class: 'num' }, Math.round(record.countsPer360)), ' counts',
          record.fitted ? ' · fitted optimum' : ' · best measured point'),
        interval
          ? h('p', { class: 'sens-ci' },
              h('span', { class: 'num' }, `±${fixed((interval[1] - interval[0]) / 2, 3)}`),
              ' cm/360 (95% interval ',
              h('span', { class: 'num' }, fixed(interval[0], 3)),
              '–',
              h('span', { class: 'num' }, fixed(interval[1], 3)),
              ')')
          : h('p', { class: 'sens-ci' }, 'Interval unavailable — run a Thorough test for a tighter estimate.'),
        h('p', { class: 'sens-note' }, 'Five decimals is the exact conversion of the fitted optimum. The experimental uncertainty is the interval above, so enter the rounded value your game or converter accepts.'),

        h('dl', { class: 'sens-stats' },
          stat('Sensitivity', `${profile.short} ${fixed(record.bestSensitivity, 4)}`),
          stat('eDPI', Math.round(record.edpi)),
          stat('Effective CPI', Math.round(record.effectiveCpi)),
          stat('Tested (cm/360)', (record.testedCm || []).map((value) => value.toFixed(1)).join(' / ')),
          stat('Zones', '45° 60% · Wide 40%'),
          stat('Attempted', `${Math.round((record.attemptRate || 0) * 100)}%`)
        ),

        h('div', { class: 'sens-actions' },
          applyBtn,
          undoBtn,
          h('button', { class: 'btn', onClick: () => copy(fixed(cm, 5), 'cm/360') }, 'Copy cm/360'),
          h('button', { class: 'btn', onClick: () => copy(fixed(inches, 5), 'in/360') }, 'Copy in/360'),
          h('button', { class: 'btn', onClick: () => copy(allGamesText, 'All values') }, 'Copy all games'),
          h('button', { class: 'btn btn-text', onClick: () => game.openSensSetup() }, 'Test again'),
          h('button', { class: 'btn btn-text', onClick: () => game.showHome() }, 'Home')
        ),
        message
      ),

      h('section', { class: 'sens-side' },
        h('figure', { class: 'figure' },
          h('div', { class: 'figure-head' },
            h('figcaption', { class: 'figure-title' }, 'Error curve'),
            h('span', { class: 'figure-note' }, 'lower is better')),
          curve,
          h('p', { class: 'figure-note' }, 'Dots are the sensitivities actually tested; the line is the fit. The chosen value sits at the bottom.')
        ),
        zoneFigure(record),
        h('figure', { class: 'figure' },
          h('div', { class: 'figure-head' },
            h('figcaption', { class: 'figure-title' }, 'Shot placement'),
            h('span', { class: 'figure-note' }, 'relative to target centre')),
          missMap,
          h('p', { class: 'figure-note' }, 'Tight cluster near the centre is what a good sensitivity looks like. Bias left/right is the systematic error the fit minimises.')
        ),
        gameTable(gameRows),
        checksFigure(record),
        h('p', { class: 'sens-note' }, historyText)
      )
    )
  );

  requestAnimationFrame(() => {
    drawErrorCurve(curve, lastRound, cm);
    drawMissMap(missMap, record.shotLog || []);
    applyBtn.focus({ preventScroll: true });
  });

  return element;
}

function stat(label, value) {
  return h('div', {}, h('dt', {}, label), h('dd', { class: 'num' }, value));
}

function zoneFigure(record) {
  const cone = record.zones?.cone?.score || 0;
  const wide = record.zones?.wide?.score || 0;
  const max = Math.max(cone, wide) || 1;
  const bar = (label, value, weight) => h('div', { class: 'sens-zone' },
    h('div', { class: 'sens-zone-head' },
      h('span', {}, label),
      h('span', { class: 'num' }, value.toFixed(2))),
    h('div', { class: 'sens-zone-track' }, h('i', { style: `width:${Math.round((value / max) * 100)}%` })),
    h('p', { class: 'figure-note' }, weight));

  return h('figure', { class: 'figure' },
    h('div', { class: 'figure-head' },
      h('figcaption', { class: 'figure-title' }, 'Where the score came from'),
      h('span', { class: 'figure-note' }, 'error, lower is better')),
    bar('Cone 45', cone, 'Real-world candidate, weighted 60%'),
    bar('Wide', wide, 'Mouse-control candidate, weighted 40%'),
    h('p', { class: 'figure-note' }, 'Zones are normalised inside each round before weighting, so the 45° targets being smaller and farther cannot skew the split.')
  );
}

function gameTable(rows) {
  return h('figure', { class: 'figure' },
    h('div', { class: 'figure-head' },
      h('figcaption', { class: 'figure-title' }, 'Your value in each game'),
      h('span', { class: 'figure-note' }, 'same 360° distance')),
    h('div', { class: 'sens-games' },
      ...rows.map(({ entry, exact, inRange }) => h('div', { class: 'sens-game' },
        h('span', { class: 'sens-game-name' }, entry.name),
        h('span', { class: `num${inRange ? '' : ' is-clamped'}` }, fixed(exact, 6)),
        h('span', { class: 'sens-game-short' }, entry.short)))),
    h('p', { class: 'figure-note' }, 'Some games round to fewer decimals or clamp to their own range. cm/360 is the exact value to paste into a converter.')
  );
}

function checksFigure(record) {
  const checks = record.checks || {};
  const acceleration = checks.acceleration === 'detected'
    ? ['Pointer acceleration', 'Detected', 'warn', 'Turn off "Enhance pointer precision" — turn speed is not linear with distance.']
    : checks.acceleration === 'ok'
      ? ['Pointer acceleration', 'Not detected', 'ok', `Slow/fast sweep ratio ${checks.accelerationRatio || 1}`]
      : ['Pointer acceleration', 'Not checked', 'info', 'Run the test with the input check enabled.'];

  const dpr = checks.dpr || 1;
  return h('figure', { class: 'figure' },
    h('div', { class: 'figure-head' },
      h('figcaption', { class: 'figure-title' }, 'Input integrity'),
      h('span', { class: 'figure-note' }, record.calibrated ? 'pad-calibrated' : 'DPI-derived')),
    h('ul', { class: 'sens-checks' },
      checkRow('Display scaling', `DPR ${dpr.toFixed(2)}`, dpr === 1 ? 'ok' : 'warn',
        dpr === 1 ? 'Counts map 1:1 at 100% browser zoom.' : 'Scaling is active. A measured 360 distance is more trustworthy than DPI here.'),
      checkRow(...acceleration),
      checkRow('360 distance source', record.calibrated ? 'Measured' : 'DPI', record.calibrated ? 'ok' : 'info',
        record.calibrated
          ? `Effective ${Math.round(record.effectiveCpi)} CPI from a ${record.measuredCm360} cm turn.`
          : 'No measured distance entered, so this value assumes your DPI and 100% OS/browser scale.'))
  );
}

function checkRow(label, value, status, hint) {
  return h('li', { class: `sens-check is-${status}` },
    h('div', { class: 'sens-check-head' },
      h('span', { class: 'sens-check-label' }, label),
      h('span', { class: `badge${status === 'ok' ? '' : ' badge-quiet'}` }, value)),
    h('p', { class: 'sens-check-hint' }, hint));
}

/* Error curve: the three tested candidates in log-sensitivity space, the fitted
   parabola, and the chosen optimum. Y is relative to the best tested score. */
function drawErrorCurve(canvas, round, optimumCm) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const points = (round?.candidates || []).filter((c) => Number.isFinite(c.cm360) && Number.isFinite(c.E));
  if (points.length < 2) return;

  const best = Math.min(...points.map((p) => p.E)) || 1;
  const values = points.map((p) => ({ cm: p.cm360, e: p.E / best }));
  const cms = values.map((p) => p.cm);
  const xMin = Math.min(...cms);
  const xMax = Math.max(...cms);
  const padX = Math.max((xMax - xMin) * 0.25, 0.35);
  const lo = xMin - padX;
  const hi = xMax + padX;
  const yMax = Math.max(1.25, ...values.map((p) => p.e));
  const margin = { l: 34, r: 10, t: 10, b: 22 };

  const x = (cm) => margin.l + ((cm - lo) / (hi - lo)) * (width - margin.l - margin.r);
  const y = (e) => margin.t + (1 - (e - 1) / (yMax - 1)) * (height - margin.t - margin.b);

  ctx.strokeStyle = token('--line-soft');
  ctx.lineWidth = 1;
  for (const value of [1, (1 + yMax) / 2, yMax]) {
    ctx.beginPath();
    ctx.moveTo(margin.l, y(value));
    ctx.lineTo(width - margin.r, y(value));
    ctx.stroke();
  }

  const fit = fitQuadratic(values.map((p) => ({ u: Math.log(p.cm), e: p.e })));
  if (fit && fit.a > 0) {
    ctx.beginPath();
    for (let i = 0; i <= 80; i += 1) {
      const cmv = lo + ((hi - lo) * i) / 80;
      const u = Math.log(cmv);
      const e = Math.max(1, fit.a * u * u + fit.b * u + fit.c);
      if (i === 0) ctx.moveTo(x(cmv), y(e));
      else ctx.lineTo(x(cmv), y(e));
    }
    ctx.strokeStyle = token('--signal');
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.fillStyle = token('--ink');
  for (const point of values) {
    ctx.beginPath();
    ctx.arc(x(point.cm), y(point.e), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (Number.isFinite(optimumCm) && optimumCm >= lo && optimumCm <= hi) {
    ctx.strokeStyle = token('--ink-2');
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x(optimumCm), margin.t);
    ctx.lineTo(x(optimumCm), height - margin.b);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = token('--ink-3');
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText(`${xMin.toFixed(1)}`, margin.l, height - 6);
  ctx.fillText(`${xMax.toFixed(1)} cm`, width - margin.r - 56, height - 6);
  ctx.fillText('1.0', 6, y(1) + 3);
}
