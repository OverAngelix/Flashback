import { reactive } from "vue";

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
