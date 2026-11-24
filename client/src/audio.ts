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
  /** Un extrait est demandé mais pas encore audible (chargement ou mise en mémoire tampon). */
  loading: false,
  /** Position (s) et durée (s, 0 tant qu'elle est inconnue) de l'extrait en cours : voir `extractClock`. */
  position: 0,
  duration: 0,
});

/** Volume de l'extrait pendant que le commentateur parle, par rapport au volume réglé. */
const DUCK = 0.3;

let element: HTMLAudioElement | undefined;
let voice: HTMLAudioElement | undefined;
let pendingUrl: string | undefined;
let fadeTimer: ReturnType<typeof setInterval> | undefined;
/** L'élément joue un extrait (et pas le son silencieux de `unlockAudio`) : seul cas suivi par l'horloge. */
let isExtract = false;
let clockFrame: number | undefined;

/** Recopie la position de lecture à chaque image, pour un anneau de progression fluide. */
function tick(): void {
  clockFrame = undefined;
  if (!element || !isExtract) return;
  audio.position = element.currentTime;
  if (!element.paused && !element.ended) clockFrame = requestAnimationFrame(tick);
}

function readDuration(): void {
  if (element && isExtract && Number.isFinite(element.duration)) audio.duration = element.duration;
}

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
    const el = element;
    el.addEventListener("playing", () => {
      audio.playing = true;
      audio.loading = false;
      if (isExtract && clockFrame === undefined) clockFrame = requestAnimationFrame(tick);
    });
    el.addEventListener("pause", () => {
      audio.playing = false;
      audio.loading = false;
    });
    el.addEventListener("ended", () => {
      audio.playing = false;
      audio.loading = false;
      if (isExtract) audio.position = audio.duration || el.currentTime;
    });
    el.addEventListener("waiting", () => {
      if (isExtract && !el.paused) audio.loading = true;
    });
    el.addEventListener("error", () => (audio.loading = false));
    el.addEventListener("loadedmetadata", readDuration);
    el.addEventListener("durationchange", readDuration);
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
  isExtract = false;
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
  isExtract = true;
  audio.loading = true;
  audio.position = 0;
  audio.duration = 0;
  el.src = url;
  el.currentTime = 0;
  el.play().then(
    () => {
      audio.blocked = false;
      pendingUrl = undefined;
    },
    () => {
      audio.blocked = true;
      audio.loading = false;
    },
  );
}

/** Position et durée (s) lues directement sur l'élément, pour les relayer aux téléphones. */
export function extractSnapshot(): { position: number; duration: number } {
  const el = element;
  if (!el || !isExtract) return { position: 0, duration: 0 };
  return { position: el.currentTime || 0, duration: Number.isFinite(el.duration) ? el.duration : 0 };
}

export function stopExtract(): void {
  cancelFade();
  element?.pause();
  pendingUrl = undefined;
  audio.loading = false;
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
