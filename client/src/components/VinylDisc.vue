<script setup lang="ts">
import BrandMark from "./BrandMark.vue";

/** `size` : un nombre de pixels, ou une expression CSS (par exemple `min(210px, 22dvh)`). */
withDefaults(defineProps<{ size?: number | string; spinning?: boolean }>(), { size: 200, spinning: false });
</script>

<!-- Un disque vinyle en CSS. `spinning` le fait tourner (l'animation se met en pause sans revenir à zéro). -->
<template>
  <div class="disc" :class="{ spinning }" :style="{ '--s': typeof size === 'number' ? `${size}px` : size }">
    <div class="grooves" />
    <div class="shine" />
    <div class="label"><BrandMark class="mark" /></div>
    <div class="hole" />
  </div>
</template>

<style scoped>
.disc {
  position: relative;
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(255, 255, 255, 0.05);
  animation: spin 3.2s linear infinite;
  animation-play-state: paused;
}
.disc.spinning {
  animation-play-state: running;
}
.grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-radial-gradient(circle at center, #0a0816 0 2px, #17122f 2px 4px);
}
.shine {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 20deg, transparent 0 18%, rgba(255, 255, 255, 0.16) 25%, transparent 32% 68%, rgba(255, 255, 255, 0.14) 75%, transparent 82%);
}
.label {
  position: absolute;
  inset: 31%;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 30% 25%, #ffffff, #f1e9ff 60%, #d8c8ff);
  box-shadow: inset 0 0 0 3px rgba(124, 92, 255, 0.35);
}
.mark {
  width: 58%;
  height: 58%;
}
.hole {
  position: absolute;
  inset: 48.5%;
  border-radius: 50%;
  background: var(--bg);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
