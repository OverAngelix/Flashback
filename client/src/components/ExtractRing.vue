<script setup lang="ts">
import { computed } from "vue";

/**
 * Anneau de progression de l'extrait autour de son contenu (slot, centré).
 * `progress` de 0 à 1 ; `null` : chargement, un arc qui tourne (comme `MusicLoader`).
 * `size` : diamètre extérieur en pixels ; `thickness` : épaisseur de l'anneau.
 */
const props = withDefaults(defineProps<{ progress: number | null; size: number; thickness?: number }>(), { thickness: 6 });
const style = computed(() => ({
  "--s": `${props.size}px`,
  "--t": `${props.thickness}px`,
  "--p": `${(props.progress === null ? 0.3 : Math.min(1, Math.max(0, props.progress))) * 100}%`,
}));
</script>

<template>
  <div class="ring" :class="{ loading: progress === null }" :style="style">
    <div class="track" aria-hidden="true" />
    <div class="fill" aria-hidden="true" />
    <div class="content"><slot /></div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--s);
  height: var(--s);
  flex-shrink: 0;
}
.track,
.fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--t)), #000 calc(100% - var(--t) + 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--t)), #000 calc(100% - var(--t) + 1px));
}
.track {
  background: rgba(255, 255, 255, 0.12);
}
/* Le dégradé est comprimé sur la partie écoulée : l'arc part rose du haut et finit toujours cyan. */
.fill {
  background: conic-gradient(var(--pink) 0%, var(--violet) calc(var(--p) * 0.6), var(--cyan) var(--p), transparent var(--p));
  filter: drop-shadow(0 0 6px rgba(255, 61, 154, 0.55));
}
.loading .fill {
  animation: turn 1.1s linear infinite;
}
.content {
  position: relative;
  display: grid;
  place-items: center;
}
@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading .fill {
    animation-duration: 3s;
  }
}
</style>
