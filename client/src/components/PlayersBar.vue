<script setup lang="ts">
import type { PlayerView } from "@server/net/protocol";
import AvatarBadge from "./AvatarBadge.vue";

defineProps<{ players: PlayerView[]; activeId?: string | null; compact?: boolean }>();
</script>

<template>
  <div class="d-flex flex-wrap ga-2">
    <v-chip
      v-for="p in players"
      :key="p.id"
      :color="p.id === activeId ? 'primary' : undefined"
      :variant="p.id === activeId ? 'flat' : 'tonal'"
      :size="compact ? 'default' : 'large'"
      :class="{ 'opacity-60': !p.connected }"
    >
      <template #prepend>
        <AvatarBadge :avatar="p.avatar" :size="compact ? 24 : 32" class="mr-2" />
      </template>
      {{ p.name }} · {{ p.timeline.length }}
      <v-icon v-if="!p.connected" icon="mdi-wifi-off" size="small" class="ml-1" title="Déconnecté" />
    </v-chip>
  </div>
</template>
