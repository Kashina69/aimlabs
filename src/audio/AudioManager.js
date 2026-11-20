import { Storage } from '../utils/Storage.js';

/* Synthesised game audio (WebAudio, no files to download). Every sound has a short
   attack/decay envelope so tones never click. To use recorded samples instead,
   add files under assets/sounds/ and list them in SAMPLE_URLS. */
const SAMPLE_URLS = {
  // shoot: 'assets/sounds/shoot.wav',
  // hit: 'assets/sounds/hit.wav'
};
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = Storage.get('audio.volume', 0.7);
    this.hitSound = Storage.get('audio.hitSound', 'tick');
    this.buffers = {};
    this.samplesRequested = false;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.samplesRequested) {
      this.samplesRequested = true;
      for (const [name, url] of Object.entries(SAMPLE_URLS)) this.loadSample(name, url);
    }
  }

  play(name) {
    if (name === 'hit' && this.hitSound === 'off') return;
    try {
      this.ensureContext();
    } catch (error) {
      return;
    }
    if (this.buffers[name]) {
      this.playBuffer(this.buffers[name]);
      return;
    }
    const sound = SOUNDS[name === 'hit' ? `hit-${this.hitSound}` : name];
    if (sound) sound(this);
  }

  /* One enveloped oscillator: frequency can glide from f0 to f1 over the duration */
  tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.2, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* Short filtered noise burst, used for the shot */
  noise({ dur, gain = 0.15, freq = 2400 }) {
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    env.gain.value = gain;
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start();
  }

  playBuffer(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master);
    src.start();
  }

  async loadSample(name, url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.arrayBuffer();
      this.buffers[name] = await this.ctx.decodeAudioData(data);
    } catch (error) {
      // optional asset not present: synthesised sound stays
    }
  }

  setVolume(volume) {
    this.volume = volume;
    Storage.set('audio.volume', volume);
    if (this.master) this.master.gain.value = volume;
  }

  setHitSound(kind) {
    this.hitSound = kind;
    Storage.set('audio.hitSound', kind);
  }
}

/* Sound recipes, kept short so rapid fire never stacks into mush */
const SOUNDS = {
  shoot: (a) => a.noise({ dur: 0.045, gain: 0.12, freq: 1800 }),
  'hit-tick': (a) => {
    a.tone({ type: 'triangle', f0: 2200, f1: 1500, dur: 0.05, gain: 0.22 });
  },
  'hit-pop': (a) => {
    a.tone({ type: 'sine', f0: 900, f1: 420, dur: 0.08, gain: 0.3 });
    a.tone({ type: 'triangle', f0: 2600, dur: 0.02, gain: 0.08 });
  },
  miss: (a) => a.tone({ type: 'sine', f0: 240, f1: 180, dur: 0.06, gain: 0.08 }),
  combo: () => {},
  click: (a) => a.tone({ type: 'triangle', f0: 1400, dur: 0.03, gain: 0.08 }),
  countdown: (a) => a.tone({ type: 'sine', f0: 880, dur: 0.08, gain: 0.12 }),
  go: (a) => a.tone({ type: 'sine', f0: 1320, dur: 0.14, gain: 0.14 }),
  complete: (a) => {
    a.tone({ type: 'sine', f0: 880, dur: 0.12, gain: 0.14 });
    a.tone({ type: 'sine', f0: 1320, dur: 0.18, gain: 0.14, delay: 0.1 });
  },
  best: (a) => {
    a.tone({ type: 'sine', f0: 880, dur: 0.1, gain: 0.14 });
    a.tone({ type: 'sine', f0: 1175, dur: 0.1, gain: 0.14, delay: 0.09 });
    a.tone({ type: 'sine', f0: 1760, dur: 0.22, gain: 0.14, delay: 0.18 });
  }
};
