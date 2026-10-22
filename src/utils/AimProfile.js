import { StatsManager } from './StatsManager.js';

/* Turns the stored session history into a 6-axis skill profile:
   Precision / Reaction / Tracking / Flicking / Consistency / Control —
   each scored 0-100 with a diagnosis and a concrete practice drill, so the
   report can say WHERE aim is weak and WHAT to practice, typing-trainer style. */

const CLICK_MODES = ['Static', 'Flick', 'Click Track'];

function groupByMode(sessions) {
  const byMode = {};
  for (const s of sessions) {
    if (!s || typeof s !== 'object' || typeof s.mode !== 'string') continue;
    (byMode[s.mode] = byMode[s.mode] || []).push(s);
  }
  /* Recency: keep the newest 10 sessions per mode */
  for (const key of Object.keys(byMode)) {
    byMode[key] = byMode[key].slice(-10);
  }
  return byMode;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function statusFor(score) {
  if (score >= 75) return 'Great';
  if (score >= 55) return 'Good';
  if (score >= 35) return 'Needs work';
  return 'Weak';
}

/* Rating text mirrors aim-trainer community bands:
   avg reaction ~150-250ms is fast, 350+ is slow. Holding 3s+ on a strafing
   ball is solid tracking. Accuracy 70%+ keeps combo pressure. */
export function computeAimProfile() {
  const byMode = groupByMode(StatsManager.list());

  /* Precision: accuracy across the click-based drills */
  const clickAccuracies = CLICK_MODES.flatMap((mode) => (byMode[mode] || [])
    .map((s) => (typeof s.accuracy === 'number' ? s.accuracy : 0))
    .filter((a) => a > 0));
  const precisionValue = mean(clickAccuracies);
  const precision = {
    score: clickAccuracies.length ? clampScore(precisionValue) : 0,
    hasData: clickAccuracies.length > 0,
    measurement: clickAccuracies.length
      ? `avg accuracy ${precisionValue.toFixed(1)}%`
      : 'no data',
    drill: 'Slow the flick a touch and re-center between shots in Static; accuracy first, speed after.',
    target: 'reach 70%+ accuracy'
  };

  /* Reaction: from the Reaction drill (avg 70% + best 30% weighting) */
  const reactionSessions = byMode['Reaction'] || [];
  const avgReactions = reactionSessions.map((s) => s.avgReaction).filter((v) => typeof v === 'number' && v > 0);
  const bestReactions = reactionSessions.map((s) => s.bestReaction).filter((v) => typeof v === 'number' && v > 0);
  const avgReaction = mean(avgReactions);
  const bestReactionMeasured = bestReactions.length ? Math.min(...bestReactions) : 0;
  const avgScore = mean(avgReactions.map((v) => (450 - v) / 3));
  const bestScore = mean(bestReactions.map((v) => (450 - v) / 3));
  const reactionScore = avgReactions.length && bestReactions.length
    ? avgScore * 0.7 + bestScore * 0.3
    : (avgReactions.length ? avgScore : bestScore);
  const reaction = {
    score: avgReaction || bestReactionMeasured ? clampScore(reactionScore) : 0,
    hasData: reactionSessions.length > 0,
    measurement: avgReaction
      ? `avg ${Math.round(avgReaction)}ms / best ${Math.round(bestReactionMeasured)}ms`
      : 'no data',
    drill: 'Push Reaction with a higher spawn-speed difficulty and force early clicks off the first flash.',
    target: 'avg reaction under 300ms'
  };

  /* Tracking: Hold Track on-target time plus longest continuous hold */
  const holdSessions = byMode['Hold Track'] || [];
  const holdAccuracy = holdSessions.map((s) => (typeof s.accuracy === 'number' ? s.accuracy : 0)).filter((a) => a > 0);
  const bestStreaks = holdSessions.map((s) => (typeof s.bestStreak === 'number' ? s.bestStreak : 0));
  const holdAccuracyMean = mean(holdAccuracy);
  const bestStreakMax = Math.max(...(bestStreaks.length ? bestStreaks : [0]));
  const trackingAccPart = Math.min(1, holdAccuracyMean / 100) * 60;
  const trackingStreakPart = Math.min(1, bestStreakMax / 6) * 40;
  const tracking = {
    score: holdSessions.length ? clampScore(trackingAccPart + trackingStreakPart) : 0,
    hasData: holdSessions.length > 0,
    measurement: holdSessions.length
      ? `on-target ${holdAccuracyMean.toFixed(1)}% of the time, longest hold ${bestStreakMax.toFixed(1)}s`
      : 'no data',
    drill: 'You lose the target on direction changes — hold sessions with movement speed one notch higher.',
    target: 'hold 3s+ without losing the ball'
  };

  /* Flicking: Flick drill accuracy (falls back to Static) */
  const flickSessions = byMode['Flick'] || [];
  const fallbackStatic = byMode['Static'] || [];
  const flickSource = flickSessions.length ? flickSessions : fallbackStatic;
  const flickAccuracy = mean(flickSource.map((s) => (typeof s.accuracy === 'number' ? s.accuracy : 0)).filter((a) => a > 0));
  const flicking = {
    score: flickSource.length ? clampScore(flickAccuracy) : 0,
    hasData: flickSource.length > 0,
    measurement: flickSource.length
      ? `target-hit accuracy ${flickAccuracy.toFixed(1)}% on the ${flickSessions.length ? 'Flick' : 'Static'} drill`
      : 'no data',
    drill: 'Flick targets vanish fast — lower spawn speed until you hit before the fade, then step it up.',
    target: 'over 60% before the fade-out window closes'
  };

  /* Consistency: inverse coefficient-of-variation of recent scores per mode
     (the typing-master "you flounder on this key some days" analog) */
  const cvs = [];
  const spreadNotes = [];
  for (const mode of Object.keys(byMode)) {
    const scores = byMode[mode].map((s) => (typeof s.score === 'number' ? s.score : 0)).filter((v) => v > 0);
    if (scores.length >= 3) {
      const m = mean(scores);
      const cv = stdev(scores) / m;
      if (m > 0) cvs.push(cv);
      if (cv > 0.3) {
        spreadNotes.push(`${mode}: scores swing ±${Math.round((stdev(scores) / m) * 100)}% between sessions (recent avg ${Math.round(m)})`);
      }
    }
  }
  const avgCv = mean(cvs);
  const consistency = {
    score: cvs.length ? clampScore(100 - avgCv * 170) : 0,
    hasData: cvs.length > 0,
    measurement: cvs.length
      ? avgCv <= 0.15 ? 'scores are steady session to session' : `score spread ~±${Math.round(avgCv * 100)}% between sessions`
      : 'not enough repeats yet (3+ sessions of the same mode)',
    drill: 'Repeat the same mode at a fixed difficulty for a few sessions instead of rotating modes.',
    target: 'session-to-session swings under ±15%'
  };

  /* Control: combo retention under follow-up pressure */
  const combos = [];
  for (const mode of CLICK_MODES) {
    for (const s of (byMode[mode] || [])) {
      if (typeof s.maxCombo === 'number') combos.push(s.maxCombo);
    }
  }
  const bestCombo = Math.max(...(combos.length ? combos : [0]));
  const control = {
    score: combos.length ? clampScore(Math.min(100, bestCombo * 8.3)) : 0,
    hasData: combos.length > 0,
    measurement: combos.length ? `longest unbroken combo ${bestCombo}` : 'no data',
    drill: 'Chase clean streaks: take the mode that tempts you to spam clicks and force a full picture before every shot.',
    target: 'a 10+ shot run without a miss'
  };

  const axes = [
    { key: 'precision', label: 'Precision', ...precision },
    { key: 'reaction', label: 'Reaction', ...reaction },
    { key: 'tracking', label: 'Tracking', ...tracking },
    { key: 'flicking', label: 'Flicking', ...flicking },
    { key: 'consistency', label: 'Consistency', ...consistency },
    { key: 'control', label: 'Control', ...control }
  ].map((axis) => ({ ...axis, status: axis.hasData ? statusFor(axis.score) : 'Unplayed' }));

  const measured = axes.filter((a) => a.hasData);
  const overall = measured.length
    ? clampScore(mean(measured.map((a) => a.score)))
    : 0;

  /* Weak-first diagnosis, plus unplayed drills worth starting */
  const measuredWeak = measured.slice().sort((a, b) => a.score - b.score);
  const unplayed = axes.filter((a) => !a.hasData);
  const weakest = measuredWeak.slice(0, 3).filter((a) => a.score < 75);

  return {
    axes,
    overall,
    balance: measured.length ? clampScore(100 - (stdev(measured.map((a) => a.score)) * 2.5)) : 0,
    weakest,
    unplayed,
    spreadNotes,
    sessionCount: StatsManager.list().length,
    /* Last two sessions per mode, for the trend table in the report */
    recentPerMode: Object.keys(byMode).map((mode) => {
      const list = byMode[mode];
      const last = list[list.length - 1];
      const prev = list[list.length - 2] || null;
      const trend = prev && typeof last.score === 'number' && typeof prev.score === 'number'
        ? (last.score - prev.score) / Math.max(1, prev.score)
        : null;
      return {
        mode,
        lastScore: typeof last.score === 'number' ? Math.round(last.score) : '?',
        lastAccuracy: typeof last.accuracy === 'number' ? last.accuracy.toFixed(0) : '?',
        prevScore: prev && typeof prev.score === 'number' ? Math.round(prev.score) : null,
        trend
      };
    }).sort((a, b) => a.mode.localeCompare(b.mode))
  };
}
