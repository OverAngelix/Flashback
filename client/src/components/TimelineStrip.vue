<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { PublicCard } from "@server/net/protocol";
import TrackCard from "./TrackCard.vue";

const props = defineProps<{
  cards: PublicCard[];
  highlightId?: number | null;
  /** Affiche des emplacements cliquables entre les cartes (choix de la position). */
  interactive?: boolean;
  selected?: number | null;
  /** Carte jouée, intercalée à sa position avec son verdict (vert juste, rouge faux). */
  placed?: { card: PublicCard; position: number; correct: boolean } | null;
  /** Emplacements qui auraient été justes, marqués en vert (révélation d'un placement raté). */
  solutions?: number[];
  /** Cartes centrées quand elles tiennent dans la largeur (sinon la frise défile normalement). */
  centered?: boolean;
}>();
const emit = defineEmits<{ select: [position: number] }>();

const positions = computed(() => Array.from({ length: props.cards.length + 1 }, (_, i) => i));

const strip = ref<HTMLElement>();
/**
 * `center` pour l'emplacement choisi (on voit ses deux voisins) ; `nearest` pour une carte à montrer :
 * on ne défile que si elle est cachée, sans couper pour rien le début de la frise.
 */
const scrollTo = async (selector: string, inline: ScrollLogicalPosition = "center") => {
  await nextTick();
  strip.value?.querySelector(selector)?.scrollIntoView({ inline, block: "nearest", behavior: "smooth" });
};
watch(() => props.selected, () => scrollTo(".slot.active"));
watch(() => props.highlightId, (id) => id != null && scrollTo(".track-card.highlight", "nearest"), { flush: "post" });
onMounted(() => props.placed && scrollTo(".track-card.placed", "nearest"));
</script>

<!-- Une frise : les cartes sont posées sur un fil chronologique, les emplacements s'intercalent. -->
<template>
  <div ref="strip" class="strip">
    <div class="track" :class="{ centered }">
      <template v-for="i in positions" :key="i">
        <button v-if="interactive" type="button" class="slot" :class="{ active: selected === i }" :aria-label="`Placer en position ${i + 1}`" @click="emit('select', i)">
          <span class="dot"><v-icon icon="mdi-plus" /></span>
        </button>
        <span v-else-if="solutions?.includes(i)" class="solution" title="Bonne réponse" data-testid="solution">
          <span class="dot"><v-icon icon="mdi-check-bold" /></span>
        </span>
        <span v-else class="gap" />
        <TrackCard v-if="placed && placed.position === i" :card="placed.card" :tone="placed.correct ? 'ok' : 'ko'" class="placed" data-testid="placed-card" />
        <TrackCard v-if="i < cards.length" :card="cards[i]!" :highlight="cards[i]!.id === highlightId" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.strip {
  --card-w: 140px;
  --gap: 22px;
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
.track.centered {
  justify-content: center;
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
  width: var(--gap);
  flex-shrink: 0;
}
/* La carte jouée est intercalée sans emplacement après elle : même écart que les autres. */
.track-card.placed + .track-card {
  margin-left: var(--gap);
}
/* Bonne réponse : un emplacement vert, fixe, à la place de l'écart entre deux cartes. */
.solution {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin-top: calc(var(--card-w) / 2 - 30px);
}
.solution .dot {
  width: 44px;
  height: 44px;
  border: 0;
  color: #1a1340;
  background: var(--green);
  box-shadow: 0 0 0 6px rgba(46, 229, 157, 0.25), 0 6px 22px rgba(46, 229, 157, 0.5);
  animation: none;
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
    --gap: 14px;
    padding: 4px 4px 6px;
  }
  .slot,
  .solution {
    width: 44px;
    height: 44px;
    margin-top: calc(var(--card-w) / 2 - 22px);
  }
  .solution .dot {
    width: 32px;
    height: 32px;
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
