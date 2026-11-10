<script setup lang="ts">
withDefaults(defineProps<{ active?: boolean; bars?: number }>(), { active: true, bars: 5 });
</script>

<template>
  <div class="eq" :class="{ active }" aria-hidden="true">
    <i v-for="n in bars" :key="n" :style="{ '--d': `${(n * 137) % 700}ms` }" />
  </div>
</template>

<style scoped>
.eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  height: 28px;
}
.eq i {
  width: 5px;
  height: 100%;
  border-radius: 3px;
  background: var(--grad);
  transform-origin: bottom;
  transform: scaleY(0.2);
}
.eq.active i {
  animation: bounce 0.9s ease-in-out infinite;
  animation-delay: var(--d);
}
@keyframes bounce {
  0%,
  100% {
    transform: scaleY(0.2);
  }
  50% {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .eq.active i {
    animation: none;
    transform: scaleY(0.6);
  }
}
</style>
