// FROSTLINE — every sound is synthesized live with WebAudio.
// No audio files, no network. Engine hum, wind, siren, gunshots, music pad.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenStep = 0;
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    // Engine: a sawtooth through a lowpass, pitch follows speed.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();

    // Wind: looped white noise through a bandpass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 480; windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.05;
    noise.connect(windFilter).connect(this.windGain).connect(ctx.destination);
    noise.start();

    // Siren: two alternating sine tones, flipped on a timer.
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
    this.sirenOsc.start();
    setInterval(() => {
      if (!this.ctx || this.muted) return;
      this.sirenStep = 1 - this.sirenStep;
      this.sirenOsc.frequency.value = this.sirenStep ? 950 : 700;
    }, 420);

    // Slow drifting minor pad: a quiet chord every 8 seconds.
    const chords = [[110, 130.8, 164.8], [98, 123.5, 146.8], [87.3, 110, 130.8], [103.8, 123.5, 155.6]];
    let ci = 0;
    const playChord = () => {
      if (!this.ctx) return;
      const chord = chords[ci % chords.length]; ci++;
      for (const f of chord) {
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(this.muted ? 0 : 0.028, ctx.currentTime + 2.5);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 8);
        o.connect(g).connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 8.2);
      }
    };
    playChord();
    this.musicTimer = setInterval(playChord, 8000);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ctx.destination.gain?.setTargetAtTime(m ? 0 : 1, t, 0.1);
    if (this.engineGain) this.engineGain.gain.value = m ? 0 : this.engineGain.gain.value;
  }

  // Per-frame: engine pitch tracks speed, wind rises in a blizzard.
  update(dt, speed, blizzard) {
    if (!this.ctx || this.muted) return;
    if (this.engineGain) {
      this.engineGain.gain.value = speed > 0.5 ? Math.min(0.06, 0.02 + speed * 0.0012) : 0.015;
      this.engineOsc.frequency.value = 48 + Math.abs(speed) * 3.2;
    }
    if (this.windGain) this.windGain.gain.value = blizzard ? 0.16 : 0.05;
  }

  siren(on) {
    if (!this.ctx) return;
    if (this.sirenGain) this.sirenGain.gain.value = on && !this.muted ? 0.035 : 0;
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    // Noise burst through a lowpass, plus a low square thump.
    const len = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
    this.blip(90, 0.14, 'square', 0.18);
  }

  pickup() { this.blip(660, 0.12); setTimeout(() => this.blip(990, 0.14), 90); }

  mission() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.1), i * 110));
  }
}
