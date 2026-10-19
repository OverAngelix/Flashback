<script setup lang="ts">
import { ref } from "vue";
import type { PlayerView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";
import { useConnection } from "@/net/connection";

defineProps<{ me: PlayerView }>();
const connection = useConnection();
const selected = ref<number | null>(null);

function place() {
  if (selected.value === null) return;
  connection.send({ type: "player:place", position: selected.value });
  selected.value = null;
}
</script>

<template>
  <div class="turn d-flex ga-4 pa-3">
    <div class="side d-flex flex-column ga-3 align-center justify-center">
      <AvatarBadge :avatar="me.avatar" :size="56" />
      <div class="text-title-medium font-weight-bold text-center">C'est ton tour !</div>
      <v-btn color="primary" size="large" class="w-100" prepend-icon="mdi-play" data-testid="play-extract" @click="connection.send({ type: 'player:play' })">Écouter</v-btn>
      <div class="text-body-small text-center text-medium-emphasis">Le son sort de l'écran.</div>
    </div>
    <div class="main d-flex flex-column ga-2">
      <div class="text-title-small text-medium-emphasis">Touche l'emplacement où placer le titre, fais glisser pour voir toute ta frise.</div>
      <TimelineStrip :cards="me.timeline" interactive :selected="selected" class="flex-grow-1" @select="selected = $event" />
      <v-btn color="success" size="large" :disabled="selected === null" prepend-icon="mdi-check" data-testid="place" @click="place">Placer ici</v-btn>
    </div>
  </div>
</template>

<style scoped>
.turn {
  min-height: 100dvh;
}
.side {
  width: 170px;
  flex-shrink: 0;
}
.main {
  flex: 1;
  min-width: 0;
  justify-content: center;
}
</style>
