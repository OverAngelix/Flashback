<script setup lang="ts">
import type { PlayerView } from "@server/net/protocol";
import DiscoBall from "./DiscoBall.vue";
import AvatarBadge from "./AvatarBadge.vue";

/** `noCount` : sans le nombre de cartes (salon, avant la distribution) ; `groove` : affiche les points groove ; `guessedIds` : joueurs qui ont déjà placé le titre en cours. */
defineProps<{
  players: PlayerView[];
  activeId?: string | null;
  leaderId?: string | null;
  compact?: boolean;
  noCount?: boolean;
  groove?: boolean;
  guessedIds?: string[];
}>();
</script>

<!-- Les joueurs avec leur nombre de cartes ; le joueur actif est mis en lumière. -->
<template>
  <div class="bar">
    <div v-for="p in players" :key="p.id" class="pill glass" :class="{ active: p.id === activeId, off: !p.connected, compact }">
      <AvatarBadge :avatar="p.avatar" :size="compact ? 28 : 40" :leader="p.id === leaderId" />
      <span class="name text-truncate">{{ p.name }}</span>
      <span v-if="!noCount" class="count display" title="Cartes">{{ p.timeline.length }}</span>
      <span v-if="groove" class="gv display" title="Points groove"><DiscoBall :size="18" class="mr-1" />{{ p.groove }}</span>
      <v-icon v-if="guessedIds?.includes(p.id)" icon="mdi-check-decagram" color="success" size="small" title="A placé le titre" data-testid="guessed" />
      <v-icon v-if="!p.connected" icon="mdi-wifi-off" size="small" title="Déconnecté" />
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pill {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 240px;
  padding: 6px 14px 6px 8px;
  border-radius: 999px;
  transition: all 0.25s ease;
}
.pill.compact {
  padding: 4px 10px 4px 6px;
  gap: 6px;
  font-size: 0.85rem;
}
.name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.05rem;
}
.compact .name {
  font-size: 0.9rem;
}
.count {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--glass-strong);
  font-size: 1rem;
}
.gv {
  display: flex;
  align-items: center;
  font-size: 1rem;
  color: var(--gold);
}
.pill.active {
  border-color: transparent;
  background: linear-gradient(135deg, rgba(255, 61, 154, 0.35), rgba(124, 92, 255, 0.35));
  box-shadow: 0 0 0 2px var(--pink), 0 8px 26px rgba(255, 61, 154, 0.35);
  transform: scale(1.04);
}
.pill.off {
  opacity: 0.5;
}
</style>
