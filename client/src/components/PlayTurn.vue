<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlayerView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import Equalizer from "./Equalizer.vue";
import TimelineStrip from "./TimelineStrip.vue";
import { useConnection } from "@/net/connection";

const props = defineProps<{ me: PlayerView; listened: boolean; leader?: boolean }>();
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
      <div class="me">
        <AvatarBadge :avatar="me.avatar" :size="34" :leader="leader" />
        <span class="display">À toi de jouer !</span>
      </div>
      <div class="listen">
        <button type="button" class="play" :class="{ done: listened }" :disabled="listened" data-testid="play-extract" aria-label="Écouter l'extrait" @click="connection.send({ type: 'player:play' })">
          <v-icon :icon="listened ? 'mdi-check' : 'mdi-play'" size="34" />
        </button>
        <div class="listen-text">
          <span class="display">{{ listened ? "Écouté" : "Écouter" }}</span>
          <Equalizer :active="listened" :bars="4" />
        </div>
      </div>
      <div class="hint muted">{{ hint }}</div>
      <v-btn class="btn-success w-100" :disabled="selected === null" prepend-icon="mdi-check" data-testid="place" @click="place">Placer ici</v-btn>
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
  width: 176px;
  flex-shrink: 0;
}
.me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
}
.listen {
  display: flex;
  align-items: center;
  gap: 12px;
}
.listen-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 1.1rem;
}
.play {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--grad);
  box-shadow: 0 8px 26px rgba(255, 61, 154, 0.5), 0 0 0 6px rgba(255, 61, 154, 0.18);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.play:active:not(:disabled) {
  transform: scale(0.94);
}
.play.done {
  background: var(--glass-strong);
  box-shadow: none;
  color: var(--green);
}
.hint {
  min-height: 2.4em;
  font-size: 0.85rem;
  line-height: 1.2;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
