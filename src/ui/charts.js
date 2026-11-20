import { prepareCanvas, token } from './dom.js';

/* Small canvas charts drawn with the CSS tokens, no chart library.
   Each function sizes the canvas to its CSS box first, so they stay sharp on HiDPI. */

/* Sparkline: last N scores, latest point highlighted */
export function drawSparkline(canvas, values) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (values.length < 2) return;
  const points = scalePoints(values, width, height, 4);
  ctx.strokeStyle = token('--ink-3');
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  strokePath(ctx, points);
  const last = points[points.length - 1];
  ctx.fillStyle = token('--signal');
  dot(ctx, last.x, last.y, 3);
}

/* Trend line with a faint baseline and the best run marked */
export function drawTrend(canvas, values, { highlightLast = true } = {}) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!values.length) return [];
  const pad = 8;
  const points = scalePoints(values, width, height, pad);

  ctx.strokeStyle = token('--line-soft');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 0.5);
  ctx.lineTo(width, height - 0.5);
  ctx.stroke();

  ctx.strokeStyle = token('--ink-2');
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  if (points.length > 1) strokePath(ctx, points);

  ctx.fillStyle = token('--ink-2');
  for (const p of points) dot(ctx, p.x, p.y, 2.5);

  const bestIndex = values.indexOf(Math.max(...values));
  ctx.fillStyle = token('--signal');
  dot(ctx, points[bestIndex].x, points[bestIndex].y, 4);
  if (highlightLast) {
    const last = points[points.length - 1];
    ctx.strokeStyle = token('--ink');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  return points;
}

/* Shot placement map: every shot plotted relative to its nearest target's center,
   in target radii. The ring at radius 1 is the target's edge. */
export function drawMissMap(canvas, shots) {
  const { ctx, width, height } = prepareCanvas(canvas);
  const cx = width / 2;
  const cy = height / 2;
  const range = 3; // plot spans ±3 target radii
  const unit = (Math.min(width, height) / 2 - 6) / range;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = token('--surface-1');
  ctx.beginPath();
  ctx.arc(cx, cy, unit * range, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = token('--line');
  ctx.lineWidth = 1;
  for (const r of [2, 3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, unit * r - (r === 3 ? 0.5 : 0), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - unit * range, cy);
  ctx.lineTo(cx + unit * range, cy);
  ctx.moveTo(cx, cy - unit * range);
  ctx.lineTo(cx, cy + unit * range);
  ctx.stroke();

  ctx.fillStyle = token('--signal-soft');
  ctx.strokeStyle = token('--signal');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, unit, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const hitColor = token('--ink');
  const missColor = token('--bad');
  for (const shot of shots) {
    const len = Math.hypot(shot.x, shot.y);
    const clamp = len > range ? range / len : 1;
    ctx.fillStyle = shot.hit ? hitColor : missColor;
    ctx.globalAlpha = shot.hit ? 0.75 : 0.9;
    dot(ctx, cx + shot.x * clamp * unit, cy - shot.y * clamp * unit, shot.hit ? 2 : 2.5);
  }
  ctx.globalAlpha = 1;
}

/* Plain-language read of where misses cluster, e.g. "Misses lean right and low" */
export function describeMisses(shots) {
  const misses = shots.filter((s) => !s.hit);
  if (misses.length < 4) return misses.length ? 'Too few misses to read a pattern.' : 'No misses. Clean run.';
  const avgX = misses.reduce((n, s) => n + Math.max(-3, Math.min(3, s.x)), 0) / misses.length;
  const avgY = misses.reduce((n, s) => n + Math.max(-3, Math.min(3, s.y)), 0) / misses.length;
  const parts = [];
  if (Math.abs(avgX) > 0.35) parts.push(avgX > 0 ? 'right' : 'left');
  if (Math.abs(avgY) > 0.35) parts.push(avgY > 0 ? 'high' : 'low');
  return parts.length ? `Misses lean ${parts.join(' and ')}.` : 'Misses are spread evenly. No directional bias.';
}

function scalePoints(values, width, height, pad) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((v, i) => ({
    x: pad + (values.length === 1 ? (width - pad * 2) / 2 : (i / (values.length - 1)) * (width - pad * 2)),
    y: height - pad - ((v - min) / span) * (height - pad * 2)
  }));
}

function strokePath(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
