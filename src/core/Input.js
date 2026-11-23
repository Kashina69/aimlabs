export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0 };
    /* Absolute mouse travel since the last reset. Used by the sensitivity
       finder's pointer-acceleration check, which compares the counts for the
       same physical sweep made slowly and quickly. */
    this.travel = { x: 0, y: 0 };
    /* Freezes view rotation while still counting travel (calibration steps) */
    this.freezeLook = false;
    this.isLocked = false;
    /* Free-cursor mode: the game deliberately released the pointer during a
       session, so losing lock must not auto-pause and the cursor is a normal
       arrow instead of the aiming crosshair */
    this.freeCursor = false;
    /* Only allow pointer lock while a game session is active, so the cursor
       can never get locked up in an idle menu (game flips this on start/resume) */
    this.lockEnabled = false;

    // ensure canvas is focusable
    try { this.canvas.tabIndex = this.canvas.tabIndex || -1; } catch(e) {}
    canvas.addEventListener('click', () => {
      if (!this.isLocked && this.lockEnabled) {
        this.requestLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === canvas;
      this.applyCursor();
    });

    /* Deltas accumulate between animation frames instead of being overwritten,
       so fast flicks are never dropped. Game clears them after applying. */
    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        this.mouse.x += e.movementX;
        this.mouse.y += e.movementY;
        this.travel.x += Math.abs(e.movementX);
        this.travel.y += Math.abs(e.movementY);
      }
    });

    this.keys = {};
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    /* Primary button held-state for hold-tracking modes (document level so a
       press started mid-frame is never lost) */
    this.primaryDown = false;
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.primaryDown = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.primaryDown = false;
    });
  }

  /**
   * What: Clears the accumulated absolute mouse travel.
   * Why:  The acceleration probe measures one sweep at a time.
   * How:  Zeroes both axes.
   */
  resetTravel() {
    this.travel.x = 0;
    this.travel.y = 0;
  }

  requestLock() {
    try {
      const request = this.canvas.requestPointerLock();
      if (request?.catch) request.catch(() => {});
    } catch (e) {}
  }

  applyCursor() {
    try {
      /* Hidden while locked; free-cursor mode shows the normal arrow, and the
         aiming-crosshair fallback applies when a released lock was accidental */
      this.canvas.style.cursor = this.isLocked ? 'none' : (this.freeCursor ? 'default' : 'crosshair');
    } catch (e) {}
  }

  unlock() {
    document.exitPointerLock();
    this.isLocked = false;
  }
}
