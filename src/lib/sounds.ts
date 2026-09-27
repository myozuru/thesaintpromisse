// Sound system — all MP3s pre-loaded as Web Audio buffers for instant playback
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function ensureResumed() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

const bufferCache: Record<string, AudioBuffer> = {};
const loadingSet = new Set<string>();

function preloadSound(file: string) {
  if (bufferCache[file] || loadingSet.has(file)) return;
  loadingSet.add(file);
  fetch(`/sounds/${file}`)
    .then((r) => r.arrayBuffer())
    .then((buf) => getCtx().decodeAudioData(buf))
    .then((decoded) => { bufferCache[file] = decoded; })
    .catch(() => { loadingSet.delete(file); });
}

function preloadAll() {
  preloadSound('enter.mp3');
  preloadSound('tab-switch.mp3');
  preloadSound('delete.mp3');
  preloadSound('ficha-toggle.mp3');
  preloadSound('ficha-create.mp3');
  preloadSound('category-toggle.mp3');
  preloadSound('clock-click.mp3');
}

if (typeof window !== 'undefined') {
  const startPreload = () => {
    preloadAll();
    window.removeEventListener('pointerdown', startPreload);
    window.removeEventListener('keydown', startPreload);
  };
  window.addEventListener('pointerdown', startPreload);
  window.addEventListener('keydown', startPreload);
}

function playBuffered(file: string, volume = 1) {
  ensureResumed();
  const buf = bufferCache[file];
  if (buf) {
    const ctx = getCtx();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start(0);
  } else {
    const audio = new Audio(`/sounds/${file}`);
    audio.volume = volume;
    audio.play().catch(() => {});
  }
}

function createCaveReverb(ctx: AudioContext, duration = 2.5, decay = 3): ConvolverNode {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

export function playOpeningSound() { playBuffered('enter.mp3'); }
export function playTabSound(_tabIndex?: number) { playBuffered('tab-switch.mp3'); }
export function playDeleteSound() { playBuffered('delete.mp3'); }
export function playDangerSound() { playDeleteSound(); }
export function playFichaToggleSound() { playBuffered('ficha-toggle.mp3'); }
export function playFichaCreateSound() { playBuffered('ficha-create.mp3'); }
export function playCategoryToggleSound() { playBuffered('category-toggle.mp3'); }
export function playClockClickSound() { playBuffered('clock-click.mp3'); }

export function playClickSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(3200, now);
  osc2.frequency.exponentialRampToValueAtTime(800, now + 0.03);
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 5;
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.08);
  osc2.stop(now + 0.08);
}

export function playToggleSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(280, now + 0.08);
  osc.frequency.linearRampToValueAtTime(150, now + 0.15);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(60, now);
  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.2);
  osc2.stop(now + 0.2);
}

export function playDiceSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const reverb = createCaveReverb(ctx, 1, 5);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  for (let i = 0; i < 10; i++) {
    const t = now + i * 0.035 + Math.random() * 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 2000, t);
    osc.frequency.exponentialRampToValueAtTime(200 + Math.random() * 400, t + 0.02);
    gain.gain.setValueAtTime(0.03 + Math.random() * 0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(reverb).connect(wet).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }
}

export function playSuccessSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const reverb = createCaveReverb(ctx, 2, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  [261, 311, 392].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.12);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5;
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(now + i * 0.12);
    lfo.stop(now + i * 0.12 + 0.6);
    gain.gain.setValueAtTime(0, now + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.05, now + i * 0.12 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(reverb).connect(wet).connect(ctx.destination);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.6);
  });
}

export function playErrorSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(65, now);
  osc.frequency.linearRampToValueAtTime(40, now + 0.4);
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(62, now);
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.5);
  osc2.stop(now + 0.5);
}

export function playTimeAdvanceSound() {
  ensureResumed();
  const ctx = getCtx();
  const now = ctx.currentTime;
  const reverb = createCaveReverb(ctx, 1.5, 4);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.2;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 - i * 30, t);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(reverb).connect(wet).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}

// ── Impacto 3D dos dados: síntese curta, disparada por colisões reais da física ──
let noiseBuf: AudioBuffer | null = null;
let recentHits: number[] = [];
function getNoise(ctx: AudioContext) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.08);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** Toca um "clac" de dado. intensity 0..1 (velocidade do impacto); surface: mesa ou outro dado. */
export function playDiceHit(intensity: number, surface: 'tray' | 'dice' = 'tray') {
  if (intensity < 0.04) return;
  const nowMs = performance.now();
  recentHits = recentHits.filter((t) => nowMs - t < 80);
  if (recentHits.length >= 6) return; // evita estourar com muitos dados
  recentHits.push(nowMs);
  ensureResumed();
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = Math.min(0.35, 0.05 + intensity * 0.3);
  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(ctx.destination);

  // Transiente (ruído filtrado)
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = (surface === 'dice' ? 3800 : 2200) + Math.random() * 900;
  bp.Q.value = surface === 'dice' ? 6 : 2.5;
  const ng = ctx.createGain();
  const dec = surface === 'dice' ? 0.035 : 0.05 + intensity * 0.03;
  ng.gain.setValueAtTime(1, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + dec);
  src.connect(bp).connect(ng).connect(out);
  src.start(t);
  src.stop(t + dec + 0.01);

  // Corpo tonal curto (resina)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f = (surface === 'dice' ? 2600 : 900) + Math.random() * 300;
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.04);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.35, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + 0.05);
}
