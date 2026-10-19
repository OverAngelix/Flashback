<script setup lang="ts">
import { computed } from "vue";
import type { GameView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";
import TrackCard from "./TrackCard.vue";

const props = defineProps<{ view: GameView; compact?: boolean }>();

const result = computed(() => props.view.lastResult);
const player = computed(() => props.view.players.find((p) => p.id === result.value?.playerId));
const skipped = computed(() => result.value?.position === -1);
</script>

<template>
  <div v-if="result && player" class="d-flex ga-6 align-center" :class="compact ? 'flex-row' : 'flex-column flex-md-row'">
    <TrackCard :card="result.track" big :highlight="result.correct" />
    <div class="d-flex flex-column ga-3 flex-grow-1 min-width-0">
      <div class="d-flex align-center ga-3">
        <AvatarBadge :avatar="player.avatar" :size="compact ? 40 : 64" />
        <div>
          <div :class="compact ? 'text-title-large' : 'text-headline-large'" :style="{ color: result.correct ? 'rgb(var(--v-theme-success))' : 'rgb(var(--v-theme-error))' }">
            <v-icon :icon="result.correct ? 'mdi-check-circle' : 'mdi-close-circle'" />
            {{ skipped ? "Tour passé" : result.correct ? "Bien joué !" : "Raté…" }}
          </div>
          <div class="text-medium-emphasis">{{ player.name }} · {{ result.track.year }}</div>
        </div>
      </div>
      <TimelineStrip :cards="player.timeline" :highlight-id="result.correct ? result.track.id : null" />
    </div>
  </div>
</template>
