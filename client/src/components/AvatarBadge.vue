<script setup lang="ts">
import { computed } from "vue";
import { avatarOf } from "@/avatars";

const props = withDefaults(defineProps<{ avatar: number; size?: number; leader?: boolean }>(), { size: 48 });
const a = computed(() => avatarOf(props.avatar));
</script>

<template>
  <span class="avatar" :style="{ '--c': a.color, '--s': `${size}px` }" :title="a.label">
    <v-icon :icon="a.icon" :size="size * 0.58" />
    <span v-if="leader" class="crown" title="Chef de partie"><v-icon icon="mdi-crown" :size="Math.max(14, size * 0.4)" /></span>
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  color: #1a1340;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--c) 55%, white), var(--c));
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4), 0 6px 18px color-mix(in srgb, var(--c) 45%, transparent);
}
.crown {
  position: absolute;
  top: -32%;
  right: -22%;
  display: grid;
  color: var(--gold);
  transform: rotate(18deg);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}
</style>
