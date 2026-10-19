<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useConnection } from "@/net/connection";

const connection = useConnection();
const route = useRoute();
const router = useRouter();

const error = computed({
  get: () => connection.state.error?.message ?? null,
  set: (v) => {
    if (v === null) connection.clearError();
  },
});

// Un téléphone qui se réveille doit se reconnecter tout de suite plutôt qu'attendre le prochain essai.
const onVisible = () => document.visibilityState === "visible" && connection.wake();

onMounted(async () => {
  document.addEventListener("visibilitychange", onVisible);
  // Page rechargée en cours de partie : on reprend là où on était.
  if (connection.resume() && route.path === "/") {
    await router.replace(connection.state.session?.role === "host" ? "/host" : "/play");
  }
});
onUnmounted(() => document.removeEventListener("visibilitychange", onVisible));
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
    <v-snackbar :model-value="error !== null" color="error" :timeout="4000" location="top" @update:model-value="error = null">
      {{ error }}
    </v-snackbar>
  </v-app>
</template>
