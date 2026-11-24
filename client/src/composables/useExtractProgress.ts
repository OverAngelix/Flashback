import { computed, onUnmounted, ref, watch } from "vue";
import { audio } from "@/audio";
import { extractClock } from "@/extractClock";
import { useGame } from "./useGame";

/**
 * Où en est l'extrait du tour, pour l'anneau et le chrono d'une manette.
 * - En solo, l'appareil joue lui-même l'extrait : on lit l'élément audio (`audio`).
 * - À plusieurs, c'est l'écran hôte qui le joue : le serveur relaie sa position (`GameView.extract`),
 *   et le téléphone avance seul à partir de l'arrivée de la vue tant que l'extrait joue.
 *
 * `progress` : 0 avant l'écoute, null pendant le chargement (anneau qui tourne), puis de 0 à 1.
 * `remaining` : secondes restantes tant que l'extrait joue, sinon null.
 */
export function useExtractProgress() {
  const { view } = useGame();
  const solo = computed(() => !!view.value?.solo);

  // Heure d'arrivée de la dernière vue : chaque vue porte la position à l'instant de son envoi.
  const receivedAt = ref(0);
  const now = ref(0);
  let frame: number | undefined;
  const loop = () => {
    now.value = performance.now();
    frame = view.value?.extract?.playing ? requestAnimationFrame(loop) : undefined;
  };
  watch(
    () => view.value?.extract,
    (extract) => {
      receivedAt.value = now.value = performance.now();
      if (extract?.playing && frame === undefined) frame = requestAnimationFrame(loop);
    },
    { immediate: true },
  );
  onUnmounted(() => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  });

  const state = computed(() => {
    const v = view.value;
    if (!v?.listened) return { loading: false, playing: false, position: 0, duration: 0 };
    if (solo.value) return { loading: audio.loading, playing: audio.playing && !audio.loading, position: audio.position, duration: audio.duration };
    const e = v.extract;
    // Pas encore lancé, ou arrêté avant la fin (l'écran attend le réseau) : chargement.
    if (!e || (!e.playing && e.position < e.duration - 0.5)) return { loading: true, playing: false, position: 0, duration: 0 };
    const position = e.playing ? e.position + (now.value - receivedAt.value) / 1000 : e.position;
    return { loading: false, playing: e.playing && position < e.duration, position, duration: e.duration };
  });

  const clock = computed(() => extractClock(state.value.position, state.value.duration));
  const progress = computed(() => (state.value.loading ? null : clock.value.progress));
  const remaining = computed(() => (state.value.playing ? clock.value.remaining : null));
  const loading = computed(() => state.value.loading);
  return { progress, remaining, loading };
}
