export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0 };
    this.isLocked = false;
    /* Only allow pointer lock while a game session is active, so the cursor
       can never get locked up in an idle menu (game flips this on start/resume) */
    this.lockEnabled = false;

    // ensure canvas is focusable
    try { this.canvas.tabIndex = this.canvas.tabIndex || -1; } catch(e) {}
    canvas.addEventListener('click', () => {
      if (!this.isLocked && this.lockEnabled) {
        try {
          const request = canvas.requestPointerLock();
          if (request?.catch) request.catch(() => {});
        } catch (e) {}
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas;
      if (this.isLocked) {
        try { canvas.style.cursor = 'none'; } catch(e) {}
      } else {
        try { canvas.style.cursor = 'crosshair'; } catch(e) {}
      }
    });

    /* Deltas accumulate between animation frames instead of being overwritten,
       so fast flicks are never dropped. Game clears them after applying. */
    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        this.mouse.x += e.movementX;
        this.mouse.y += e.movementY;
      }
    });

    this.keys = {};
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
  }

  unlock() {
    document.exitPointerLock();
    this.isLocked = false;
  }
}