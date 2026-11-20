import { h } from '../dom.js';

/* Click-to-lock prompt: shown when a drill is ready but the browser has not given
   pointer lock yet (first start, or re-locking after Esc, which Chrome delays ~1s). */
export function createLockPrompt(onClick, { resuming = false } = {}) {
  const element = h('div', { class: 'lock-prompt interactive', id: 'lock-prompt', role: 'button', tabindex: '0' },
    h('div', { class: 'lock-prompt-card' },
      h('span', { class: 'lock-prompt-title' }, resuming ? 'Click to resume' : 'Click to start'),
      h('span', { class: 'lock-prompt-sub' }, 'Your cursor will be captured. Press Esc to pause.')
    )
  );
  element.addEventListener('click', onClick);
  return element;
}

/* 3-2-1 countdown. Digits swap in place (stepped, no scaling) so the eyes stay on center. */
export function createCountdown() {
  const num = h('span', { class: 'countdown-num num' });
  const element = h('div', { class: 'countdown', id: 'countdown', 'aria-live': 'assertive' }, num);
  return {
    element,
    set(value) {
      if (num.textContent !== value) num.textContent = value;
    }
  };
}

/* Shown on touch-only devices: pointer lock and mouse aim are required */
export function createDeviceGate() {
  return h('div', { class: 'gate interactive' },
    h('h1', { class: 'home-title' }, 'Bring a mouse.'),
    h('p', {}, 'AimLabs trains mouse aim with a captured cursor, so it needs a desktop browser with a mouse.')
  );
}
