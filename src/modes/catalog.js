/* Display metadata for every drill. Keys match the names sessions are saved under
   (ModeRegistry labels), so renaming a title here never breaks stored stats. */
export const MODE_ORDER = ['Static', 'Flick', 'Tracking', 'Reaction'];

export const MODE_INFO = {
  Static: {
    title: 'Gridshot',
    sub: 'Four targets, sixty seconds',
    desc: 'Several targets stay up at once. Clear them as fast as you can without spraying. Builds target switching and click timing.',
    facts: ['60 s', '4 targets', 'Speed and precision'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <rect x="12" y="14" width="48" height="44" rx="3" stroke-dasharray="2 3"/>
      <circle class="hot" cx="24" cy="26" r="5"/><circle class="hot" cx="47" cy="22" r="5"/>
      <circle class="hot" cx="29" cy="46" r="5"/><circle class="hot" cx="50" cy="44" r="5"/></svg>`
  },
  Flick: {
    title: 'Flick',
    sub: 'One target, short lifetime',
    desc: 'A single target appears somewhere new and vanishes fast. Snap to it and click once. Builds first-shot accuracy.',
    facts: ['60 s', '1 target', 'Flick accuracy'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M36 32v8M32 36h8"/><path d="M40 33 L52 22" stroke-dasharray="2 3"/>
      <circle class="hot" cx="55" cy="19" r="5"/></svg>`
  },
  Tracking: {
    title: 'Tracking',
    sub: 'Follow a moving target',
    desc: 'The target drifts and bounces off the edges of the zone. Stay on it and click when you are centered. Builds smooth mouse control.',
    facts: ['60 s', 'Moving target', 'Smoothness'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M12 48 C24 20, 40 20, 46 34 S58 50, 62 30" stroke-dasharray="2 3"/>
      <circle class="hot" cx="46" cy="34" r="5"/></svg>`
  },
  Reaction: {
    title: 'Reaction',
    sub: 'Wait for it, then fire',
    desc: 'A target appears after a random delay. Hit it before it fades. Shooting early counts as a miss. Measures raw reaction time.',
    facts: ['30 s', 'Random delay', 'Reaction time'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="36" cy="36" r="17"/><path d="M36 19 A17 17 0 0 1 53 36" stroke-width="3"/>
      <circle class="hot" cx="36" cy="36" r="6"/></svg>`
  }
};

/* Difficulty presets write the same three settings the old sliders controlled */
export const DIFFICULTY_PRESETS = {
  easy: { label: 'Easy', targetSize: 0.42, spawnSpeed: 0.5, movementSpeed: 0.7 },
  normal: { label: 'Normal', targetSize: 0.3, spawnSpeed: 1, movementSpeed: 1 },
  hard: { label: 'Hard', targetSize: 0.2, spawnSpeed: 2, movementSpeed: 1.6 }
};

export function modeTitle(key) {
  return MODE_INFO[key]?.title || key;
}
