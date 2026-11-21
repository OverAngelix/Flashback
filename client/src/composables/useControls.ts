import { computed } from "vue";
import { MIN_PLAYERS } from "@server/game/types";
import { useGame } from "./useGame";

/**
 * Commandes de la partie : catégories (aucune cochée = tout le catalogue), objectif, commentateur, lancement, suite, tour passé, nouvelle partie. Elles sont partagées par
 * l'écran hôte et par le téléphone du chef de partie (le serveur accepte les mêmes messages des deux).
 */
export function useControls() {
  const { connection, view, me } = useGame();

  const chosen = computed(() => new Set(view.value?.categories ?? []));
  const isLeader = computed(() => !!me.value && view.value?.leaderId === me.value.id);
  const leader = computed(() => view.value?.players.find((p) => p.id === view.value?.leaderId) ?? null);

  const playerCount = computed(() => view.value?.players.length ?? 0);
  const enoughPlayers = computed(() => playerCount.value >= MIN_PLAYERS);
  /** Une carte de départ par joueur, plus au moins une à placer (même règle que Game.start). */
  const enoughTracks = computed(() => (view.value?.trackCount ?? 0) >= playerCount.value + 1);
  const canStart = computed(() => enoughPlayers.value && enoughTracks.value);
  /** Pourquoi on ne peut pas encore lancer ; null quand tout est prêt. */
  const startBlocker = computed(() => {
    if (!enoughPlayers.value) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
    if (!enoughTracks.value) return "Pas assez de titres pour cette sélection : décochez une catégorie.";
    return null;
  });

  function toggleCategory(id: string) {
    const next = new Set(chosen.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    connection.send({ type: "host:setCategories", categories: [...next] });
  }
  const clearCategories = () => connection.send({ type: "host:setCategories", categories: [] });
  const setCardsToWin = (cardsToWin: number) => connection.send({ type: "host:setCardsToWin", cardsToWin });
  const setCommentator = (enabled: boolean) => connection.send({ type: "host:setCommentator", enabled });
  const start = () => connection.send({ type: "host:start" });
  /** `from` rend un double clic (ou Entrée sur le bouton) inoffensif : le serveur ignore le second. */
  function advance() {
    const phase = view.value?.phase;
    if (phase === "reveal" || phase === "round-recap") connection.send({ type: "host:advance", from: phase });
  }
  const skipTurn = () => connection.send({ type: "host:skipTurn" });
  const kick = (playerId: string) => connection.send({ type: "host:kick", playerId });
  /** Partie terminée : retour au salon de la même salle, avec les mêmes joueurs. */
  const replay = () => connection.send({ type: "host:replay" });

  return { chosen, isLeader, leader, canStart, startBlocker, toggleCategory, clearCategories, setCardsToWin, setCommentator, start, advance, skipTurn, kick, replay };
}
