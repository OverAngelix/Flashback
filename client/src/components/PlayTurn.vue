<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlayerView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";
import { useConnection } from "@/net/connection";

const props = defineProps<{ me: PlayerView; listened: boolean }>();
const connection = useConnection();
const selected = ref<number | null>(null);

const hint = computed(() => {
  if (!props.listened) return "Une seule écoute : écoute bien !";
  if (selected.value === null) return "Touche un emplacement de ta frise.";
  return "Valide ton choix.";
});

function place() {
  if (selected.value === null) return;
  connection.send({ type: "player:place", position: selected.value });
  selected.value = null;
}
</script>

<template>
  <div class="turn">
    <!-- Les deux boutons sont dans la colonne de gauche : toujours visibles, même sur un écran peu haut. -->
    <div class="side">
      <div class="d-flex align-center ga-2">
        <AvatarBadge :avatar="me.avatar" :size="36" />
        <span class="text-title-small font-weight-bold">À toi de jouer !</span>
      </div>
      <v-btn color="primary" size="large" class="w-100" :prepend-icon="listened ? 'mdi-check' : 'mdi-play'" :disabled="listened" data-testid="play-extract" @click="connection.send({ type: 'player:play' })">
        {{ listened ? "Écouté" : "Écouter" }}
      </v-btn>
      <div class="text-label-large text-medium-emphasis text-center">{{ hint }}</div>
      <v-btn color="success" size="large" class="w-100" :disabled="selected === null" prepend-icon="mdi-check" data-testid="place" @click="place">Placer ici</v-btn>
    </div>
    <div class="main">
      <TimelineStrip :cards="me.timeline" interactive :selected="selected" class="w-100" @select="selected = $event" />
    </div>
  </div>
</template>

<style scoped>
.turn {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  height: 100dvh;
  overflow: hidden;
}
.side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  width: 168px;
  flex-shrink: 0;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
