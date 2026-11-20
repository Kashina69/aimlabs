import { StatsManager } from './StatsManager.js';

/* Read-only views over saved sessions, used by Home, Results and Stats */

export function runsFor(modeKey) {
  return StatsManager.list().filter((s) => !modeKey || s.mode === modeKey);
}

export function bestFor(modeKey) {
  const runs = runsFor(modeKey);
  if (!runs.length) return null;
  return runs.reduce((best, run) => ((run.score || 0) > (best.score || 0) ? run : best));
}

export function lastFor(modeKey) {
  const runs = runsFor(modeKey);
  return runs.length ? runs[runs.length - 1] : null;
}

/* Score history (oldest first), capped to the last `count` runs */
export function scoreHistory(modeKey, count = 10) {
  return runsFor(modeKey).slice(-count).map((s) => Number(s.score) || 0);
}

export function summarize(modeKey) {
  const runs = runsFor(modeKey);
  if (!runs.length) return null;
  const totalShots = runs.reduce((n, s) => n + (Number(s.shots) || 0), 0);
  const totalHits = runs.reduce((n, s) => n + (Number(s.hits) || 0), 0);
  const playSeconds = runs.reduce((n, s) => n + (Number(s.duration) || 0) / 1000, 0);
  return {
    runs: runs.length,
    best: bestFor(modeKey)?.score || 0,
    accuracy: totalShots ? (totalHits / totalShots) * 100 : averageOf(runs, 'accuracy'),
    playMinutes: playSeconds / 60
  };
}

function averageOf(runs, key) {
  const values = runs.map((s) => Number(s[key])).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
