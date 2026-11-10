<script setup lang="ts">
import { computed } from "vue";
import type { GameView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";
import Confetti from "./Confetti.vue";
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
  <div v-if="result && player" class="reveal" :class="{ compact, wrong: !result.correct }">
    <Confetti v-if="result.correct && !compact" />
    <div class="card-wrap"><TrackCard :card="result.track" big :highlight="result.correct" /></div>
    <div class="side">
      <div class="head">
        <AvatarBadge :avatar="player.avatar" :size="compact ? 34 : 64" />
        <div class="min-width-0">
          <div class="verdict display" :class="result.correct ? 'ok' : 'ko'">
            <v-icon :icon="result.correct ? 'mdi-check-circle' : skipped ? 'mdi-skip-next-circle' : 'mdi-close-circle'" />
            {{ skipped ? "Tour passé" : result.correct ? "Bien joué !" : "Raté…" }}
          </div>
          <div class="muted who text-truncate">{{ player.name }} · {{ result.track.year }}</div>
        </div>
        <div v-if="note" class="ml-auto muted note">{{ note }}</div>
        <div class="ml-auto"><slot name="action" /></div>
      </div>
      <div v-if="ownStrip" class="muted own">Ta frise</div>
      <TimelineStrip v-if="shown" :cards="shown.timeline" :highlight-id="result.correct && shown.id === player.id ? result.track.id : null" />
    </div>
  </div>
</template>

<style scoped>
.reveal {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
}
.reveal.compact {
  flex-wrap: nowrap;
  gap: 14px;
}
.reveal.wrong .card-wrap {
  animation: shake 0.6s ease both;
}
.side {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: min(100%, 320px);
}
.compact .side {
  gap: 4px;
  min-width: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.verdict {
  font-size: clamp(2rem, 4.4vw, 3.4rem);
}
.compact .verdict {
  font-size: 1.5rem;
}
.verdict.ok {
  color: var(--green);
}
.verdict.ko {
  color: var(--red);
}
.who {
  font-size: 1.15rem;
}
.compact .who,
.note,
.own {
  font-size: 0.85rem;
}
@keyframes shake {
  20%,
  60% {
    transform: translateX(-7px);
  }
  40%,
  80% {
    transform: translateX(7px);
  }
}
</style>
