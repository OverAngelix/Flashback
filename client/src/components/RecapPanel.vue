<script setup lang="ts">
import { computed } from "vue";
import type { GameView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";

/** `viewerId` : sur un téléphone, seule la frise du spectateur est affichée (l'écran hôte montre tout). */
const props = defineProps<{ view: GameView; final?: boolean; viewerId?: string | null }>();

const ranked = computed(() =>
  [...props.view.players]
    .filter((p) => !props.viewerId || p.id === props.viewerId)
    .sort((a, b) => b.timeline.length - a.timeline.length),
);
const winners = computed(() => props.view.players.filter((p) => props.view.winnerIds.includes(p.id)));
</script>

<template>
  <div class="d-flex flex-column ga-4">
    <v-alert v-if="final && winners.length" type="success" variant="tonal" icon="mdi-trophy" class="text-headline-small">
      {{ winners.length > 1 ? "Égalité : " : "Victoire de " }}{{ winners.map((w) => w.name).join(", ") }} !
    </v-alert>
    <div v-else class="text-headline-small">{{ viewerId ? "Ta frise" : "Frises" }} après le tour {{ view.round - 1 }}</div>
    <v-sheet v-for="p in ranked" :key="p.id" rounded="lg" class="pa-3">
      <div class="d-flex align-center ga-3">
        <AvatarBadge :avatar="p.avatar" :size="40" />
        <span class="text-title-large">{{ p.name }}</span>
        <v-chip size="small" color="primary">{{ p.timeline.length }} cartes</v-chip>
        <v-icon v-if="final && view.winnerIds.includes(p.id)" icon="mdi-trophy" color="warning" />
      </div>
      <TimelineStrip :cards="p.timeline" />
    </v-sheet>
  </div>
</template>
