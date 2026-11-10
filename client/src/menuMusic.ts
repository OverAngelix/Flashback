/**
 * Musique de menu « d'ascenseur » : piano électrique, basse douce, balais et vibraphone, joués en
 * continu par l'API Web Audio d'après la partition de menuScore.ts. Aucun fichier audio : rien à
 * télécharger, aucun droit musical à gérer, et ça marche hors ligne.
 */
import { BAR_BEATS, BPM, composeBar, seeded, type NoteEvent } from "./menuScore";

const SEC_PER_BEAT = 60 / BPM;
const BAR_SEC = BAR_BEATS * SEC_PER_BEAT;
/** Les mesures sont planifiées un peu à l'avance pour que le son ne saute jamais. */
const LOOKAHEAD_SEC = 2.5;
const TICK_MS = 250;
const FADE_SEC = 0.9;

const mtof = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
/** Le volume réglé (0 à 1) devient un gain : courbe carrée, plus naturelle à l'oreille. */
const masterLevel = (volume: number): number => Math.min(1, Math.max(0, volume)) ** 2 * 0.9;

interface Rig {
  ctx: BaseAudioContext;
  master: GainNode;
  /** Entrée de toutes les voix : vers le signal direct et vers la réverbération. */
  bus: GainNode;
  noise: AudioBuffer;
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rng = seeded(1234);
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
  return buffer;
}

/** Réponse impulsionnelle d'une pièce douce : du bruit qui s'éteint en 2 secondes. */
function makeImpulse(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2.2);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    const rng = seeded(99 + c);
    for (let i = 0; i < length; i++) data[i] = (rng() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

export function buildRig(ctx: BaseAudioContext, volume: number): Rig {
  const master = ctx.createGain();
  master.gain.value = masterLevel(volume);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 24;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 7000;

  const bus = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx);
  const send = ctx.createGain();
  send.gain.value = 0.3;

  bus.connect(compressor);
  bus.connect(send).connect(reverb).connect(compressor);
  compressor.connect(tone).connect(master).connect(ctx.destination);

  return { ctx, master, bus, noise: makeNoise(ctx) };
}

/** Enveloppe : montée rapide puis extinction exponentielle. */
function envelope(g: GainNode, when: number, attack: number, peak: number, end: number): void {
  const floor = 0.0001;
  g.gain.setValueAtTime(floor, when);
  g.gain.linearRampToValueAtTime(Math.max(peak, floor), when + attack);
  g.gain.exponentialRampToValueAtTime(floor, Math.max(end, when + attack + 0.02));
}

function pan(ctx: BaseAudioContext, value: number): AudioNode | null {
  if (typeof ctx.createStereoPanner !== "function") return null;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, value));
  return p;
}

function tone(rig: Rig, type: OscillatorType, freq: number, when: number, stop: number, to: AudioNode, gain = 1, detune = 0): void {
  const osc = rig.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = rig.ctx.createGain();
  g.gain.value = gain;
  osc.connect(g).connect(to);
  osc.start(when);
  osc.stop(stop);
}

function playKeys(rig: Rig, ev: NoteEvent, when: number): void {
  const f = mtof(ev.midi!);
  const end = when + ev.dur * SEC_PER_BEAT + 0.8;
  const g = rig.ctx.createGain();
  envelope(g, when, 0.008, ev.vel * 0.11, end);
  const lp = rig.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500 + ev.vel * 2500;
  const p = pan(rig.ctx, (ev.midi! - 65) / 30);
  g.connect(lp);
  if (p) lp.connect(p).connect(rig.bus);
  else lp.connect(rig.bus);
  // Un son de piano électrique : un fondamental, une copie légèrement désaccordée et une pointe aiguë.
  tone(rig, "sine", f, when, end + 0.05, g);
  tone(rig, "triangle", f, when, end + 0.05, g, 0.5, 4);
  tone(rig, "sine", f * 2, when, end + 0.05, g, 0.12);
}

function playBass(rig: Rig, ev: NoteEvent, when: number): void {
  const f = mtof(ev.midi!);
  const end = when + ev.dur * SEC_PER_BEAT + 0.25;
  const g = rig.ctx.createGain();
  envelope(g, when, 0.012, ev.vel * 0.26, end);
  const lp = rig.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  g.connect(lp).connect(rig.bus);
  tone(rig, "sine", f, when, end + 0.05, g);
  tone(rig, "triangle", f, when, end + 0.05, g, 0.3);
}

function playBell(rig: Rig, ev: NoteEvent, when: number): void {
  const f = mtof(ev.midi!);
  const end = when + ev.dur * SEC_PER_BEAT + 1;
  const g = rig.ctx.createGain();
  envelope(g, when, 0.003, ev.vel * 0.09, end);
  const p = pan(rig.ctx, ev.midi! % 2 === 0 ? -0.35 : 0.35);
  if (p) g.connect(p).connect(rig.bus);
  else g.connect(rig.bus);
  tone(rig, "sine", f, when, end + 0.05, g);
  tone(rig, "sine", f * 2.756, when, end + 0.05, g, 0.18);
}

function playNoise(rig: Rig, ev: NoteEvent, when: number, filter: BiquadFilterType, freq: number, q: number, level: number, length: number): void {
  const src = rig.ctx.createBufferSource();
  src.buffer = rig.noise;
  const f = rig.ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = rig.ctx.createGain();
  envelope(g, when, 0.004, ev.vel * level, when + length);
  src.connect(f).connect(g).connect(rig.bus);
  src.start(when, (when * 7) % 0.8);
  src.stop(when + length + 0.05);
}

