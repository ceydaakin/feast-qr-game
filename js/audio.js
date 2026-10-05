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
  osc.onended = () => { osc.disconnect(); amp.disconnect(); };
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Filtered white-noise sweep: whooshes on the explainer's cuts and swipes.
let noiseBuf = null;
function whoosh(dur, { gain = 0.12, from = 400, to = 3000, delay = 0 } = {}) {
  const ac = ensure();
  if (!ac || muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  const bp = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = noiseBuf;
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(from, t0);
  bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(amp).connect(ac.destination);
  src.onended = () => { src.disconnect(); bp.disconnect(); amp.disconnect(); };
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const pop = (delay, f = 700) => tone(f, 0.08, { type: 'triangle', gain: 0.12, slideTo: f * 1.8, delay });
const thump = (delay) => tone(140, 0.32, { type: 'sine', gain: 0.35, slideTo: 45, delay });

// Explainer scenes, delays in s — mirror the animation delays in reward.css
// (.ex-hook, .ex-words, .ex-pin, .ex-route, reelScroll, .ex-msg).
// ponytail: hand-synced to CSS; retime here if those delays change.
const SCENES = {
  hook: ({ words = 3 }) => {
    for (let i = 0; i < words; i++) pop(i * 0.15, 520 + i * 90);
    pop(0.52, 1050);
  },
  brand: () => {
    thump(0);
    [0.32, 0.58].forEach((d) => tone(880, 0.07, { type: 'square', gain: 0.05, delay: d }));
    [784, 1046, 1568].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.1, delay: 0.83 + i * 0.05 }));
  },
  map: () => {
    [0.3, 0.45, 0.6, 0.75].forEach((d, i) => pop(d, 600 + i * 120));
    tone(300, 0.6, { type: 'sine', gain: 0.06, slideTo: 900, delay: 0.35 });
    [1320, 1760].forEach((f, i) => tone(f, 0.12, { type: 'sine', gain: 0.1, delay: 0.95 + i * 0.08 }));
  },
  reels: () => {
    pop(0.14, 900); // sticker
    [0.48, 1.1, 1.73].forEach((d) => whoosh(0.28, { gain: 0.09, from: 2500, to: 600, delay: d }));
    tone(1200, 0.1, { type: 'triangle', gain: 0.1, slideTo: 1800, delay: 0.9 }); // like
  },
  friends: () => {
    [0.15, 0.5, 0.8, 1.2].forEach((d, i) => tone(i % 3 ? 1100 : 820, 0.09, { type: 'sine', gain: 0.12, slideTo: i % 3 ? 1500 : 1000, delay: d }));
  },
};

// Kills come in bursts during a horde; overlapping identical blips add nothing
// but main-thread node churn (and audio underruns on iOS).
const CATCH_GAP = 0.06;
let lastCatch = -1;

export const sfx = {
  unlock() {
    const ac = ensure();
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  },
  catchGood(multiplier = 1) {
    const ac = ensure();
    if (!ac || muted || ac.currentTime - lastCatch < CATCH_GAP) return;
    lastCatch = ac.currentTime;
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
  // One call per explainer cut: whoosh + that scene's hits.
  scene(id, opts = {}) {
    whoosh(0.22);
    SCENES[id]?.(opts);
  },
  setMuted(value) {
    muted = value;
    if (ctx) (muted ? ctx.suspend() : ctx.resume()).catch(() => {});
  },
  isMuted: () => muted,
};
