import { computeAimProfile } from '../utils/AimProfile.js';

/* Detailed aim report: hexagon radar of the six skill axes with a
   weak-areas diagnosis and a per-mode practice plan, typing-trainer style. */
const RING_STEPS = [0.25, 0.5, 0.75, 1.0];

export class AimReport {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.profile = computeAimProfile();
    this.el = document.createElement('div');
    this.el.className = 'glass';
    this.el.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); padding:20px; min-width:520px; max-width:640px; max-height:90vh; overflow:auto;';
    this.build();
    this.container.appendChild(this.el);
    this.drawRadar();
  }

  build() {
    const p = this.profile;
    const bullet = (text) => {
      const li = document.createElement('div');
      li.textContent = `• ${text}`;
      li.style.marginBottom = '4px';
      return li;
    };

    const title = document.createElement('h3');
    title.className = 'neon-text';
    title.textContent = 'Aim Report';
    this.el.appendChild(title);

    const overallLine = document.createElement('div');
    overallLine.innerHTML = p.sessionCount
      ? `Overall <strong>${p.overall}/100</strong> · balance <strong>${p.balance}/100</strong> · built from <strong>${p.sessionCount}</strong> stored sessions`
      : 'No sessions recorded yet — play any mode, then open the report.';
    overallLine.style.marginBottom = '10px';
    this.el.appendChild(overallLine);

    this.radar = document.createElement('canvas');
    this.radar.width = 480;
    this.radar.height = 390;
    this.radar.style.cssText = 'width:100%; max-width:520px; display:block; margin:0 auto; background:rgba(0,255,255,0.03); border-radius:8px;';
    this.el.appendChild(this.radar);

    /* Axis breakdown with a colored status chip and the concrete drill */
    const axisTitle = document.createElement('h4');
    axisTitle.className = 'neon-text';
    axisTitle.textContent = 'Skill breakdown';
    axisTitle.style.marginTop = '14px';
    this.el.appendChild(axisTitle);

    p.axes.forEach((axis) => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:10px; font-size:13px; line-height:1.5;';
      const head = document.createElement('div');
      const chip = document.createElement('strong');
      chip.textContent = `${axis.label}: ${axis.hasData ? `${axis.score}/100` : '—'} (${axis.status})`;
      if (axis.status === 'Weak' || axis.status === 'Needs work') chip.style.color = '#ff5050';
      else if (axis.status === 'Great') chip.style.color = '#50ff9f';
      else if (axis.status === 'Unplayed') chip.style.color = '#aaa';
      head.appendChild(chip);
      const sub = document.createElement('div');
      sub.style.opacity = '0.85';
      sub.textContent = axis.hasData
        ? `${axis.measurement}. Drill: ${axis.drill} Target: ${axis.target}.`
        : 'Unplayed — the report needs at least one session of that drill to rate it.';
      head.appendChild(sub);
      row.appendChild(head);
      this.el.appendChild(row);
    });

    /* Weak areas: what to practice and which drill targets it */
    const planTitle = document.createElement('h4');
    planTitle.className = 'neon-text';
    planTitle.textContent = 'Practice plan';
    planTitle.style.marginTop = '14px';
    this.el.appendChild(planTitle);

    const plan = document.createElement('div');
    plan.style.fontSize = '13px';
    if (!p.sessionCount) {
      plan.textContent = 'Play a session first — the report fills in as you practice.';
    } else if (p.weakest.length === 0 && p.unplayed.length === 0) {
      plan.textContent = 'All measured areas are solid. Hold the balance and keep repeating modes you want to get faster in.';
    } else {
      p.weakest.forEach((axis) => {
        plan.appendChild(bullet(`Weak: ${axis.label} (${axis.score}/100). Fix it with: ${axis.drill}`));
      });
      p.unplayed.forEach((axis) => {
        plan.appendChild(bullet(`Unmeasured: ${axis.label} — run that drill once so the report can rate it.`));
      });
      p.spreadNotes.forEach((note) => {
        plan.appendChild(bullet(`Inconsistent: ${note}. Lock one difficulty and grind repeats.`));
      });
    }
    this.el.appendChild(plan);

    /* Per-mode recent results with a trend arrow (typing-master "key report") */
    const modeTitle = document.createElement('h4');
    modeTitle.className = 'neon-text';
    modeTitle.textContent = 'Recent per mode';
    modeTitle.style.marginTop = '14px';
    this.el.appendChild(modeTitle);

    for (const row of p.recentPerMode) {
      const line = document.createElement('div');
      line.style.cssText = 'font-size:13px; margin-bottom:4px;';
      const arrow = row.trend === null ? ''
        : row.trend >= 0 ? ` ▲${Math.round(row.trend * 100)}% vs previous`
        : ` ▼${Math.round(-row.trend * 100)}% vs previous`;
      line.textContent = `${row.mode}: last score ${row.lastScore} (accuracy ${row.lastAccuracy}%)${arrow}`;
      if (row.trend !== null) line.style.color = row.trend >= 0 ? '#50ff9f' : '#ff9f50';
      this.el.appendChild(line);
    }

    const closeRow = document.createElement('div');
    closeRow.style.cssText = 'text-align:right; margin-top:14px;';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    closeRow.appendChild(close);
    this.el.appendChild(closeRow);
  }

  drawRadar() {
    const ctx = this.radar.getContext('2d');
    const w = this.radar.width;
    const h = this.radar.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    const axes = this.profile.axes;
    const n = axes.length;

    const vertex = (i, fraction) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx + Math.cos(angle) * R * fraction, cy + Math.sin(angle) * R * fraction];
    };

    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px monospace';

    /* Concentric hexagon rings at 25/50/75/100 */
    ctx.strokeStyle = 'rgba(0,255,255,0.18)';
    ctx.lineWidth = 1;
    for (const step of RING_STEPS) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [x, y] = vertex(i % n, step);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    /* Spokes */
    for (let i = 0; i < n; i++) {
      const [x, y] = vertex(i, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    /* Skill polygon */
    const measured = axes.some((a) => a.hasData);
    if (measured) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const axis = axes[i % n];
        const [x, y] = vertex(i % n, Math.max(0.02, axis.score / 100));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.fillStyle = 'rgba(0,255,255,0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* Vertex score dots + outer labels */
    for (let i = 0; i < n; i++) {
      const axis = axes[i];
      const [lx, ly] = vertex(i, 1.22);
      ctx.fillStyle = axis.hasData ? '#0ff' : '#888';
      ctx.textAlign = 'center';
      ctx.fillText(`${axis.label}`, lx, ly);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(axis.hasData ? `${axis.score}` : '-', lx, ly + 12);

      if (axis.hasData) {
        const [dx, dy] = vertex(i, Math.max(0.02, axis.score / 100));
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
  }

  close() {
    if (this.game?.closeOverlayToMenu) {
      this.game.closeOverlayToMenu();
      return;
    }
    try { this.el.remove(); } catch (e) {}
  }
}
