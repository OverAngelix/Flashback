<script setup lang="ts">
/** Étoiles d'un niveau de campagne, de 0 à 3. */
withDefaults(defineProps<{ stars: number; size?: number }>(), { size: 20 });
</script>

<template>
  <span class="stars" :aria-label="`${stars} étoile${stars > 1 ? 's' : ''} sur 3`" :data-stars="stars" data-testid="stars">
    <v-icon v-for="i in 3" :key="i" :icon="i <= stars ? 'mdi-star' : 'mdi-star-outline'" :size="size" :class="i <= stars ? 'on' : 'off'" />
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.on {
  color: var(--gold);
  filter: drop-shadow(0 0 6px rgba(255, 201, 77, 0.45));
}
.off {
  color: rgba(255, 255, 255, 0.28);
}
</style>
