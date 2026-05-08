export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0 };
    this.isLocked = false;

    // ensure canvas is focusable
    try { this.canvas.tabIndex = this.canvas.tabIndex || -1; } catch(e) {}
    canvas.addEventListener('click', () => {
      if (!this.isLocked) {
        canvas.requestPointerLock();
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

    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        this.mouse.x = e.movementX;
        this.mouse.y = e.movementY;
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