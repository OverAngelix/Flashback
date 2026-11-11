import { computed } from "vue";
import { MIN_PLAYERS } from "@server/game/types";
import { useGame } from "./useGame";

/**
 * Commandes de la partie : catégories, objectif, lancement, suite, tour passé. Elles sont partagées par
 * l'écran hôte et par le téléphone du chef de partie (le serveur accepte les mêmes messages des deux).
 */
export function useControls() {
  const { connection, view, me } = useGame();

  const chosen = computed(() => new Set(view.value?.categories ?? []));
  const isLeader = computed(() => !!me.value && view.value?.leaderId === me.value.id);
  const leader = computed(() => view.value?.players.find((p) => p.id === view.value?.leaderId) ?? null);

  const enoughPlayers = computed(() => (view.value?.players.length ?? 0) >= MIN_PLAYERS);
  const canStart = computed(() => enoughPlayers.value && chosen.value.size > 0);
  /** Pourquoi on ne peut pas encore lancer ; null quand tout est prêt. */
  const startBlocker = computed(() => {
    if (!enoughPlayers.value) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
    if (chosen.value.size === 0) return "Choisissez au moins une catégorie.";
    return null;
  });

  function toggleCategory(id: string) {
    const next = new Set(chosen.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    connection.send({ type: "host:setCategories", categories: [...next] });
  }
  const setCardsToWin = (cardsToWin: number) => connection.send({ type: "host:setCardsToWin", cardsToWin });
  const start = () => connection.send({ type: "host:start" });
  /** `from` rend un double clic (ou Entrée sur le bouton) inoffensif : le serveur ignore le second. */
  function advance() {
    const phase = view.value?.phase;
    if (phase === "reveal" || phase === "round-recap") connection.send({ type: "host:advance", from: phase });
  }
  const skipTurn = () => connection.send({ type: "host:skipTurn" });
  const kick = (playerId: string) => connection.send({ type: "host:kick", playerId });

  return { chosen, isLeader, leader, canStart, startBlocker, toggleCategory, setCardsToWin, start, advance, skipTurn, kick };
}
