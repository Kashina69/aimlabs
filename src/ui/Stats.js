import { StatsManager } from '../utils/StatsManager.js';

export class StatsUI {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'glass stats';
    this.el.style.cssText = 'position:absolute; top:8%; right:6%; padding:12px; min-width:340px; max-width:420px;';
    this.el.innerHTML = `
      <h4 class="neon-text">Session Stats</h4>
      <div id="stats-list" style="max-height:240px; overflow:auto; margin-top:6px; font-size:13px;">Loading...</div>
      <canvas id="stats-chart" width="400" height="120" style="width:100%; height:120px; display:block; margin-top:10px; background:transparent;border-radius:6px;"></canvas>
      <div style="text-align:right; margin-top:8px;"><button id="close">Close</button></div>
    `;
    this.container.appendChild(this.el);
    this.listEl = this.el.querySelector('#stats-list');
    this.chart = this.el.querySelector('#stats-chart');
    this.ctx = this.chart.getContext('2d');
    this.el.querySelector('#close').addEventListener('click', () => this.close());
    this.render();
  }

  render() {
    const sessions = StatsManager.list().slice().reverse();
    if (!sessions || sessions.length === 0) {
      this.listEl.innerHTML = '<div>No sessions yet</div>';
      this.clearChart();
      return;
    }
    this.listEl.innerHTML = '';
    const labels = [];
    const scores = [];
    sessions.slice(0, 20).forEach((s, i) => {
      labels.push(new Date(s.end).toLocaleTimeString());
      scores.push(s.score || 0);
      const row = document.createElement('div');
      row.style.padding = '6px 4px';
      row.style.borderBottom = '1px solid rgba(0,255,255,0.04)';
      row.innerHTML = `<strong>${s.mode}</strong> — ${Math.round((s.duration||0)/1000)}s — score: ${s.score||0} — hits:${s.hits||0} shots:${s.shots||0}`;
      this.listEl.appendChild(row);
    });
    this.drawChart(labels.reverse(), scores.reverse());
  }

  clearChart() {
    this.ctx.clearRect(0,0,this.chart.width,this.chart.height);
  }

  drawChart(labels, data) {
    // simple lightweight line chart without external deps
    const ctx = this.ctx;
    const w = this.chart.width; const h = this.chart.height;
    ctx.clearRect(0,0,w,h);
    if (!data || data.length === 0) return;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const pad = 8;
    ctx.strokeStyle = 'rgba(0,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad + (i/(data.length-1 || 1))*(w-pad*2);
      const y = h - pad - ((v - min)/(max - min || 1))*(h-pad*2);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // small points
    ctx.fillStyle = 'rgba(0,255,255,0.95)';
    data.forEach((v, i) => {
      const x = pad + (i/(data.length-1 || 1))*(w-pad*2);
      const y = h - pad - ((v - min)/(max - min || 1))*(h-pad*2);
      ctx.beginPath(); ctx.arc(x,y,2.6,0,Math.PI*2); ctx.fill();
    });
  }

  close() {
    try { this.el.remove(); } catch(e) {}
  }
}
