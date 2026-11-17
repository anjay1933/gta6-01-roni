// NEON HARBOR — audio: everything synthesized with WebAudio, no files, no network.
(function () {
  var NH = window.NH;
  var A = NH.audio = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    rainSrc: null, musicTimer: null, musicOn: false, muted: false
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      A.startRain();
      A.startMusic();
    } catch (e) { A.ctx = null; }
  };

  function noiseBuffer(seconds) {
    var len = Math.floor(A.ctx.sampleRate * seconds);
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  A.startRain = function () {
    var src = A.ctx.createBufferSource();
    src.buffer = noiseBuffer(2); src.loop = true;
    var filt = A.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    var g = A.ctx.createGain(); g.gain.value = 0.05;
    src.connect(filt); filt.connect(g); g.connect(A.master);
    src.start(); A.rainSrc = src;
  };

  // Tiny procedural music loop: dark synth bassline + hats, scheduled in steps.
  A.startMusic = function () {
    if (A.musicTimer) return;
    var bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 49];
    var step = 0;
    A.musicTimer = setInterval(function () {
      if (!A.ctx || A.muted || !A.musicOn) return;
      var f = bass[step % 16];
      if (f > 0) {
        var o = A.ctx.createOscillator(), g = A.ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = f;
        g.gain.setValueAtTime(0.09, A.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + 0.22);
        o.connect(g); g.connect(A.master);
        o.start(); o.stop(A.ctx.currentTime + 0.24);
      }
      // hat tick every other step
      if (step % 2 === 0) {
        var n = A.ctx.createBufferSource(); n.buffer = noiseBuffer(0.03);
        var hp = A.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
        var hg = A.ctx.createGain(); hg.gain.value = 0.03;
        n.connect(hp); hp.connect(hg); hg.connect(A.master); n.start();
      }
      step++;
    }, 170);
  };

  A.setMusic = function (on) { A.musicOn = on; };

  A.engine = function (on, speedNorm) {
    if (!A.ctx) return;
    if (on && !A.engineOsc) {
      var o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 60;
      g.gain.value = 0.04;
      var f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      o.connect(f); f.connect(g); g.connect(A.master);
      o.start(); A.engineOsc = o; A.engineGain = g;
    }
    if (!on && A.engineOsc) { try { A.engineOsc.stop(); } catch (e) {} A.engineOsc = null; A.engineGain = null; }
    if (A.engineOsc) {
      A.engineOsc.frequency.value = 55 + speedNorm * 140;
      A.engineGain.gain.value = 0.03 + speedNorm * 0.05;
    }
  };

  A.siren = function (on) {
    if (!A.ctx) return;
    if (on && !A.sirenOsc) {
      var o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 700;
      var lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      lfo.type = 'square'; lfo.frequency.value = 0.8; lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0.035;
      o.connect(g); g.connect(A.master);
      o.start(); lfo.start();
      A.sirenOsc = o; A.sirenGain = g; A.sirenLfo = lfo;
    }
    if (!on && A.sirenOsc) {
      try { A.sirenOsc.stop(); A.sirenLfo.stop(); } catch (e) {}
      A.sirenOsc = null; A.sirenGain = null; A.sirenLfo = null;
    }
  };

  A.shot = function () {
    if (!A.ctx) return;
    var n = A.ctx.createBufferSource(); n.buffer = noiseBuffer(0.12);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.5, A.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + 0.12);
    n.connect(g); g.connect(A.master); n.start();
  };

  A.blip = function (freq) {
    if (!A.ctx) return;
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq || 880;
    g.gain.setValueAtTime(0.12, A.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + 0.12);
    o.connect(g); g.connect(A.master);
    o.start(); o.stop(A.ctx.currentTime + 0.13);
  };

  A.pickup = function () { A.blip(660); setTimeout(function () { A.blip(990); }, 90); };
  A.crash = function () {
    if (!A.ctx) return;
    var n = A.ctx.createBufferSource(); n.buffer = noiseBuffer(0.25);
    var f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    var g = A.ctx.createGain(); g.gain.value = 0.4;
    n.connect(f); f.connect(g); g.connect(A.master); n.start();
  };
})();
