export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0 };
    this.isLocked = false;

    canvas.addEventListener('click', () => {
      if (!this.isLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas;
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