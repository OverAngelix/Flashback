<script setup lang="ts">
import { useId } from "vue";

/** Le logo des points groove : une boule disco à facettes, suspendue à son fil. */
withDefaults(defineProps<{ size?: number | string }>(), { size: 18 });
// Identifiants propres à chaque instance : plusieurs boules sont affichées sur la même page.
const id = useId();
</script>

<template>
  <svg class="disco-ball" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <radialGradient :id="`${id}-shine`" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.45" stop-color="#c9cff5" />
        <stop offset="1" stop-color="#6a63b8" />
      </radialGradient>
      <clipPath :id="`${id}-clip`"><circle cx="12" cy="14" r="9" /></clipPath>
    </defs>
    <line x1="12" y1="0.5" x2="12" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7" />
    <circle cx="12" cy="14" r="9" :fill="`url(#${id}-shine)`" />
    <g :clip-path="`url(#${id}-clip)`">
      <!-- Facettes colorées, puis la grille des miroirs (parallèles et méridiens). -->
      <rect x="13" y="7" width="3" height="3" fill="#ff3d9a" opacity="0.75" />
      <rect x="6" y="13" width="3" height="3" fill="#27d9ff" opacity="0.7" />
      <rect x="15" y="16" width="3" height="3" fill="#7c5cff" opacity="0.75" />
      <rect x="9" y="19" width="3" height="3" fill="#ffc94d" opacity="0.7" />
      <g fill="none" stroke="#2a2266" stroke-width="0.55" opacity="0.55">
        <path d="M3 8h18M3 11h18M3 14h18M3 17h18M3 20h18" />
        <ellipse cx="12" cy="14" rx="3" ry="9" />
        <ellipse cx="12" cy="14" rx="6.5" ry="9" />
        <path d="M12 5v18" />
      </g>
    </g>
    <circle cx="12" cy="14" r="9" fill="none" stroke="#2a2266" stroke-width="0.6" opacity="0.6" />
    <path d="M7.6 8.4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff" />
  </svg>
</template>

<style scoped>
.disco-ball {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: -0.2em;
  filter: drop-shadow(0 0 4px rgba(255, 201, 77, 0.45));
}
</style>
