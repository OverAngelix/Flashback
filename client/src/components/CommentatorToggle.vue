<script setup lang="ts">
/** Interrupteur du commentateur de l'écran hôte (bêta), dans le salon (écran hôte et téléphone du chef). */
defineProps<{ value: boolean; testid?: string }>();
const emit = defineEmits<{ toggle: [enabled: boolean] }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    class="commentator display"
    :class="{ on: value }"
    :aria-checked="value"
    :title="value ? 'Couper le commentateur' : 'Activer le commentateur'"
    :data-testid="testid ?? 'commentator'"
    @click="emit('toggle', !value)"
  >
    <v-icon :icon="value ? 'mdi-microphone' : 'mdi-microphone-off'" size="22" />
    <span>Commentateur</span>
    <span class="state">{{ value ? "activé" : "coupé" }}</span>
    <span class="beta">Bêta</span>
  </button>
</template>

<style scoped>
/* Sans .glass : son flou d'arrière-plan coûte cher sur téléphone (voir CategoryPicker). */
.commentator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--glass);
  color: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}
.commentator:active {
  transform: scale(0.97);
}
.commentator.on {
  border-color: transparent;
  background: var(--grad);
  box-shadow: 0 0 0 2px var(--pink), 0 8px 22px rgba(255, 61, 154, 0.3);
}
/* Même pastille que « Bientôt » du menu. */
.beta {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--gold);
  color: #3a2600;
  font-size: 0.72rem;
}
.state {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.8;
}
</style>
