<script setup lang="ts">
import { useRouter } from "vue-router";
import { unlockAudio } from "@/audio";
import { useSettings } from "@/settings";
import VinylDisc from "@/components/VinylDisc.vue";
import { useConnection } from "@/net/connection";

const router = useRouter();
const connection = useConnection();
const settings = useSettings();

function hostGame() {
  // Ce clic débloque l'audio du navigateur : l'écran hôte jouera ensuite les extraits sans autre geste.
  unlockAudio();
  connection.createRoom();
  router.push("/host");
}
</script>

<!-- Menu principal : le logo au centre, une boîte par destination. -->
<template>
  <div class="menu">
    <v-btn
      :icon="settings.music ? 'mdi-volume-high' : 'mdi-volume-off'"
      class="btn-ghost music"
      size="default"
      :title="settings.music ? 'Couper la musique' : 'Activer la musique'"
      data-testid="music-toggle"
      @click="settings.music = !settings.music"
    />
    <div class="logo">
      <div class="disc"><VinylDisc size="min(210px, 22dvh)" spinning /></div>
      <h1 class="display t-xl grad-text">Flashback</h1>
      <p class="tag muted">Écoute l'extrait, remets la musique dans l'ordre.</p>
    </div>

    <v-alert v-if="connection.state.sessionLost" type="warning" variant="tonal" class="notice" closable>La partie que tu avais en cours n'existe plus.</v-alert>
    <v-alert v-if="connection.state.kicked" type="info" variant="tonal" class="notice" closable>L'hôte t'a retiré de la partie.</v-alert>
    <v-alert v-if="connection.state.closed" type="info" variant="tonal" class="notice" closable data-testid="notice-closed">L'hôte a mis fin à la partie.</v-alert>

    <nav class="tiles" aria-label="Menu principal">
      <button type="button" class="tile glass host" data-testid="menu-host" @click="hostGame">
        <span class="ico"><v-icon icon="mdi-television-play" size="40" /></span>
        <span class="display name">Héberger</span>
        <span class="muted sub">Sur la télé ou le PC</span>
      </button>

      <router-link to="/play" class="tile glass join" data-testid="menu-join">
        <span class="ico"><v-icon icon="mdi-devices" size="40" /></span>
        <span class="display name">Rejoindre</span>
        <span class="muted sub">Avec ton téléphone ou ton PC</span>
      </router-link>

      <!-- Prévu pour la V2 : liste des parties publiques, création de parties en ligne. -->
      <button type="button" class="tile glass multi" disabled aria-disabled="true" title="Bientôt disponible" data-testid="menu-multi">
        <span class="soon display">Bientôt</span>
        <span class="ico"><v-icon icon="mdi-earth" size="40" /></span>
        <span class="display name">Multijoueur</span>
        <span class="muted sub">Parties publiques en ligne</span>
      </button>

      <router-link to="/settings" class="tile glass settings" data-testid="menu-settings">
        <span class="ico"><v-icon icon="mdi-cog" size="40" /></span>
        <span class="display name">Paramètres</span>
        <span class="muted sub">Son, affichage, nom</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
/* Le titre en haut, puis la grille de boîtes ; le tout centré, avec de l'air en bas. */
.menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(18px, 4dvh, 48px);
  min-height: 100dvh;
  padding: 24px clamp(16px, 4vw, 56px) clamp(24px, 6dvh, 80px);
}
.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0;
  text-align: center;
}
.logo h1 {
  margin: 0;
  font-size: clamp(2.2rem, min(6vw, 9dvh), 4.6rem);
}
.disc {
  filter: drop-shadow(0 0 40px rgba(124, 92, 255, 0.45));
}
.tag {
  margin: 0;
  font-size: clamp(1rem, 2.6vw, 1.3rem);
}
.music {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 5;
}
.notice {
  align-self: center;
  max-width: 520px;
}
/* Grille de 2 par 2, sur tous les écrans. */
.tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(14px, 2vw, 22px);
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: clamp(104px, 18dvh, 200px);
  padding: clamp(10px, 2dvh, 20px) 14px;
  color: inherit;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.2s;
}
.tile:hover:not(:disabled) {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.32);
  box-shadow: 0 18px 44px rgba(124, 92, 255, 0.3);
}
.tile:active:not(:disabled) {
  transform: scale(0.98);
}
.ico {
  display: grid;
  place-items: center;
  width: clamp(44px, 7dvh, 72px);
  height: clamp(44px, 7dvh, 72px);
  margin-bottom: 4px;
  border-radius: 22px;
  background: var(--glass-strong);
}
.host .ico {
  background: var(--grad);
  box-shadow: 0 8px 26px rgba(255, 61, 154, 0.4);
}
.join .ico {
  background: linear-gradient(135deg, var(--violet), var(--cyan));
  box-shadow: 0 8px 26px rgba(39, 217, 255, 0.3);
}
.settings .ico {
  background: linear-gradient(135deg, #ffb347, var(--gold));
  color: #3a2600;
  box-shadow: 0 8px 26px rgba(255, 201, 77, 0.28);
}
.name {
  font-size: clamp(1.15rem, 2vw, 1.6rem);
}
.sub {
  font-size: 0.95rem;
}

/* Boîte grisée : pas encore disponible. */
.multi,
.multi:disabled {
  cursor: not-allowed;
  filter: grayscale(0.85);
  opacity: 0.5;
}
.soon {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 12px;
  border-radius: 999px;
  background: var(--gold);
  color: #3a2600;
  font-size: 0.8rem;
}
</style>
