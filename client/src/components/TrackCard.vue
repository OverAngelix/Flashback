<script setup lang="ts">
import { ref } from "vue";
import type { PublicCard } from "@server/net/protocol";

/** `tone` : verdict d'un placement, vert si juste, rouge si faux (la carte fausse n'est pas gardée). */
defineProps<{ card: PublicCard; highlight?: boolean; big?: boolean; tone?: "ok" | "ko" }>();
const loaded = ref(false);
</script>

<!-- Une pochette : l'année en pastille sur l'image, le titre et l'artiste dessous. -->
<template>
  <article class="track-card" :class="[{ big, highlight }, tone && `tone-${tone}`]">
    <div class="cover">
      <img :src="card.imageUrl" :alt="card.title" :class="{ loaded }" draggable="false" @load="loaded = true" />
      <span class="year display">{{ card.year }}</span>
      <span v-if="tone" class="verdict-badge"><v-icon :icon="tone === 'ok' ? 'mdi-check-bold' : 'mdi-close-thick'" /></span>
    </div>
    <div class="meta">
      <div class="title text-truncate">{{ card.title }}</div>
      <div class="artist text-truncate muted">{{ card.artist }}</div>
    </div>
  </article>
</template>

<style scoped>
.track-card {
  --w: var(--card-w, 140px);
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: var(--w);
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
.track-card.big {
  --card-w: 260px;
  --w: 260px;
}
.cover {
  position: relative;
  aspect-ratio: 1;
  background: linear-gradient(110deg, #1d1648 8%, #2a2060 18%, #1d1648 33%);
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}
.cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.cover img.loaded {
  opacity: 1;
}
.year {
  position: absolute;
  left: calc(var(--w) * 0.05);
  bottom: calc(var(--w) * 0.05);
  padding: 0 calc(var(--w) * 0.07);
  border-radius: 999px;
  font-size: calc(var(--w) * 0.17);
  line-height: 1.35;
  background: var(--grad);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}
.meta {
  padding: calc(var(--w) * 0.06) calc(var(--w) * 0.08) calc(var(--w) * 0.08);
}
.title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: max(0.7rem, calc(var(--w) * 0.098));
}
.artist {
  font-size: max(0.62rem, calc(var(--w) * 0.08));
}
.highlight {
  border-color: transparent;
  box-shadow: 0 0 0 2px var(--pink), 0 0 36px rgba(255, 61, 154, 0.55);
  animation: pop 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.tone-ok,
.tone-ko {
  border-color: transparent;
  animation: pop 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.tone-ok {
  box-shadow: 0 0 0 3px var(--green), 0 0 34px rgba(46, 229, 157, 0.5);
}
.tone-ko {
  box-shadow: 0 0 0 3px var(--red), 0 0 34px rgba(255, 92, 112, 0.5);
}
.tone-ko .cover img.loaded {
  opacity: 0.6;
  filter: grayscale(0.6);
}
.verdict-badge {
  position: absolute;
  top: calc(var(--w) * 0.05);
  right: calc(var(--w) * 0.05);
  display: grid;
  place-items: center;
  width: calc(var(--w) * 0.22);
  height: calc(var(--w) * 0.22);
  border-radius: 50%;
  font-size: calc(var(--w) * 0.13);
  color: #1a1340;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
}
.tone-ok .verdict-badge {
  background: var(--green);
}
.tone-ko .verdict-badge {
  background: var(--red);
  color: #fff;
}
@keyframes pop {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
/* Téléphone en paysage : peu de hauteur utile (barre du navigateur comprise). */
@media (orientation: landscape) and (max-height: 430px) {
  .track-card {
    --w: var(--card-w, 104px);
  }
  .track-card.big {
    --card-w: 150px;
    --w: 150px;
  }
}
</style>
