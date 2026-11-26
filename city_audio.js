// Cozy Lo-Fi Cyber Ambient Pad & Tactile Building Chimes
window.CityAudio = (() => {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let padGain = null;
  let sfxOn = true;
  let musicOn = true;
  let padTimer = null;
  let chordIdx = 0;
  let paintStep = 0;
  let lastPaintAt = 0;

  // Dreamy synthwave maj7/min9 chord voicings (Hz)
  const CHORDS = [
    [130.81, 196.00, 246.94, 293.66], // Cmaj9
    [110.00, 164.81, 220.00, 261.63], // Am7
    [87.31,  174.61, 220.00, 261.63], // Fmaj7
    [98.00,  196.00, 246.94, 293.66]  // G6
  ];
  const MARIMBA = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxOn ? 0.65 : 0;
      sfxGain.connect(master);

      padGain = ctx.createGain();
      padGain.gain.value = musicOn ? 0.22 : 0;
      padGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function startAmbient() {
    if (padTimer) return;
    ensure();
    const playChord = () => {
      if (!ctx || !musicOn || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const notes = CHORDS[chordIdx % CHORDS.length];
      chordIdx++;
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.detune.setValueAtTime((idx - 1.5) * 4, now);
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(620, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.14 : 0.065, now + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
        osc.connect(filt);
        filt.connect(g);
        g.connect(padGain);
        osc.start(now);
        osc.stop(now + 3.9);
      });
    };
    playChord();
    padTimer = setInterval(playChord, 3700);
  }

  function chime(freq, dur = 0.16, vol = 0.18, type = 'sine', delay = 0) {
    if (!sfxOn) return;
    const ac = ensure();
    if (!ac) return;
    const now = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  return {
    unlock() {
      ensure();
      startAmbient();
    },
    toggleSfx() {
      sfxOn = !sfxOn;
      if (ctx && sfxGain) sfxGain.gain.setTargetAtTime(sfxOn ? 0.65 : 0, ctx.currentTime, 0.04);
      return sfxOn;
    },
    toggleMusic() {
      musicOn = !musicOn;
      if (ctx && padGain) padGain.gain.setTargetAtTime(musicOn ? 0.22 : 0, ctx.currentTime, 0.08);
      return musicOn;
    },
    paintRoad() {
      const t = performance.now();
      paintStep = t - lastPaintAt < 450 ? Math.min(MARIMBA.length - 1, paintStep + 1) : 0;
      lastPaintAt = t;
      chime(MARIMBA[paintStep], 0.13, 0.15, 'triangle');
    },
    placeBuilding(kind) {
      const base = kind === 'power' ? 329.63 : (kind === 'park' ? 523.25 : (kind === 'skyport' ? 587.33 : 440));
      chime(base, 0.16, 0.17, 'triangle', 0);
      chime(base * 1.5, 0.2, 0.14, 'sine', 0.05);
    },
    bulldoze() {
      chime(190, 0.12, 0.16, 'sawtooth');
      chime(125, 0.14, 0.14, 'triangle', 0.03);
    },
    upgradeTower() {
      chime(523.25, 0.15, 0.12, 'sine', 0);
      chime(659.25, 0.16, 0.12, 'sine', 0.06);
      chime(783.99, 0.22, 0.13, 'sine', 0.12);
    },
    milestone() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => chime(f, 0.34, 0.17, 'triangle', i * 0.08));
    },
    error() {
      chime(165, 0.14, 0.14, 'sawtooth');
    }
  };
})();
