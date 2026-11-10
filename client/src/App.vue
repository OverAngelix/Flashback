<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppBackground from "@/components/AppBackground.vue";
import SplashScreen from "@/components/SplashScreen.vue";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Écran de démarrage : visible au moins un instant, le temps de charger les polices. */
const booting = ref(!new URLSearchParams(location.search).has("nosplash"));

onMounted(async () => {
  document.addEventListener("visibilitychange", onVisible);
  // Page rechargée en cours de partie : on reprend là où on était.
  const resumed = connection.resume();
  if (resumed && route.path === "/") {
    await router.replace(connection.state.session?.role === "host" ? "/host" : "/play");
  }
  if (booting.value) {
    await Promise.all([sleep(resumed ? 700 : 1700), Promise.race([document.fonts?.ready, sleep(2500)])]);
    booting.value = false;
  }
});
onUnmounted(() => document.removeEventListener("visibilitychange", onVisible));
</script>

<template>
  <v-app>
    <AppBackground />
    <v-main>
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </v-main>
    <Transition name="splash">
      <SplashScreen v-if="booting" data-testid="splash" />
    </Transition>
    <v-snackbar :model-value="error !== null" color="error" :timeout="4500" location="top" rounded="pill" @update:model-value="error = null">
      {{ error }}
    </v-snackbar>
  </v-app>
</template>

<style>
.splash-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.splash-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
</style>
