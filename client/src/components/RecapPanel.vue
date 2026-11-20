<script setup lang="ts">
import { computed, ref } from "vue";
import type { GameView } from "@server/net/protocol";
import DiscoBall from "./DiscoBall.vue";
import AvatarBadge from "./AvatarBadge.vue";
import Confetti from "./Confetti.vue";
import TimelineStrip from "./TimelineStrip.vue";
import { useAutoScroll } from "@/composables/useAutoScroll";

/**
 * `viewerId` : sur un téléphone, seule la frise du spectateur est affichée (l'écran hôte montre tout).
 * `fill` : écran hôte, le panneau prend la hauteur laissée par son parent et les frises défilent
 * toutes seules si elles ne tiennent pas (personne ne fait défiler une télé).
 */
const props = defineProps<{ view: GameView; final?: boolean; viewerId?: string | null; fill?: boolean }>();

const list = ref<HTMLElement>();
if (props.fill) useAutoScroll(list);

const ranked = computed(() =>
  [...props.view.players]
    .filter((p) => !props.viewerId || p.id === props.viewerId)
    .sort((a, b) => b.timeline.length - a.timeline.length || b.groove - a.groove),
);
const winners = computed(() => props.view.players.filter((p) => props.view.winnerIds.includes(p.id)));
</script>

<template>
  <!-- Sur un téléphone (une seule frise), le récapitulatif est centré. -->
  <div class="recap" :class="{ solo: !!viewerId, fill }">
    <Confetti v-if="final && winners.length" :count="70" />
    <div v-if="final && winners.length" class="winner glass">
      <v-icon icon="mdi-trophy" size="56" color="warning" class="trophy" />
      <div class="display t-lg">
        {{ winners.length > 1 ? "Égalité : " : "Victoire de " }}<span class="grad-text">{{ winners.map((w) => w.name).join(", ") }}</span> !
      </div>
    </div>
    <div v-else class="display t-md">{{ viewerId ? "Ta frise" : "Frises" }} après le tour {{ view.round - 1 }}</div>

    <div ref="list" class="rows" data-testid="recap-rows">
      <div v-for="p in ranked" :key="p.id" class="row glass" :class="{ win: final && view.winnerIds.includes(p.id) }">
        <div class="who">
          <AvatarBadge :avatar="p.avatar" :size="44" :leader="p.id === view.leaderId" />
          <span class="display name">{{ p.name }}</span>
          <span class="chip display">{{ p.timeline.length }} carte{{ p.timeline.length > 1 ? "s" : "" }}</span>
          <span class="chip gv display" title="Points groove"><DiscoBall :size="18" class="mr-1" />{{ p.groove }} groove</span>
          <v-icon v-if="final && view.winnerIds.includes(p.id)" icon="mdi-trophy" color="warning" />
        </div>
        <TimelineStrip :cards="p.timeline" :centered="!!viewerId" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.recap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* Écran hôte : la liste occupe la place restante et défile (sans barre) ; fondu en haut et en bas. */
.fill {
  flex: 1;
  min-height: 0;
}
.fill .rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 14px 4px;
  margin: -14px -4px;
  mask-image: linear-gradient(to bottom, transparent, #000 14px, #000 calc(100% - 14px), transparent);
}
.fill .rows::-webkit-scrollbar {
  display: none;
}
.solo > .display,
.solo .who {
  justify-content: center;
  text-align: center;
}
.winner {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 26px;
  background: linear-gradient(135deg, rgba(255, 201, 77, 0.18), rgba(255, 61, 154, 0.16));
}
.trophy {
  animation: bounce 1.4s ease-in-out infinite;
}
.row {
  padding: 12px 14px 4px;
}
.row.win {
  box-shadow: 0 0 0 2px var(--gold), 0 12px 36px rgba(255, 201, 77, 0.2);
}
.who {
  display: flex;
  align-items: center;
  gap: 12px;
}
.name {
  font-size: 1.3rem;
}
.chip {
  padding: 2px 12px;
  border-radius: 999px;
  background: var(--glass-strong);
  font-size: 0.95rem;
}
.gv {
  display: inline-flex;
  align-items: center;
  color: var(--gold);
}
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-8px) rotate(6deg);
  }
}
</style>
