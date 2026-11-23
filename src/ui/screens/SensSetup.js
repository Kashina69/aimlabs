import { h } from '../dom.js';
import { GAME_PROFILES, getProfileOrDefault, convertSensitivity, clampToProfile } from '../GameProfiles.js';
import { cmPer360 } from '../../utils/sensitivity.js';
import { Storage } from '../../utils/Storage.js';

/**
 * What: The finder's pre-test setup overlay.
 * Why:  Everything that changes the physical meaning of the result lives here: the
 *       game scale, DPI, an optional measured 360 distance and the test length.
 * How:  Builds the form once, keeps the readout live, validates the measured
 *       distance, then hands a plain config to `Game.startSensFinder`.
 */
export function createSensSetupScreen(game) {
  const saved = Storage.get('sensFinder.config', {}) || {};
  const state = {
    length: saved.length === 'thorough' ? 'thorough' : 'quick',
    measuredCm360: saved.measuredCm360 || '',
    probe: saved.probe !== false
  };

  const readout = h('p', { class: 'readout' });
  const errorLine = h('p', { class: 'inline-msg', 'aria-live': 'polite' });
  const startBtn = h('button', { class: 'btn btn-primary btn-lg' }, 'Start test');

  const refreshReadout = () => {
    const profile = getProfileOrDefault(game.settings.game);
    const cm = cmPer360(game.settings.sensitivity, game.settings.dpi, profile.yaw);
    readout.replaceChildren(
      h('span', { class: 'num' }, game.settings.sensitivity.toFixed(2)),
      ` in ${profile.name} · `,
      h('span', { class: 'num' }, cm.toFixed(2)),
      ' cm/360 right now'
    );
    startBtn.textContent = state.length === 'thorough' ? 'Start thorough test' : 'Start quick test';
  };

  /* Switching the game converts the sensitivity so the turn speed does not change */
  const gameSelect = h('select', { class: 'input', 'aria-label': 'Game sensitivity profile' },
    ...GAME_PROFILES.map((profile) => h('option', {
      value: profile.id,
      selected: profile.id === getProfileOrDefault(game.settings.game).id
    }, profile.name)));
  gameSelect.addEventListener('change', (event) => {
    const from = getProfileOrDefault(game.settings.game);
    const to = getProfileOrDefault(event.target.value);
    const converted = convertSensitivity(game.settings.sensitivity, from, to);
    game.setSetting('game', to.id);
    game.setSetting('sensitivity', Math.round(clampToProfile(converted, to) * 10000) / 10000);
    refreshReadout();
  });

  const dpiInput = h('input', {
    class: 'input input-num',
    type: 'number',
    min: 100,
    max: 32000,
    step: 50,
    value: game.settings.dpi,
    'aria-label': 'Mouse DPI'
  });
  dpiInput.addEventListener('change', () => {
    const value = Math.max(100, Math.min(32000, Math.round(parseFloat(dpiInput.value) || 800)));
    dpiInput.value = value;
    game.setSetting('dpi', value);
    refreshReadout();
  });

  const measuredInput = h('input', {
    class: 'input input-num',
    type: 'number',
    min: 1,
    max: 200,
    step: 0.1,
    value: state.measuredCm360,
    placeholder: 'e.g. 24.5',
    'aria-label': 'Measured 360 distance in centimetres'
  });
  measuredInput.addEventListener('input', () => {
    state.measuredCm360 = measuredInput.value;
  });

  const lengthControl = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Test length' },
    ...[['quick', 'Quick · ~5 min'], ['thorough', 'Thorough · ~12 min']].map(([id, label]) => h('button', {
      'aria-pressed': String(id === state.length),
      onClick: (event) => {
        state.length = id;
        for (const button of lengthControl.querySelectorAll('button')) {
          button.setAttribute('aria-pressed', String(button === event.currentTarget));
        }
        refreshReadout();
      }
    }, label)));

  const probeBadge = h('span', { class: 'badge badge-quiet' }, state.probe ? 'Checked in the test' : 'Skipped');
  const probeInput = h('input', { type: 'checkbox', checked: state.probe });
  probeInput.addEventListener('change', () => {
    state.probe = probeInput.checked;
    probeBadge.textContent = state.probe ? 'Checked in the test' : 'Skipped';
  });

  const dpr = window.devicePixelRatio || 1;
  const checks = h('ul', { class: 'sens-checks' },
    checkRow('Mouse DPI', `${game.settings.dpi}`, 'ok', 'Used for the DPI-based cm/360 estimate.'),
    checkRow(
      'Display scaling',
      `DPR ${dpr.toFixed(2)}`,
      dpr === 1 ? 'ok' : 'warn',
      dpr === 1
        ? 'Pointer counts map 1:1, as long as browser zoom is 100%.'
        : 'OS scaling or browser zoom is not 1:1. Enter a measured 360 distance below to bypass it.'
    ),
    h('li', { class: 'sens-check is-info' },
      h('div', { class: 'sens-check-head' },
        h('span', { class: 'sens-check-label' }, 'Pointer acceleration'),
        probeBadge),
      h('p', { class: 'sens-check-hint' }, 'A short slow/fast sweep at the start. Windows "Enhance pointer precision" must be off.'))
  );

  const start = () => {
    const measured = Number(state.measuredCm360);
    if (state.measuredCm360 !== '' && (!(measured > 0) || measured > 200)) {
      errorLine.className = 'inline-msg is-error';
      errorLine.textContent = 'The measured 360 distance must be between 1 and 200 cm.';
      return;
    }
    Storage.set('sensFinder.config', {
      length: state.length,
      measuredCm360: measured > 0 ? measured : null,
      probe: state.probe,
      dpi: game.settings.dpi,
      game: game.settings.game
    });
    game.closeSettings({ instant: true });
    game.startSensFinder({
      length: state.length,
      game: game.settings.game,
      dpi: game.settings.dpi,
      measuredCm360: measured > 0 ? measured : null,
      probe: state.probe
    });
  };
  startBtn.addEventListener('click', start);

  const element = h('div', { class: 'sens-setup interactive', id: 'sens-setup' },
    h('article', { class: 'sens-setup-card panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sens-setup-title' },
      h('header', { class: 'sens-setup-head' },
        h('span', { class: 'field-label' }, 'Sensitivity finder'),
        h('h2', { class: 'sens-title', id: 'sens-setup-title' }, 'Find the sensitivity you actually aim best at'),
        h('p', { class: 'sens-lede' }, 'A measured test, not a feeling. Every candidate sensitivity is scored on the same two target zones: short 45° flicks (real-world, weighted 60%) and wide full turns (mouse control, 40%), across flicks, micro-adjustments and tracking. Candidates stay blind — you will never be told which sensitivity you are on.')
      ),
      h('div', { class: 'sens-setup-body' },
        h('div', { class: 'sens-setup-fields' },
          h('div', { class: 'section' },
            h('div', { class: 'field' },
              h('div', { class: 'field-head' },
                h('span', { class: 'field-label' }, 'Game scale'),
                h('span', { class: 'field-hint' }, 'Test and report in this game\'s values')),
              gameSelect),
            h('div', { class: 'field' },
              h('div', { class: 'field-head' },
                h('span', { class: 'field-label' }, 'Mouse DPI'),
                h('span', { class: 'field-hint' }, 'From your mouse software')),
              dpiInput),
            h('div', { class: 'field' },
              h('div', { class: 'field-head' },
                h('span', { class: 'field-label' }, 'Measured 360 distance'),
                h('span', { class: 'field-hint' }, 'Optional, but the accurate path')),
              measuredInput,
              h('details', { class: 'sens-how' },
                h('summary', {}, 'How to measure it'),
                h('p', {}, 'In your main game, aim at a landmark, then turn exactly one full circle (360°). Use a ruler to measure how many centimetres the mouse moved on the pad. That distance is your true cm/360 and it makes the result independent of DPI, OS scaling and browser zoom.'))),
            readout,
            h('div', { class: 'field' },
              h('div', { class: 'field-head' },
                h('span', { class: 'field-label' }, 'Test length'),
                h('span', { class: 'field-hint' }, 'Longer = tighter confidence interval')),
              lengthControl),
            h('label', { class: 'switch' }, 'Run the input check', probeInput)
          )
        ),
        h('div', { class: 'sens-setup-side' },
          h('h3', { class: 'section-title' }, 'What will be checked'),
          checks,
          h('p', { class: 'sens-note' }, 'Blind candidates: the HUD hides your sensitivity for the whole test. Pausing is always safe — the test clock freezes.')
        )
      ),
      h('footer', { class: 'sens-setup-foot' },
        h('button', { class: 'btn btn-lg', onClick: () => game.showHome() }, 'Cancel'),
        startBtn)
    )
  );

  refreshReadout();
  requestAnimationFrame(() => startBtn.focus({ preventScroll: true }));
  return element;
}

function checkRow(label, value, status, hint) {
  return h('li', { class: `sens-check is-${status}` },
    h('div', { class: 'sens-check-head' },
      h('span', { class: 'sens-check-label' }, label),
      h('span', { class: `badge${status === 'ok' ? '' : ' badge-quiet'}` }, value)),
    h('p', { class: 'sens-check-hint' }, hint));
}
