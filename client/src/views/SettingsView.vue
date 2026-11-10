<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { playTestTone } from "@/audio";
import BrandMark from "@/components/BrandMark.vue";
import { useConnection } from "@/net/connection";
import { useSettings } from "@/settings";
import { MAX_NAME_LENGTH } from "@server/game/types";

const router = useRouter();
const settings = useSettings();
const connection = useConnection();

/** Le curseur travaille en pourcentage, les réglages en 0 à 1. */
const volume = computed({
  get: () => Math.round(settings.volume * 100),
  set: (v: number) => (settings.volume = v / 100),
});

const musicVolume = computed({
  get: () => Math.round(settings.musicVolume * 100),
  set: (v: number) => (settings.musicVolume = v / 100),
});

const hasSession = computed(() => !!connection.state.session);
function forgetSession() {
  connection.leave();
}
</script>

<template>
  <div class="settings">
    <header class="head">
      <v-btn icon="mdi-arrow-left" class="btn-ghost" size="default" title="Retour au menu" data-testid="settings-back" @click="router.push('/')" />
      <BrandMark class="mark" />
      <h1 class="display t-md">Paramètres</h1>
    </header>

    <section class="panel glass">
      <h2 class="display">Extraits</h2>
      <div class="row">
        <div class="txt">
          <div class="name">Volume des extraits</div>
          <div class="muted small">Réglage de l'écran qui joue la musique (télé ou PC).</div>
        </div>
        <div class="ctl">
          <v-slider v-model="volume" :min="0" :max="100" :step="5" color="primary" thumb-label hide-details data-testid="setting-volume" class="slider" />
          <span class="display val">{{ volume }} %</span>
          <v-btn class="btn-ghost" size="small" prepend-icon="mdi-volume-high" @click="playTestTone">Tester</v-btn>
        </div>
      </div>
    </section>

    <section class="panel glass">
      <h2 class="display">Musique du menu</h2>
      <div class="row">
        <div class="txt">
          <div class="name">Musique d'ambiance</div>
          <div class="muted small">Une musique douce, style salon d'attente, dans le menu.</div>
        </div>
        <v-switch v-model="settings.music" color="primary" hide-details inset data-testid="setting-music" />
      </div>
      <div class="row">
        <div class="txt">
          <div class="name">Volume de la musique</div>
        </div>
        <div class="ctl">
          <v-slider v-model="musicVolume" :min="0" :max="100" :step="5" color="primary" thumb-label hide-details :disabled="!settings.music" data-testid="setting-music-volume" class="slider" />
          <span class="display val">{{ musicVolume }} %</span>
        </div>
      </div>
    </section>

    <section class="panel glass">
      <h2 class="display">Affichage</h2>
      <div class="row">
        <div class="txt">
          <div class="name">Animations réduites</div>
          <div class="muted small">Coupe les confettis, le fond animé et les transitions.</div>
        </div>
        <v-switch v-model="settings.reducedMotion" color="primary" hide-details inset data-testid="setting-reduced" />
      </div>
      <div class="row">
        <div class="txt">
          <div class="name">Écran de démarrage</div>
          <div class="muted small">Affiche le logo animé au chargement.</div>
        </div>
        <v-switch v-model="settings.splash" color="primary" hide-details inset data-testid="setting-splash" />
      </div>
    </section>

    <section class="panel glass">
      <h2 class="display">Joueur</h2>
      <div class="row">
        <div class="txt">
          <div class="name">Nom par défaut</div>
          <div class="muted small">Proposé quand tu rejoins une partie.</div>
        </div>
        <v-text-field v-model="settings.playerName" label="Ton nom" :maxlength="MAX_NAME_LENGTH" counter density="comfortable" class="name-field" data-testid="setting-name" />
      </div>
      <div class="row">
        <div class="txt">
          <div class="name">Partie en cours</div>
          <div class="muted small">{{ hasSession ? "Tu as une partie mémorisée sur cet appareil." : "Aucune partie mémorisée." }}</div>
        </div>
        <v-btn class="btn-ghost" size="default" :disabled="!hasSession" prepend-icon="mdi-exit-to-app" data-testid="setting-forget" @click="forgetSession">Quitter la partie</v-btn>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head h1 {
  margin: 0;
}
.mark {
  width: 36px;
  height: 36px;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px 22px;
}
.panel h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 10px 0;
}
.row + .row {
  border-top: 1px solid var(--border);
}
.txt {
  flex: 1;
  min-width: 200px;
}
.name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.1rem;
}
.small {
  font-size: 0.9rem;
}
.ctl {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 260px;
  max-width: 420px;
}
.slider {
  flex: 1;
}
.val {
  min-width: 3.4em;
  text-align: right;
}
.name-field {
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}
</style>
