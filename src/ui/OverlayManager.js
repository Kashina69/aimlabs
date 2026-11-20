/* Owns exactly one full-screen overlay at a time (home, pause, results, stats).
   An optional owner object gets destroy() called when its overlay is replaced,
   so screens can drop window listeners they added. */
export class OverlayManager {
  constructor(container) {
    this.container = container;
    this.activeOverlay = null;
    this.owner = null;
  }

  show(overlayElement, owner = null) {
    this.close();
    this.activeOverlay = overlayElement;
    this.owner = owner;
    this.container.appendChild(overlayElement);
    return overlayElement;
  }

  is(id) {
    return this.activeOverlay?.id === id;
  }

  close() {
    if (!this.activeOverlay) return;
    try {
      this.owner?.destroy?.();
      this.activeOverlay.remove();
    } catch (error) {
      // no-op
    }
    this.activeOverlay = null;
    this.owner = null;
  }
}
