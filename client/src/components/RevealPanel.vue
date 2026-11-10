<script setup lang="ts">
import { computed } from "vue";
import type { GameView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";
import TrackCard from "./TrackCard.vue";

/** `viewerId` : sur un téléphone, on montre la frise du spectateur (l'écran hôte montre celle du joueur). */
const props = defineProps<{ view: GameView; compact?: boolean; viewerId?: string | null; note?: string }>();

const result = computed(() => props.view.lastResult);
const player = computed(() => props.view.players.find((p) => p.id === result.value?.playerId));
const skipped = computed(() => result.value?.position === -1);
const shown = computed(() => props.view.players.find((p) => p.id === props.viewerId) ?? player.value);
const ownStrip = computed(() => !!shown.value && shown.value.id !== player.value?.id);
</script>

<template>
  <div v-if="result && player" class="d-flex ga-6 align-center" :class="compact ? 'flex-row' : 'flex-column flex-md-row'">
    <TrackCard :card="result.track" big :highlight="result.correct" />
    <div class="d-flex flex-column flex-grow-1 min-width-0" :class="compact ? 'ga-1' : 'ga-3'">
      <div class="d-flex align-center ga-3">
        <AvatarBadge :avatar="player.avatar" :size="compact ? 36 : 64" />
        <div>
          <div :class="compact ? 'text-title-large' : 'text-headline-large'" :style="{ color: result.correct ? 'rgb(var(--v-theme-success))' : 'rgb(var(--v-theme-error))' }">
            <v-icon :icon="result.correct ? 'mdi-check-circle' : 'mdi-close-circle'" />
            {{ skipped ? "Tour passé" : result.correct ? "Bien joué !" : "Raté…" }}
          </div>
          <div class="text-medium-emphasis">{{ player.name }} · {{ result.track.year }}</div>
        </div>
        <div v-if="note" class="ml-auto text-label-large text-medium-emphasis">{{ note }}</div>
      </div>
      <div v-if="ownStrip" class="text-label-large text-medium-emphasis">Ta frise</div>
      <TimelineStrip v-if="shown" :cards="shown.timeline" :highlight-id="result.correct && shown.id === player.id ? result.track.id : null" />
    </div>
  </div>
</template>
