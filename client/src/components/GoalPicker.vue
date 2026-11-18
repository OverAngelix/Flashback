<script setup lang="ts">
import { MAX_CARDS_TO_WIN, MIN_CARDS_TO_WIN } from "@server/game/types";

/** Nombre de cartes pour gagner, de MIN_CARDS_TO_WIN à MAX_CARDS_TO_WIN : une pastille par valeur. */
defineProps<{ value: number; testidPrefix?: string }>();
const emit = defineEmits<{ pick: [count: number] }>();

const counts = Array.from({ length: MAX_CARDS_TO_WIN - MIN_CARDS_TO_WIN + 1 }, (_, i) => MIN_CARDS_TO_WIN + i);
</script>

<template>
  <div class="goals" role="radiogroup" aria-label="Cartes pour gagner">
    <button
      v-for="n in counts"
      :key="n"
      type="button"
      role="radio"
      class="goal display"
      :class="{ on: n === value }"
      :aria-checked="n === value"
      :data-testid="`${testidPrefix ?? 'goal'}-${n}`"
      @click="n !== value && emit('pick', n)"
    >
      {{ n }}
    </button>
  </div>
</template>

<style scoped>
.goals {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
}
/* Sans .glass : son flou d'arrière-plan coûte cher sur téléphone (voir CategoryPicker). */
.goal {
  height: 48px;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--glass);
  color: inherit;
  font-size: 1.3rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}
.goal:active {
  transform: scale(0.95);
}
.goal.on {
  border-color: transparent;
  background: var(--grad);
  box-shadow: 0 0 0 2px var(--pink), 0 8px 22px rgba(255, 61, 154, 0.3);
}
@media (max-width: 380px) {
  .goals {
    gap: 5px;
  }
  .goal {
    height: 42px;
    font-size: 1.1rem;
  }
}
</style>
