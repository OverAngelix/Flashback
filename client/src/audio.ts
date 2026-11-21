import { reactive, watch } from "vue";
import { useSettings } from "./settings";

/** Fichier WAV silencieux : le lire pendant un geste de l'utilisateur débloque l'audio du navigateur. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export const audio = reactive({
  /** Le navigateur a refusé la lecture : il faut un geste de l'utilisateur. */
  blocked: false,
  playing: false,
  /** Le commentateur est en train de parler. */
  speaking: false,
});

/** Volume de l'extrait pendant que le commentateur parle, par rapport au volume réglé. */
const DUCK = 0.3;

let element: HTMLAudioElement | undefined;
let voice: HTMLAudioElement | undefined;
let pendingUrl: string | undefined;
let fadeTimer: ReturnType<typeof setInterval> | undefined;

/** Volume de l'extrait : celui des réglages, baissé tant que le commentateur parle. */
const extractVolume = () => useSettings().volume * (audio.speaking ? DUCK : 1);

/** Arrête un fondu en cours et rend à l'élément le volume réglé. */
function cancelFade(): void {
  if (fadeTimer === undefined) return;
  clearInterval(fadeTimer);
  fadeTimer = undefined;
  if (element) element.volume = extractVolume();
}

function ensure(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.volume = extractVolume();
    element.addEventListener("playing", () => (audio.playing = true));
    element.addEventListener("pause", () => (audio.playing = false));
    element.addEventListener("ended", () => (audio.playing = false));
  }
  return element;
}

/** À appeler dans un gestionnaire de clic : l'élément audio reste ensuite utilisable sans geste. */
export function unlockAudio(): void {
  // La voix du commentateur a son propre élément : Safari demande de débloquer chacun.
  const v = ensureVoice();
  v.src = SILENT_WAV;
  v.play().catch(() => {});
  const el = ensure();
  el.src = SILENT_WAV;
  el.play().then(
    () => {
      audio.blocked = false;
      if (pendingUrl) playExtract(pendingUrl);
    },
    () => (audio.blocked = true),
  );
}

export function playExtract(url: string): void {
  cancelFade();
  const el = ensure();
  el.volume = extractVolume();
  pendingUrl = url;
  el.src = url;
  el.currentTime = 0;
  el.play().then(
    () => {
      audio.blocked = false;
      pendingUrl = undefined;
    },
    () => (audio.blocked = true),
  );
}

export function stopExtract(): void {
  cancelFade();
  element?.pause();
  pendingUrl = undefined;
}

/**
 * Baisse l'extrait jusqu'au silence en `ms` millisecondes, puis l'arrête. Sur iOS, où le volume
 * d'un élément audio ne se règle pas, l'arrêt arrive simplement à la fin du délai.
 */
export function fadeOutExtract(ms = 1000): void {
  pendingUrl = undefined;
  const el = element;
  if (!el || el.paused || fadeTimer !== undefined) return;
  const from = el.volume;
  const start = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    el.volume = from * (1 - k);
    if (k < 1) return;
    el.pause();
    cancelFade();
  }, 40);
}

// Le volume (et la voix du commentateur) règlent aussi un extrait en cours de lecture.
watch(extractVolume, (v) => {
  if (element && fadeTimer === undefined) element.volume = v;
});

function ensureVoice(): HTMLAudioElement {
  if (!voice) {
    voice = new Audio();
    const done = () => (audio.speaking = false);
    voice.addEventListener("ended", done);
    voice.addEventListener("error", done);
  }
  return voice;
}

/**
 * Le commentateur dit une phrase (sans rien afficher) ; l'extrait en cours baisse le temps
 * qu'il parle. Une nouvelle phrase coupe la précédente. Fichier absent ou lecture refusée : il se tait.
 */
export function playVoice(url: string): void {
  const v = ensureVoice();
  v.volume = useSettings().volume;
  v.src = url;
  audio.speaking = true;
  v.play().catch(() => (audio.speaking = false));
}

export function stopVoice(): void {
  voice?.pause();
  audio.speaking = false;
}

/** Un bip court au volume réglé, pour entendre le réglage sans lancer de partie. */
export function playTestTone(): void {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 523.25;
  gain.gain.setValueAtTime(Math.max(0.0001, useSettings().volume * 0.4), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  osc.onended = () => void ctx.close();
}
