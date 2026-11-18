// DUSTLINE sound: everything is synthesized with WebAudio — no audio files, no
// network. Engine hum, sirens, gunshots, pickups and a dusty wind bed, plus a tiny
// procedural bass-and-hat loop that keeps the golden hour moving.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.windSrc = null;
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  /** Must be called from a user gesture (click / key) — browsers block audio before that. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.startWind();
    } catch (e) {
      this.ctx = null; // audio is garnish — the game plays fine without it
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  /** A reusable noise buffer (2 seconds of white noise). */
  noiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  startWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    this.windSrc = src;
  }

  /** Continuous engine drone; call every frame with speed 0..1 (0 = off). */
  engine(speed01) {
    if (!this.ctx) return;
    if (speed01 <= 0.02) {
      if (this.engineOsc) {
        try { this.engineOsc.stop(); } catch (e) {}
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 700;
      this.engineOsc.connect(filt).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.06, t, 0.1);
  }

  /** Two-tone police siren while any cop is near; call every frame with real dt. */
  siren(active, dt = 1 / 60) {
    if (!this.ctx) return;
    if (!active) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) {}
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      this.sirenTimer = 0;
    }
    this.sirenTimer += dt;
    const hi = Math.floor(this.sirenTimer * 1.6) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.022, this.ctx.currentTime, 0.1);
  }

  /** Short punchy gunshot: noise burst through a fast-closing lowpass. */
  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(3200, t);
    filt.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  punch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  /** Two-note cash blip. */
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.22);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 0.25);
    });
  }

  /** Mission-complete jingle: four rising notes. */
  missionDone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const start = t + i * 0.11;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      o.connect(g).connect(this.master);
      o.start(start);
      o.stop(start + 0.32);
    });
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.35);
  }

  /**
   * Tiny desert groove, scheduled a step at a time: a lazy bassline in A minor
   * with a brushed hat. Called every frame; it schedules one 8th-note step when due.
   */
  music(dt) {
    if (!this.ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.21; // ~143 bpm 8th notes
    const bassLine = [55, 0, 55, 65.4, 0, 55, 49, 61.7];
    const step = this.musicStep % 8;
    const freq = bassLine[step];
    const t = this.ctx.currentTime;
    if (freq > 0) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.22);
    }
    if (step % 2 === 0) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(filt).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    }
    this.musicStep += 1;
  }
}
