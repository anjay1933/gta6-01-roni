// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// Engine hum, sirens, gunshots, pickups and explosions, each a few oscillators.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      engineOsc.connect(filt);
      engineOsc2.connect(filt);
      filt.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: one triangle that alternates between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch {
      /* audio is cosmetic; never break the game */
    }
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lowFreq;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start();
    } catch {
      /* cosmetic */
    }
  }

  return {
    unlock,
    get isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    setEngine(speed01, on) {
      if (!ensure() || muted) return;
      try {
        const target = on ? 0.05 + speed01 * 0.11 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.1);
        engineOsc2.frequency.setTargetAtTime(26 + speed01 * 66, ctx.currentTime, 0.1);
      } catch {
        /* cosmetic */
      }
    },
    setSiren(on, dt) {
      if (!ensure()) return;
      try {
        if (on && !muted) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenTimer = 0.42;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, ctx.currentTime, 0.02);
          }
          sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        }
      } catch {
        /* cosmetic */
      }
    },
    shoot() {
      noiseBurst(0.09, 0.5, 2600);
      blip(190, 0.07, 'square', 0.18, 70);
    },
    enemyShoot() {
      noiseBurst(0.07, 0.22, 1800);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      blip(990, 0.12, 'sine', 0.25);
    },
    crash() {
      noiseBurst(0.25, 0.5, 900);
      blip(90, 0.3, 'sine', 0.4, 40);
    },
    explosion() {
      noiseBurst(0.7, 0.8, 500);
      blip(120, 0.6, 'sine', 0.5, 30);
    },
    missionDone() {
      blip(523, 0.12, 'sine', 0.3);
      setTimeout(() => blip(659, 0.12, 'sine', 0.3), 120);
      setTimeout(() => blip(784, 0.22, 'sine', 0.32), 240);
    },
    wantedUp() {
      blip(220, 0.15, 'square', 0.2, 440);
    },
  };
}
