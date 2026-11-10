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
const scrollTo = async (selector: string) => {
  await nextTick();
  strip.value?.querySelector(selector)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
};
watch(() => props.selected, () => scrollTo(".slot.active"));
watch(() => props.highlightId, (id) => id != null && scrollTo(".track-card.highlight"), { flush: "post" });
</script>

<!-- Une frise : les cartes sont posées sur un fil chronologique, les emplacements s'intercalent. -->
<template>
  <div ref="strip" class="strip">
    <div class="track">
      <template v-for="(card, i) in cards" :key="card.id">
        <button v-if="interactive" type="button" class="slot" :class="{ active: selected === i }" :aria-label="`Placer en position ${i + 1}`" @click="emit('select', i)">
          <span class="dot"><v-icon icon="mdi-plus" /></span>
        </button>
        <span v-else class="gap" />
        <TrackCard :card="card" :highlight="card.id === highlightId" />
      </template>
      <button v-if="interactive" type="button" class="slot" :class="{ active: selected === cards.length }" :aria-label="`Placer en position ${cards.length + 1}`" @click="emit('select', cards.length)">
        <span class="dot"><v-icon icon="mdi-plus" /></span>
      </button>
      <span v-else class="gap" />
    </div>
  </div>
</template>

<style scoped>
.strip {
  --card-w: 140px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 10px 4px 16px;
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
.track {
  position: relative;
  display: flex;
  align-items: flex-start;
  width: max-content;
  min-width: 100%;
}
/* Le fil chronologique, derrière les cartes. */
.track::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--card-w) / 2 - 1px);
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28) 6%, rgba(255, 255, 255, 0.28) 94%, transparent);
}
.track > * {
  scroll-snap-align: center;
}
.gap {
  width: 22px;
  flex-shrink: 0;
}
.slot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin-top: calc(var(--card-w) / 2 - 30px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.dot {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #fff;
  background: var(--bg-2);
  border: 2px dashed rgba(255, 255, 255, 0.55);
  transition: all 0.18s ease;
  animation: beat 2.2s ease-in-out infinite;
}
.slot:active .dot {
  transform: scale(0.9);
}
.slot.active .dot {
  width: 52px;
  height: 52px;
  border: 0;
  background: var(--grad);
  box-shadow: 0 0 0 7px rgba(255, 61, 154, 0.25), 0 8px 26px rgba(255, 61, 154, 0.55);
  animation: none;
}
@keyframes beat {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.25);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(255, 255, 255, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}
@media (orientation: landscape) and (max-height: 430px) {
  .strip {
    --card-w: 104px;
    padding: 4px 4px 6px;
  }
  .gap {
    width: 14px;
  }
  .slot {
    width: 44px;
    height: 44px;
    margin-top: calc(var(--card-w) / 2 - 22px);
  }
  .dot {
    width: 28px;
    height: 28px;
  }
  .slot.active .dot {
    width: 40px;
    height: 40px;
  }
}
</style>
