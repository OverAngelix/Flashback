<script setup lang="ts">
const props = withDefaults(defineProps<{ count?: number }>(), { count: 40 });

const COLORS = ["#ff3d9a", "#7c5cff", "#27d9ff", "#ffc94d", "#2ee59d"];
// Tirés une seule fois : le même confetti ne bouge pas à chaque rendu.
const pieces = Array.from({ length: props.count }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.8,
  duration: 1.8 + Math.random() * 1.6,
  size: 6 + Math.random() * 8,
  color: COLORS[i % COLORS.length]!,
  drift: (Math.random() - 0.5) * 120,
  round: Math.random() > 0.5,
}));
</script>

<template>
  <div class="confetti" aria-hidden="true">
    <i
      v-for="(p, i) in pieces"
      :key="i"
      :class="{ round: p.round }"
      :style="{ left: `${p.left}%`, width: `${p.size}px`, height: `${p.size * (p.round ? 1 : 1.8)}px`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, '--drift': `${p.drift}px` }"
    />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 50;
}
i {
  position: absolute;
  top: -5vh;
  opacity: 0;
  border-radius: 2px;
  animation: fall linear 1 forwards;
}
i.round {
  border-radius: 50%;
}
@keyframes fall {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--drift), 105vh, 0) rotate(720deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
</style>
