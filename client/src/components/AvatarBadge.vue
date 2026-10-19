<script setup lang="ts">
import { computed } from "vue";
import { avatarOf } from "@/avatars";

const props = withDefaults(defineProps<{ avatar: number; size?: number }>(), { size: 48 });
const a = computed(() => avatarOf(props.avatar));
</script>

<template>
  <v-avatar :size="size" :color="a.color" :title="a.label">
    <v-icon :icon="a.icon" :size="size * 0.6" color="#1a1433" />
  </v-avatar>
</template>
