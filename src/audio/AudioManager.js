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
      // layered hit: quick high click + short low thud
      this._beep(1200, 0.02);
      setTimeout(() => this._beep(520, 0.06), 30);
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
    } else if (name === 'shoot') {
      // short muzzle pop
      this._beep(1800, 0.01);
      setTimeout(() => this._beep(700, 0.03), 10);
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

/*
If you prefer to use external samples instead of generated tones, uncomment Howler usage and
place assets under `assets/sounds/` or use remote CDN links. Example free sources:
- https://freesound.org (search CC0/Creative Commons with attribution as needed)
- https://github.com (raw links to small WAVs)

Example (commented):
import { Howl } from 'https://unpkg.com/howler@2.2.4/dist/howler.es.js';
this.sounds = { shoot: new Howl({src:['assets/sounds/shoot.wav']}) }
*/