<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { PublicCard } from "@server/net/protocol";
import TrackCard from "./TrackCard.vue";

const props = defineProps<{
  cards: PublicCard[];
  highlightId?: number | null;
  /** Affiche des emplacements cliquables entre les cartes (choix de la position). */
  interactive?: boolean;
  selected?: number | null;
}>();
const emit = defineEmits<{ select: [position: number] }>();

const strip = ref<HTMLElement>();

watch(
  () => props.selected,
  async () => {
    await nextTick();
    strip.value?.querySelector(".slot.active")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  },
);
</script>

<template>
  <div ref="strip" class="strip d-flex align-center">
    <template v-for="(card, i) in cards" :key="card.id">
      <button v-if="interactive" type="button" class="slot" :class="{ active: selected === i }" :aria-label="`Placer en position ${i + 1}`" @click="emit('select', i)">
        <v-icon icon="mdi-plus" />
      </button>
      <span v-else class="gap" />
      <TrackCard :card="card" :highlight="card.id === highlightId" />
    </template>
    <button v-if="interactive" type="button" class="slot" :class="{ active: selected === cards.length }" :aria-label="`Placer en position ${cards.length + 1}`" @click="emit('select', cards.length)">
      <v-icon icon="mdi-plus" />
    </button>
  </div>
</template>

<style scoped>
.strip {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 8px 4px 12px;
  min-width: 0;
}
.strip > * {
  scroll-snap-align: center;
}
.gap {
  width: 14px;
  flex-shrink: 0;
}
.slot {
  flex-shrink: 0;
  align-self: stretch;
  width: 44px;
  min-height: 150px;
  margin: 0 4px;
  border: 2px dashed rgba(255, 255, 255, 0.35);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.slot.active {
  width: 80px;
  border-style: solid;
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.25);
  color: rgb(var(--v-theme-primary));
}
</style>
