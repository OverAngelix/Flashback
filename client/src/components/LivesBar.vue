<script setup lang="ts">
/** Vies d'une partie solo : un cœur plein par vie restante, un cœur vide par vie perdue. */
withDefaults(defineProps<{ lives: number; max: number; size?: number }>(), { size: 22 });
</script>

<template>
  <span class="lives" :title="`${lives} vie${lives > 1 ? 's' : ''} sur ${max}`" :aria-label="`${lives} vie${lives > 1 ? 's' : ''} sur ${max}`" data-testid="lives">
    <v-icon v-for="i in max" :key="i" :icon="i <= lives ? 'mdi-heart' : 'mdi-heart-outline'" :size="size" :class="i <= lives ? 'full' : 'lost'" />
  </span>
</template>

<style scoped>
.lives {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.full {
  color: var(--red);
  filter: drop-shadow(0 0 6px rgba(255, 92, 112, 0.5));
}
.lost {
  color: rgba(255, 255, 255, 0.3);
}
</style>
