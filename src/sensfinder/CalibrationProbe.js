/**
 * What: The slow/fast mouse-sweep probe that detects pointer acceleration.
 * Why:  Absolute cm/360 is only trustworthy if mouse counts scale linearly with
 *       physical distance; Windows "Enhance pointer precision" breaks that.
 * How:  Counts absolute horizontal travel for one slow and one fast sweep of the
 *       same pad distance. A ratio beyond 6% is reported as acceleration.
 */

const MIN_SWEEP_COUNTS = 150;
const ACCELERATION_TOLERANCE = 0.06;

export class CalibrationProbe {
  constructor(input) {
    this.input = input;
    this.stage = null;
    this.slow = 0;
    this.result = {
      dpr: window.devicePixelRatio || 1,
      acceleration: 'unchecked'
    };
  }

  /**
   * What: Starts the probe and freezes view rotation while travel is counted.
   * Why:  A full-pad sweep would otherwise spin the camera and distract the player.
   * How:  Enables `input.freezeLook`, resets the travel counter, and returns the stage.
   */
  begin() {
    this.stage = 'slow';
    this.input.freezeLook = true;
    this.input.resetTravel();
    return 'slow';
  }

  /**
   * What: Records one sweep and advances the probe.
   * Why:  The player marks each pass with a click; the probe needs no timers.
   * How:  Returns 'retry' (not enough movement), 'fast' (slow pass done) or 'done'.
   */
  click() {
    const counts = this.input.travel.x;
    if (counts < MIN_SWEEP_COUNTS) return 'retry';

    if (this.stage === 'slow') {
      this.slow = counts;
      this.stage = 'fast';
      this.input.resetTravel();
      return 'fast';
    }

    const ratio = this.slow > 0 ? counts / this.slow : 1;
    this.result.acceleration = Math.abs(ratio - 1) > ACCELERATION_TOLERANCE ? 'detected' : 'ok';
    this.result.accelerationRatio = Math.round(ratio * 1000) / 1000;
    this.result.slowCounts = Math.round(this.slow);
    this.result.fastCounts = Math.round(counts);
    this.finish();
    return 'done';
  }

  /**
   * What: Releases the frozen view and returns the collected check values.
   * Why:  The session must resume normal look control before the warm-up starts.
   * How:  Clears `freezeLook` and the travel counter.
   */
  finish() {
    this.input.freezeLook = false;
    this.input.resetTravel();
    this.stage = 'done';
    return this.result;
  }
}
