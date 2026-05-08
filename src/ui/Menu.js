export class Menu {
  constructor(container, game) {
    this.container = container;
    this.game = game;
    this.element = document.createElement('div');
    this.element.id = 'main-menu';
    this.element.className = 'glass';
    this.element.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 30px;
      min-width: 300px;
      text-align: center;
    `;
    this.build();
    this.container.appendChild(this.element);
  }

  build() {
    this.element.innerHTML = `
      <h2 class="neon-text">AimTrainer.js</h2>
      <button class="btn" data-action="start">Start Training</button>
      <button class="btn" data-action="settings">Settings</button>
      <button class="btn" data-action="stats">Stats</button>
    `;

    this.element.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.game.audio.play('click');
        if (action === 'start') this.game.showModeSelect();
        if (action === 'settings') this.game.showSettings();
        if (action === 'stats') this.game.showStats();
      });
    });

    // lightweight entrance animation using CSS transitions
    Array.from(this.element.children).forEach((c, i) => {
      c.style.opacity = '0';
      c.style.transform = 'translateY(12px)';
      c.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
      setTimeout(() => {
        c.style.opacity = '1';
        c.style.transform = 'translateY(0px)';
      }, 80 * i);
    });
  }

  hide() {
    this.element.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(-20px)';
    setTimeout(() => this.element.classList.add('hidden'), 300);
  }
}