export class StatsUI {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'glass stats';
    this.el.style.cssText = 'position:absolute; top:10%; right:10px; padding:12px; min-width:200px;';
    this.el.innerHTML = `<h4 class="neon-text">Session Stats</h4><div id="stats-content">No sessions yet</div><div style="text-align:right; margin-top:8px;"><button id="close">Close</button></div>`;
    this.container.appendChild(this.el);
    this.el.querySelector('#close').addEventListener('click', () => this.close());
  }

  close() {
    this.el.remove();
  }
}
