import { reactive, watch } from "vue";
import { useSettings } from "./settings";

/** Fichier WAV silencieux : le lire pendant un geste de l'utilisateur débloque l'audio du navigateur. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export const audio = reactive({
  /** Le navigateur a refusé la lecture : il faut un geste de l'utilisateur. */
  blocked: false,
  playing: false,
});

let element: HTMLAudioElement | undefined;
let pendingUrl: string | undefined;
let fadeTimer: ReturnType<typeof setInterval> | undefined;

/** Arrête un fondu en cours et rend à l'élément le volume réglé. */
function cancelFade(): void {
  if (fadeTimer === undefined) return;
  clearInterval(fadeTimer);
  fadeTimer = undefined;
  if (element) element.volume = useSettings().volume;
}

function ensure(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.volume = useSettings().volume;
    element.addEventListener("playing", () => (audio.playing = true));
    element.addEventListener("pause", () => (audio.playing = false));
    element.addEventListener("ended", () => (audio.playing = false));
  }
  return element;
}

/** À appeler dans un gestionnaire de clic : l'élément audio reste ensuite utilisable sans geste. */
export function unlockAudio(): void {
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
  el.volume = useSettings().volume;
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

// Le volume règle aussi un extrait en cours de lecture.
watch(
  () => useSettings().volume,
  (v) => {
    if (element && fadeTimer === undefined) element.volume = v;
  },
);

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
