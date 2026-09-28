import { getDiceDramaConfig, normalizeDiceDrama } from "@/components/dice-physics/dramaConfig";

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
    // Envelope por blocos: evita milhões de Math.pow no primeiro impacto.
    const block = 256;
    for (let i = 0; i < length; i += block) {
      const env = Math.pow(1 - i / length, decay);
      const end = Math.min(length, i + block);
      for (let j = i; j < end; j++) data[j] = (Math.random() * 2 - 1) * env;
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

// ── Impacto 3D dos dados: gravações reais (Kenney, CC0) disparadas por colisões da física ──
const DICE_HITS = [0, 1, 2, 3, 4, 5].map((n) => `dice/hit-${n}.mp3`);
let diceHitsRequested = false;
let recentHits: number[] = [];
let lastHitIdx = -1;

/** Toca uma batida real de dado. intensity 0..1 (velocidade do impacto); surface: mesa ou outro dado. */
const dramaReverbs: Partial<Record<number, GainNode>> = {};
/** Cadeia de "copo": abafa, ressoa e reverbera conforme o drama (1..3). Reutilizada entre batidas. */
function getDramaChain(ctx: AudioContext, drama: number): AudioNode {
  const key = drama;
  const cached = dramaReverbs[key];
  if (cached) return cached;
  const config = getDiceDramaConfig(drama);
  const input = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = config.lowpassHz;
  lp.Q.value = 1.8 + drama * 1.4;
  const cup = ctx.createBiquadFilter();
  cup.type = 'peaking';
  cup.frequency.value = [900, 1_050, 760, 540][drama];
  cup.Q.value = 4 + drama;
  cup.gain.value = config.resonanceGain;
  const dry = ctx.createGain();
  dry.gain.value = Math.max(0.4, 0.92 - drama * 0.14);
  const rev = createCaveReverb(ctx, 0.7 + drama * 0.75, 2.8 + drama * 0.35);
  const wet = ctx.createGain();
  wet.gain.value = config.reverbWet;
  input.connect(cup).connect(lp);
  lp.connect(dry).connect(ctx.destination);
  lp.connect(rev).connect(wet).connect(ctx.destination);
  dramaReverbs[key] = input;
  return input;
}

/** Prepara amostras e reverberação antes do lançamento para não travar no primeiro impacto. */
export function prewarmDiceAudio(drama = 0) {
  if (!diceHitsRequested) { diceHitsRequested = true; DICE_HITS.forEach(preloadSound); }
  const d = normalizeDiceDrama(drama);
  if (d > 0) { try { getDramaChain(getCtx(), d); } catch {} }
}

export function playDiceHit(intensity: number, surface: 'tray' | 'dice' = 'tray', drama = 0) {
  if (!diceHitsRequested) { diceHitsRequested = true; DICE_HITS.forEach(preloadSound); }
  if (intensity < 0.04) return;
  const nowMs = performance.now();
  recentHits = recentHits.filter((t) => nowMs - t < 80);
  if (recentHits.length >= 5) return;
  const loaded = DICE_HITS.filter((f) => bufferCache[f]);
  if (loaded.length === 0) return;
  recentHits.push(nowMs);
  ensureResumed();
  const ctx = getCtx();
  let idx = Math.floor(Math.random() * loaded.length);
  if (loaded.length > 1 && idx === lastHitIdx) idx = (idx + 1) % loaded.length;
  lastHitIdx = idx;
  const src = ctx.createBufferSource();
  src.buffer = bufferCache[loaded[idx]];
  const d = normalizeDiceDrama(drama);
  const config = getDiceDramaConfig(d);
  src.playbackRate.value = ((surface === 'dice' ? 1.12 : 0.95) + (Math.random() - 0.5) * 0.1) * config.impactPitch;
  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, (0.08 + Math.pow(intensity, 0.78) * 0.72) * config.impactGain);
  src.connect(gain).connect(d > 0 ? getDramaChain(ctx, d) : ctx.destination);
  src.start(0);
}

if (typeof window !== 'undefined') {
  const warm = () => { if (!diceHitsRequested) { diceHitsRequested = true; DICE_HITS.forEach(preloadSound); } window.removeEventListener('pointerdown', warm); };
  window.addEventListener('pointerdown', warm);
}
