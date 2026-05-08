export class OverlayManager {
  constructor(container) {
    this.container = container;
    this.activeOverlay = null;
  }

  show(overlayElement) {
    this.close();
    this.activeOverlay = overlayElement;
    this.container.appendChild(overlayElement);
    return overlayElement;
  }

  close() {
    if (!this.activeOverlay) return;
    try {
      this.activeOverlay.remove();
    } catch (error) {
      // no-op
    }
    this.activeOverlay = null;
  }
}