function scheduleEvent(rig: Rig, ev: NoteEvent, barStart: number): void {
  const when = barStart + ev.beat * SEC_PER_BEAT;
  switch (ev.voice) {
    case "keys":
      return playKeys(rig, ev, when);
    case "bass":
      return playBass(rig, ev, when);
    case "bell":
      return playBell(rig, ev, when);
    case "hat":
      return playNoise(rig, ev, when, "highpass", 7500, 0.7, 0.05, 0.05);
    case "brush":
      return playNoise(rig, ev, when, "bandpass", 2800, 0.8, 0.07, 0.16);
  }
}

export function scheduleBar(rig: Rig, bar: number, barStart: number, rng: () => number): void {
  for (const ev of composeBar(bar, rng)) scheduleEvent(rig, ev, barStart);
}

export interface RenderStats {
  seconds: number;
  /** Niveau efficace moyen (0 à 1), sur la partie jouée. */
  rms: number;
  /** Plus grande valeur absolue : au-delà de 1, le son sature. */
  peak: number;
  /** Part des fenêtres de 50 ms qui ne sont pas silencieuses. */
  audibleRatio: number;
}

/** Rend `bars` mesures sans rien jouer, et mesure le résultat : sert à vérifier le son sans l'écouter. */
export async function renderOffline(bars = 8, volume = 1, seed = 7): Promise<RenderStats> {
  const sampleRate = 44100;
  const music = bars * BAR_SEC;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * (music + 1.5)), sampleRate);
  const rig = buildRig(ctx, volume);
  const rng = seeded(seed);
  for (let b = 0; b < bars; b++) scheduleBar(rig, b, 0.1 + b * BAR_SEC, rng);
  const buffer = await ctx.startRendering();

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const playedFrames = Math.floor(sampleRate * (0.1 + music));
  const window = Math.floor(sampleRate * 0.05);
  let sum = 0;
  let peak = 0;
  let windows = 0;
  let audible = 0;
  for (let start = 0; start + window <= playedFrames; start += window) {
    let ws = 0;
    for (let i = start; i < start + window; i++) {
      const v = (left[i]! + right[i]!) / 2;
      ws += v * v;
      peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
    }
    sum += ws;
    windows++;
    if (Math.sqrt(ws / window) > 0.0008) audible++;
  }
  return { seconds: buffer.duration, rms: Math.sqrt(sum / (windows * window)), peak, audibleRatio: audible / windows };
}

type AudioCtor = typeof AudioContext;
const audioCtor = (): AudioCtor | undefined =>
  typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);

export class MenuMusic {
  private ctx?: AudioContext;
  private rig?: Rig;
  private timer?: ReturnType<typeof setInterval>;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private stopGesture?: () => void;
  private bar = 0;
  private nextBar = 0;
  private rng = seeded(Date.now() & 0xffff);
  private fading = false;

  constructor() {
    // Un onglet en arrière-plan ne doit pas continuer à jouer.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx || this.fading) return;
        if (document.visibilityState === "hidden") void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
  }

  /** La musique est lancée (même si le navigateur attend encore un geste de l'utilisateur). */
  get playing(): boolean {
    return !!this.ctx && !this.fading;
  }

  state(): { playing: boolean; ctxState: string; bar: number } {
    return { playing: this.playing, ctxState: this.ctx?.state ?? "none", bar: this.bar };
  }

  /**
   * Lance la musique. Les navigateurs interdisent le son avant un premier geste : elle démarre alors
   * au premier toucher ou à la première touche.
   */
  start(volume: number): void {
    if (this.ctx) {
      if (this.fading) this.cancelFade();
      this.setVolume(volume);
      return;
    }
    const Ctor = audioCtor();
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.rig = buildRig(ctx, volume);
    this.bar = 0;
    this.nextBar = ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.armGesture(ctx);
  }

  setVolume(volume: number): void {
    if (this.rig && !this.fading) this.rig.master.gain.setTargetAtTime(masterLevel(volume), this.rig.ctx.currentTime, 0.05);
  }

  /** Coupe la musique avec un fondu, puis libère le contexte audio. */
  stop(fadeSec = FADE_SEC): void {
    const ctx = this.ctx;
    if (!ctx || this.fading) return;
    this.fading = true;
    this.stopGesture?.();
    this.rig?.master.gain.setTargetAtTime(0, ctx.currentTime, fadeSec / 4);
    this.closeTimer = setTimeout(() => {
      clearInterval(this.timer);
      void ctx.close();
      this.ctx = undefined;
      this.rig = undefined;
      this.fading = false;
    }, fadeSec * 1000 + 150);
  }

  private cancelFade(): void {
    clearTimeout(this.closeTimer);
    this.fading = false;
    if (this.ctx) this.armGesture(this.ctx);
  }

  private tick(): void {
    const { ctx, rig } = this;
    if (!ctx || !rig || this.fading) return;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleBar(rig, this.bar, this.nextBar, this.rng);
      this.bar++;
      this.nextBar += BAR_SEC;
    }
  }

  private armGesture(ctx: AudioContext): void {
    this.stopGesture?.();
    if (ctx.state === "running") return;
    const resume = () => {
      void ctx.resume();
      this.stopGesture?.();
    };
    const events = ["pointerdown", "keydown", "touchend"] as const;
    for (const e of events) window.addEventListener(e, resume, { passive: true });
    this.stopGesture = () => {
      for (const e of events) window.removeEventListener(e, resume);
      this.stopGesture = undefined;
    };
  }
}

export const menuMusic = new MenuMusic();

// Point d'entrée des tests de bout en bout (navigateur piloté uniquement) : mesurer le son sans l'écouter.
if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.webdriver) {
  (window as unknown as { __menuMusic: unknown }).__menuMusic = { renderOffline, state: () => menuMusic.state() };
}
