import { onUnmounted, watch, type Ref } from "vue";
import type { GameView } from "@server/net/protocol";
import { playVoice, stopVoice } from "@/audio";
import { lineUrl, pickLine, situationFor } from "@/commentator";

/**
 * Écran hôte : le commentateur réagit à chaque changement de phase (lancement, révélation,
 * récapitulatif, fin) si la salle l'a activé dans le salon. Jamais deux fois la même phrase de suite.
 */
export function useCommentator(view: Ref<GameView | null>) {
  const last = new Map<string, string>();
  let prev: GameView | null = null;

  watch(view, (v) => {
    const situation = v && v.commentator ? situationFor(prev, v) : null;
    prev = v;
    if (!situation) return;
    const line = pickLine(situation, last.get(situation) ?? null);
    if (!line) return;
    last.set(situation, line.id);
    playVoice(lineUrl(line));
  });

  onUnmounted(stopVoice);
}
