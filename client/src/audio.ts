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
  element?.pause();
  pendingUrl = undefined;
}

// Le volume règle aussi un extrait en cours de lecture.
watch(
  () => useSettings().volume,
  (v) => {
    if (element) element.volume = v;
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
