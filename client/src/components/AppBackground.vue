<!-- Fond animé : des halos colorés qui dérivent lentement derrière le contenu. -->
<template>
  <div class="bg" aria-hidden="true">
    <i class="blob b1" />
    <i class="blob b2" />
    <i class="blob b3" />
    <div class="vignette" />
  </div>
</template>

<style scoped>
.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 0%, #1b1047 0%, var(--bg) 60%);
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.55;
  will-change: transform;
}
.b1 {
  width: 46vmax;
  height: 46vmax;
  left: -14vmax;
  top: -12vmax;
  background: var(--pink);
  opacity: 0.3;
  animation: drift1 22s ease-in-out infinite alternate;
}
.b2 {
  width: 42vmax;
  height: 42vmax;
  right: -12vmax;
  bottom: -10vmax;
  background: var(--violet);
  opacity: 0.38;
  animation: drift2 26s ease-in-out infinite alternate;
}
.b3 {
  width: 28vmax;
  height: 28vmax;
  right: 18vmax;
  top: 8vmax;
  background: var(--cyan);
  opacity: 0.12;
  animation: drift1 30s ease-in-out infinite alternate-reverse;
}
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(5, 3, 15, 0.55));
}
@keyframes drift1 {
  to {
    transform: translate3d(8vmax, 6vmax, 0) scale(1.15);
  }
}
@keyframes drift2 {
  to {
    transform: translate3d(-7vmax, -5vmax, 0) scale(1.1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .blob {
    animation: none;
  }
}
</style>
