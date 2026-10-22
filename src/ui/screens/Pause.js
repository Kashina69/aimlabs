import { h, fmt } from '../dom.js';
import { modeTitle } from '../../modes/catalog.js';

/* Pause sheet. Appears instantly with no animation: Esc is pressed constantly
   and the player wants the menu, not a transition. */
export function createPauseScreen(game) {
  const mode = game.currentMode;
  const timeLeft = mode?.timeLeft;
  const resume = h('button', { class: 'btn btn-primary btn-lg btn-block', onClick: () => game.resume() },
    h('span', {}, 'Resume'), h('span', { class: 'kbd' }, 'Esc'));

  const element = h('div', { class: 'pause interactive', id: 'pause-menu' },
    h('div', { class: 'pause-sheet panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' },
      h('div', { class: 'pause-head' },
        h('h2', { class: 'pause-title', id: 'pause-title' }, 'Paused'),
        h('span', { class: 'pause-meta' },
          modeTitle(game.currentModeName),
          timeLeft != null ? h('span', { class: 'num' }, ` ${fmt.clock(timeLeft)} left`) : null)
      ),
      h('div', { class: 'pause-actions' },
        resume,
        h('button', { class: 'btn btn-lg btn-block', onClick: () => game.restart() },
          h('span', {}, 'Restart'), h('span', { class: 'kbd' }, 'R')),
        h('button', { class: 'btn btn-lg btn-block', onClick: () => game.openSettings() }, h('span', {}, 'Settings')),
        h('button', { class: 'btn btn-text btn-lg btn-block', onClick: () => game.quitToHome() }, h('span', {}, 'Quit to menu'))
      )
    )
  );
  requestAnimationFrame(() => resume.focus({ preventScroll: true }));
  return element;
}
