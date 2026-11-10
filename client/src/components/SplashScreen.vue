<script setup lang="ts">
import MusicLoader from "./MusicLoader.vue";
import VinylDisc from "./VinylDisc.vue";
</script>

<!-- Écran de démarrage : le vinyle tourne en arrière-plan, la note tourne pendant le chargement. -->
<template>
  <div class="splash">
    <div class="disc-bg">
      <VinylDisc :size="900" spinning />
    </div>
    <div class="center">
      <MusicLoader :size="132" />
      <h1 class="display name grad-text">Flashback</h1>
      <p class="tag muted">Remets la musique dans l'ordre.</p>
      <div class="dots" aria-hidden="true"><i /><i /><i /></div>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: grid;
  place-items: center;
  background: radial-gradient(110% 80% at 50% 20%, #1d1150 0%, var(--bg) 70%);
  overflow: hidden;
}
/* Un immense disque qui dépasse du coin : il tourne lentement derrière le logo. */
.disc-bg {
  position: absolute;
  left: 82%;
  top: 92%;
  transform: translate(-50%, -50%);
  opacity: 0.22;
}
.disc-bg :deep(.disc) {
  animation-duration: 18s;
}
.center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}
.name {
  font-size: clamp(3.2rem, 12vw, 6.5rem);
  margin: 8px 0 0;
  animation: rise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.tag {
  margin: 0;
  font-size: clamp(1rem, 3.4vw, 1.4rem);
  animation: rise 0.9s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.dots {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--grad);
  animation: blink 1.2s ease-in-out infinite;
}
.dots i:nth-child(2) {
  animation-delay: 0.2s;
}
.dots i:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
}
@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}
</style>
