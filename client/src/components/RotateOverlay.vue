<template>
  <div class="rotate d-flex flex-column align-center justify-center text-center pa-8">
    <v-icon icon="mdi-screen-rotation" size="96" color="primary" class="rotate-icon" />
    <div class="text-headline-small mt-6">Tourne ton téléphone</div>
    <div class="text-medium-emphasis mt-2">La frise se fait glisser plus facilement en mode paysage.</div>
  </div>
</template>

<style scoped>
.rotate {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgb(var(--v-theme-background));
}
.rotate-icon {
  animation: tilt 2s ease-in-out infinite;
}
@keyframes tilt {
  0%,
  30% {
    transform: rotate(0);
  }
  60%,
  100% {
    transform: rotate(-90deg);
  }
}
</style>
