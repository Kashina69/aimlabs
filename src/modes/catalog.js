/* Display metadata for every drill. Keys match the names sessions are saved under
   (ModeRegistry labels), so renaming a title here never breaks stored stats. */
export const MODE_ORDER = ['Static', 'Flick', 'Click Track', 'Hold Track', 'Reaction', 'Cone 45'];

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
  'Click Track': {
    title: 'Click Track',
    sub: 'Click a strafing target',
    desc: 'One target sweeps smoothly across the zone. Put the crosshair on it and click; it respawns after every hit. Speed eases up and down, so it rewards smooth mouse control instead of twitch snaps.',
    facts: ['60 s', 'Moving target', 'Smoothness'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M12 48 C24 20, 40 20, 46 34 S58 50, 62 30" stroke-dasharray="2 3"/>
      <circle class="hot" cx="46" cy="34" r="5"/><path d="M46 27v14M39 34h14"/></svg>`
  },
  'Hold Track': {
    title: 'Hold Track',
    sub: 'Hold on a drifting target',
    desc: 'Keep the crosshair on a drifting target while holding the mouse button. Score accrues for every second you stay on it; the HUD shows your current hold against your best. Builds tracking stamina.',
    facts: ['45 s', 'Hold to score', 'Longest hold'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M10 46 C22 18, 42 22, 50 36 S58 50, 62 26" stroke-dasharray="2 3"/>
      <circle class="hot" cx="50" cy="36" r="6"/><circle cx="50" cy="36" r="11" stroke-dasharray="1 3"/></svg>`
  },
  Reaction: {
    title: 'Reaction',
    sub: 'Wait for it, then fire',
    desc: 'A target appears after a random delay. Hit it before it fades. Shooting early counts as a miss. Measures raw reaction time.',
    facts: ['30 s', 'Random delay', 'Reaction time'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="36" cy="36" r="17"/><path d="M36 19 A17 17 0 0 1 53 36" stroke-width="3"/>
      <circle class="hot" cx="36" cy="36" r="6"/></svg>`
  },
  'Cone 45': {
    title: 'Cone 45',
    sub: 'Warm-up, 45° in front',
    desc: 'Small, far targets appear only inside the central 45 degrees, and your view is held to that cone. A short pre-game warm-up for the flicks that actually happen in a match: tight corrections and micro-adjustments, never a corner-to-corner spin.',
    facts: ['60 s', '2 targets', 'Pre-game warm-up'],
    diagram: `<svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M36 60 L15 20M36 60 L57 20" stroke-dasharray="2 3"/>
      <circle class="hot" cx="28" cy="34" r="4.5"/><circle class="hot" cx="45" cy="29" r="4.5"/></svg>`
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
