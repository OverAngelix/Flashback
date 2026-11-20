import { computed, onScopeDispose, ref, watch } from "vue";
import { useGame } from "./useGame";

/** Durée pendant laquelle « Continuer » reste grisé à la révélation, le temps de lire le résultat. */
export const REVEAL_DELAY_MS = 3000;

/**
 * Partie hébergée : à chaque révélation, le bouton « Continuer » de l'écran hôte et du chef de partie
 * reste grisé quelques secondes, pour que tout le monde voie le résultat. Renvoie `true` quand on peut
 * continuer. Pas utilisé en solo, où le joueur avance à son rythme.
 */
export function useRevealDelay(delay = REVEAL_DELAY_MS) {
  const { view } = useGame();
  const ready = ref(true);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Une valeur par révélation (tour et joueur), null hors révélation. */
  const revealKey = computed(() => {
    const v = view.value;
    return v?.phase === "reveal" ? `${v.round}-${v.activePlayerId}` : null;
  });
  watch(
    revealKey,
    (key) => {
      clearTimeout(timer);
      ready.value = key === null;
      if (key !== null) timer = setTimeout(() => (ready.value = true), delay);
    },
    { immediate: true },
  );
  onScopeDispose(() => clearTimeout(timer));

  return ready;
}
