<script setup lang="ts">
import BrandMark from "./BrandMark.vue";

withDefaults(defineProps<{ size?: number }>(), { size: 96 });
</script>

<!-- Chargement : une note de musique qui tourne sur elle-même, dans un anneau lumineux. -->
<template>
  <div class="loader" :style="{ '--s': `${size}px` }" role="status" aria-label="Chargement">
    <div class="glow" />
    <div class="ring" />
    <BrandMark class="note" />
  </div>
</template>

<style scoped>
.loader {
  position: relative;
  width: var(--s);
  height: var(--s);
  display: grid;
  place-items: center;
  perspective: calc(var(--s) * 6);
}
.note {
  width: 52%;
  height: 52%;
  filter: drop-shadow(0 0 calc(var(--s) * 0.1) rgba(255, 61, 154, 0.7));
  animation: flip 1.9s cubic-bezier(0.45, 0.05, 0.35, 1) infinite;
}
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0 30%, var(--pink), var(--violet), var(--cyan));
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  animation: turn 1.3s linear infinite;
}
.glow {
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(124, 92, 255, 0.55), transparent 70%);
  animation: pulse 1.9s ease-in-out infinite;
}
@keyframes flip {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(360deg);
  }
}
@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(0.85);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
</style>
