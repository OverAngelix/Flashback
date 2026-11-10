<script setup lang="ts">
import type { PublicCard } from "@server/net/protocol";

defineProps<{ card: PublicCard; highlight?: boolean; big?: boolean }>();
</script>

<template>
  <v-card class="track-card flex-shrink-0" :class="{ big, highlight }" :color="highlight ? 'primary' : 'surface'" rounded="lg" elevation="4">
    <v-img :src="card.imageUrl" :alt="card.title" aspect-ratio="1" cover />
    <div class="px-2 pt-2 year font-weight-black">{{ card.year }}</div>
    <div class="px-2 text-truncate title">{{ card.title }}</div>
    <div class="px-2 pb-2 text-truncate artist text-medium-emphasis">{{ card.artist }}</div>
  </v-card>
</template>

<style scoped>
.track-card {
  width: 140px;
}
.track-card.big {
  width: 260px;
}
.year {
  font-size: 1.6rem;
  line-height: 1.2;
}
.big .year {
  font-size: 2.6rem;
}
.title {
  font-size: 0.85rem;
  font-weight: 600;
}
.artist {
  font-size: 0.75rem;
}
.big .title {
  font-size: 1.1rem;
}
.big .artist {
  font-size: 1rem;
}
/* Téléphone en paysage : peu de hauteur utile (barre du navigateur comprise). */
@media (orientation: landscape) and (max-height: 430px) {
  .track-card {
    width: 104px;
  }
  .track-card.big {
    width: 150px;
  }
  .year {
    font-size: 1.15rem;
  }
  .big .year {
    font-size: 1.6rem;
  }
  .title,
  .big .title {
    font-size: 0.72rem;
  }
  .artist,
  .big .artist {
    font-size: 0.65rem;
  }
}
.highlight .artist {
  color: inherit !important;
  opacity: 0.85;
}
</style>
