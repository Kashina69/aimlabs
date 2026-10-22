/* Per-game yaw constants: degrees the view turns per mouse count at sens 1.
   Same-dpi conversions hold cm/360 constant across games: keeping
   sens * yaw identical means the same physical turn speed.
   Sources: verified against independent converter tables (yaw 0.022 group
   transfers 1:1 to CS2; 0.0066 group to Overwatch/CoD; MR pro sen data at
   800 dpi gives 21-58 cm/360, which only fits the 0.0066 group). */
export const GAME_PROFILES = [
  { id: 'marvel-rivals', name: 'Marvel Rivals', short: 'MR', yaw: 0.0066, min: 0.1, max: 30 },
  { id: 'overwatch-2', name: 'Overwatch 2', short: 'OW2', yaw: 0.0066, min: 0.1, max: 30 },
  { id: 'call-of-duty', name: 'Call of Duty (MW / Warzone / BO6)', short: 'CoD', yaw: 0.0066, min: 0.05, max: 30 },
  { id: 'the-finals', name: 'The Finals', short: 'Fin', yaw: 0.0066, min: 0.1, max: 30 },
  { id: 'destiny-2', name: 'Destiny 2', short: 'D2', yaw: 0.0066, min: 0.1, max: 30 },
  { id: 'cs2', name: 'CS2 / CS:GO', short: 'CS2', yaw: 0.022, min: 0.05, max: 12 },
  { id: 'apex', name: 'Apex Legends', short: 'Apex', yaw: 0.022, min: 0.05, max: 12 },
  { id: 'tf2', name: 'Team Fortress 2', short: 'TF2', yaw: 0.022, min: 0.05, max: 12 },
  { id: 'quake', name: 'Quake Champions', short: 'QC', yaw: 0.022, min: 0.05, max: 12 },
  { id: 'halo-infinite', name: 'Halo Infinite', short: 'HI', yaw: 0.0225, min: 0.05, max: 12 },
  { id: 'valorant', name: 'Valorant', short: 'Val', yaw: 0.07, min: 0.02, max: 3 },
  { id: 'rainbow-six', name: 'Rainbow Six Siege (default multiplier)', short: 'R6', yaw: 0.00572958, min: 0.5, max: 60 },
  { id: 'fortnite', name: 'Fortnite (X-axis %)', short: 'FN', yaw: 0.005555, min: 0.1, max: 50 },
  /* Legacy constant this trainer used before profiles existed (kept so old tuning stays reachable) */
  { id: 'custom', name: 'Custom (legacy 0.0176 scale)', short: 'Cust', yaw: 0.0176, min: 0.01, max: 12 }
];

export const DEFAULT_GAME_ID = 'marvel-rivals';
/* Old single constant: saves made before profiles were calibrated against this */
export const LEGACY_YAW = 0.0176;

export function getProfile(id) {
  return GAME_PROFILES.find((profile) => profile.id === id) || null;
}

export function getProfileOrDefault(id) {
  return getProfile(id) || getProfile(DEFAULT_GAME_ID);
}

export function convertSensitivity(value, fromProfile, toProfile) {
  if (!fromProfile || !toProfile) return value;
  return (value * fromProfile.yaw) / toProfile.yaw;
}

export function clampToProfile(value, profile) {
  return Math.max(profile.min, Math.min(profile.max, value));
}
