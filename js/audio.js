// Tiny synthesized SFX — zero audio files to download.
// The AudioContext is created lazily on the first user gesture (iOS requirement).

let ctx = null;
let muted = false;

function ensure() {
  if (ctx || muted) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch (err) {
    console.warn('[feast-game] audio unavailable', err);
    ctx = null;
  }
  return ctx;
}

function tone(freq, dur, { type = 'sine', gain = 0.15, slideTo = null, delay = 0 } = {}) {
  const ac = ensure();
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock() {
    const ac = ensure();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  },
  catchGood(multiplier = 1) {
    tone(520 + multiplier * 90, 0.09, { type: 'triangle', slideTo: 900 + multiplier * 120 });
  },
  bonus() {
    [660, 880, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.07 }));
  },
  hurt() {
    tone(220, 0.25, { type: 'sawtooth', gain: 0.12, slideTo: 90 });
  },
  tick() {
    tone(1000, 0.04, { type: 'square', gain: 0.05 });
  },
  gameOver() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.11 }));
  },
  setMuted(value) {
    muted = value;
    if (ctx) (muted ? ctx.suspend() : ctx.resume()).catch(() => {});
  },
  isMuted: () => muted,
};
