<script setup lang="ts">
import { computed } from "vue";
import type { CategorySummary } from "@server/catalog/types";
import { AXES, categoryIcon } from "@/categories";

const props = defineProps<{ categories: CategorySummary[]; chosen: ReadonlySet<string>; testidPrefix?: string }>();
const emit = defineEmits<{ toggle: [id: string]; clear: [] }>();

/** Une ligne par axe. Dans un axe rien de coché = tout ; entre les axes, le serveur croise. */
const groups = computed(() =>
  AXES.map((axis) => {
    const items = props.categories.filter((c) => c.axis === axis.id);
    return { ...axis, items, open: !items.some((c) => props.chosen.has(c.id)) };
  }).filter((g) => g.items.length > 0),
);
const prefix = computed(() => props.testidPrefix ?? "category");
</script>

<template>
  <div class="picker">
    <div v-for="g in groups" :key="g.id" class="group">
      <div class="axis">
        <span class="display">{{ g.label }}</span>
        <span v-if="g.open" class="muted">toutes</span>
      </div>
      <div class="chips">
        <button
          v-for="c in g.items"
          :key="c.id"
          type="button"
          class="cat"
          :class="{ on: chosen.has(c.id) }"
          :aria-pressed="chosen.has(c.id)"
          :disabled="c.count === 0 && !chosen.has(c.id)"
          :data-testid="`${prefix}-${c.id}`"
          @click="emit('toggle', c.id)"
        >
          <v-icon v-if="categoryIcon(c.id)" :icon="categoryIcon(c.id)" size="18" />
          <span class="label">{{ c.label }}</span>
          <span class="count">{{ c.count }}</span>
        </button>
      </div>
    </div>
    <button v-if="chosen.size > 0" type="button" class="clear muted" :data-testid="`${prefix}-clear`" @click="emit('clear')">
      <v-icon icon="mdi-filter-off-outline" size="16" /> Tout effacer
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.axis {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.95rem;
}
.axis .muted {
  font-size: 0.8rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
/*
 * Pas de .glass ici : son flou d'arrière-plan, recalculé à chaque image au-dessus du fond animé,
 * faisait ramer les téléphones avec une vingtaine de pastilles. Un fond translucide suffit.
 */
.cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}
.cat:active {
  transform: scale(0.96);
}
.cat:disabled {
  opacity: 0.35;
  cursor: default;
}
.label {
  white-space: nowrap;
}
.count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--glass-strong);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.cat.on {
  border-color: transparent;
  background: var(--grad);
  box-shadow: 0 4px 16px rgba(255, 61, 154, 0.3);
}
.cat.on .count {
  background: rgba(0, 0, 0, 0.2);
}
.clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
/* Téléphone en paysage : environ 300 px utiles. */
@media (max-height: 500px) {
  .picker {
    gap: 8px;
  }
  .cat {
    padding: 4px 10px;
    font-size: 0.85rem;
  }
}
</style>
