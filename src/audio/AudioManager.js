// NOTE: Original project used Howler.js and external sound assets.
// Many environments may not have those files available. For now we use
// a lightweight WebAudio fallback that generates short tones so the
// game still provides audio feedback without external assets.

import { Storage } from '../utils/Storage.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = Storage.get('audio.volume', 0.7);
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  play(name) {
    this.ensureContext();
    const t = this.ctx.currentTime;
    if (name === 'hit') {
      this._beep(880, 0.06);
    } else if (name === 'miss') {
      this._beep(220, 0.08);
    } else if (name === 'click') {
      this._beep(1200, 0.03);
    } else if (name === 'combo') {
      this._beep(1200, 0.06);
      setTimeout(() => this._beep(1500, 0.04), 80);
    } else if (name === 'complete') {
      this._beep(1000, 0.12);
      setTimeout(() => this._beep(1400, 0.08), 120);
    }
  }

  _beep(freq, dur) {
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = this.volume * 0.2;
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (e) {
      // silent fail
    }
  }

  setVolume(vol) {
    this.volume = vol;
    Storage.set('audio.volume', vol);
  }
}