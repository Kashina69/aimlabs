import { h } from './dom.js';

/**
 * What: The finder's in-session progress panel and zone/round banners.
 * Why:  Keeps DOM concerns out of the measurement state machine, and gives the mode
 *       one call to hide everything behind the pause sheet.
 * How:  Builds the prompt-layer elements once; update() only rewrites text and the
 *       progress fill. Nothing here animates near the crosshair.
 */
export class SensProgress {
  constructor(layer) {
    this.layer = layer;
    this.mainText = h('span', { class: 'sens-progress-text' }, 'Sensitivity test');
    this.subText = h('span', { class: 'sens-progress-sub num' }, '');
    this.fill = h('i');
    this.element = h('div', { class: 'sens-progress', id: 'sens-progress', 'aria-hidden': 'true' },
      h('div', { class: 'sens-progress-head' }, 'SENSITIVITY FINDER'),
      this.mainText,
      this.subText,
      h('div', { class: 'sens-progress-bar' }, this.fill));
    this.layer.appendChild(this.element);
    this.bannerEl = null;
  }

  /**
   * What: Renders the current round/zone/trial and overall progress.
   * Why:  The player must always know what is happening without seeing the blind
   *       sensitivity value.
   * How:  Reads plain values from the mode's state and writes text only.
   */
  update({ finished, flow, roundIndex, rounds, block, done, total }) {
    const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    this.fill.style.width = `${percent}%`;

    if (finished) {
      this.mainText.textContent = 'Test complete';
      this.subText.textContent = `${percent}%`;
      return;
    }
    if (flow === 'warmup') {
      this.mainText.textContent = 'Warm-up';
      this.subText.textContent = block
        ? `${block.zone.label} · ${Math.min(block.trialIndex + 1, block.sequence.length)}/${block.sequence.length}`
        : '';
      return;
    }

    this.mainText.textContent = `Round ${roundIndex + 1}/${rounds}`;
    if (!block) {
      this.subText.textContent = '';
      return;
    }
    const totalTrials = block.sequence.length + block.trackTrials;
    const trial = Math.min(block.trialIndex + 1, totalTrials);
    const kind = block.trialIndex < block.sequence.length ? 'flick' : 'track';
    this.subText.textContent = `${block.zone.label} · ${kind} ${trial}/${totalTrials}`;
  }

  /**
   * What: Shows a centered instruction/zone banner in the prompt layer.
   * Why:  Zone changes and the input check need a readable, non-interactive cue.
   * How:  Replaces any existing banner with a fresh element.
   */
  showBanner(text, sticky = false) {
    this.hideBanner();
    this.bannerEl = h('div', { class: `sens-banner${sticky ? ' is-sticky' : ''}`, role: 'status' }, text);
    this.layer.appendChild(this.bannerEl);
  }

  /**
   * What: Removes the current banner.
   * Why:  Banners must not linger into the next state.
   * How:  Removes the node and clears the reference.
   */
  hideBanner() {
    this.bannerEl?.remove();
    this.bannerEl = null;
  }

  /**
   * What: Hides or restores both elements together.
   * Why:  The prompt layer renders above the pause sheet, so pausing must hide them.
   * How:  Toggles the shared `.hidden` class.
   */
  setHidden(hidden) {
    this.element.classList.toggle('hidden', hidden);
    this.bannerEl?.classList.toggle('hidden', hidden);
  }

  /**
   * What: Removes all finder session UI.
   * Why:  Every exit path must leave the screen clean.
   * How:  Removes the progress panel and any banner.
   */
  destroy() {
    this.element.remove();
    this.hideBanner();
  }
}
