<template>
  <div class="rotate">
    <div class="glass card">
      <v-icon icon="mdi-screen-rotation" size="84" color="primary" class="icon" />
      <div class="display t-md">Tourne ton téléphone</div>
      <div class="muted">La frise se fait glisser plus facilement en mode paysage.</div>
    </div>
  </div>
</template>

<style scoped>
.rotate {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(120% 80% at 50% 0%, #1d1150, var(--bg) 70%);
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 28px;
  text-align: center;
}
.icon {
  animation: tilt 2.2s ease-in-out infinite;
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
