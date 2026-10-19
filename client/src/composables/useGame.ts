import { computed } from "vue";
import { useConnection } from "@/net/connection";

/** Raccourcis réactifs sur la vue de la partie. */
export function useGame() {
  const connection = useConnection();
  const view = computed(() => connection.state.view);
  const me = computed(() => view.value?.players.find((p) => p.id === connection.state.you) ?? null);
  const active = computed(() => view.value?.players.find((p) => p.id === view.value?.activePlayerId) ?? null);
  const isMyTurn = computed(() => !!me.value && me.value.id === active.value?.id);
  return { connection, view, me, active, isMyTurn };
}
