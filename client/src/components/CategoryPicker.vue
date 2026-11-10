<script setup lang="ts">
import type { CategorySummary } from "@server/catalog/types";
import { categoryIcon } from "@/categories";

defineProps<{ categories: CategorySummary[]; chosen: ReadonlySet<string>; testidPrefix?: string }>();
const emit = defineEmits<{ toggle: [id: string] }>();
</script>

<template>
  <div class="grid">
    <button
      v-for="c in categories"
      :key="c.id"
      type="button"
      class="cat glass"
      :class="{ on: chosen.has(c.id) }"
      :aria-pressed="chosen.has(c.id)"
      :data-testid="`${testidPrefix ?? 'category'}-${c.id}`"
      @click="emit('toggle', c.id)"
    >
      <span class="icon"><v-icon :icon="categoryIcon(c.id)" size="28" /></span>
      <span class="text">
        <span class="label display">{{ c.label }}</span>
        <span class="count muted">{{ c.count }} titres</span>
      </span>
      <span class="check"><v-icon icon="mdi-check" size="18" /></span>
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: 12px;
}
.cat {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}
.cat:active {
  transform: scale(0.98);
}
.icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--glass-strong);
}
.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.label {
  font-size: 1.15rem;
  font-weight: 600;
}
.count {
  font-size: 0.9rem;
}
.check {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--grad);
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
}
.cat.on {
  border-color: transparent;
  background: linear-gradient(135deg, rgba(255, 61, 154, 0.28), rgba(124, 92, 255, 0.28));
  box-shadow: 0 0 0 2px var(--pink), 0 10px 30px rgba(255, 61, 154, 0.25);
}
.cat.on .icon {
  background: var(--grad);
}
.cat.on .check {
  opacity: 1;
  transform: scale(1);
}
</style>
