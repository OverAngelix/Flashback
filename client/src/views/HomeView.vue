<script setup lang="ts">
import { useRouter } from "vue-router";
import { unlockAudio } from "@/audio";
import VinylDisc from "@/components/VinylDisc.vue";
import { useConnection } from "@/net/connection";

const router = useRouter();
const connection = useConnection();

function createGame() {
  // Ce clic débloque l'audio du navigateur : l'écran hôte jouera ensuite les extraits sans autre geste.
  unlockAudio();
  connection.createRoom();
  router.push("/host");
}

const steps = [
  { icon: "mdi-headphones", text: "Écoute l'extrait" },
  { icon: "mdi-cursor-move", text: "Place-le dans ta frise" },
  { icon: "mdi-trophy", text: "Premier à 10 cartes" },
];
</script>

<template>
  <div class="home">
    <div class="hero">
      <div class="disc"><VinylDisc :size="200" spinning /></div>
      <h1 class="display t-xl grad-text">Flashback</h1>
      <p class="tag muted">Écoute l'extrait, remets la musique dans l'ordre.</p>
    </div>

    <v-alert v-if="connection.state.sessionLost" type="warning" variant="tonal" class="notice" closable>La partie que tu avais en cours n'existe plus.</v-alert>
    <v-alert v-if="connection.state.kicked" type="info" variant="tonal" class="notice" closable>L'hôte t'a retiré de la partie.</v-alert>

    <div class="actions">
      <button type="button" class="action glass" data-testid="create" @click="createGame">
        <span class="ico host"><v-icon icon="mdi-television-play" size="34" /></span>
        <span class="txt">
          <span class="display t-md">Créer une partie</span>
          <span class="muted">Sur la télé ou le PC</span>
        </span>
      </button>
      <router-link to="/play" class="action glass" data-testid="join-link">
        <span class="ico player"><v-icon icon="mdi-cellphone" size="34" /></span>
        <span class="txt">
          <span class="display t-md">Rejoindre</span>
          <span class="muted">Avec ton téléphone</span>
        </span>
      </router-link>
    </div>

    <ol class="steps">
      <li v-for="(s, i) in steps" :key="s.text" class="glass">
        <span class="num display">{{ i + 1 }}</span>
        <v-icon :icon="s.icon" />
        <span>{{ s.text }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  min-height: 100dvh;
  padding: 28px 20px 40px;
  text-align: center;
  justify-content: center;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.hero h1 {
  margin: 0;
}
.disc {
  margin-bottom: 6px;
  filter: drop-shadow(0 0 40px rgba(124, 92, 255, 0.45));
}
.tag {
  margin: 0;
  font-size: clamp(1rem, 3vw, 1.35rem);
}
.notice {
  max-width: 520px;
}
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
  gap: 16px;
  width: min(100%, 680px);
}
.action {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 22px;
  color: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.2s;
}
.action:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 16px 40px rgba(124, 92, 255, 0.3);
}
.action:active {
  transform: scale(0.98);
}
.ico {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 20px;
}
.ico.host {
  background: var(--grad);
  box-shadow: 0 8px 24px rgba(255, 61, 154, 0.4);
}
.ico.player {
  background: linear-gradient(135deg, var(--violet), var(--cyan));
  box-shadow: 0 8px 24px rgba(39, 217, 255, 0.3);
}
.action .t-md {
  font-size: 1.5rem;
}
.txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 8px 10px;
  border-radius: 999px;
  font-size: 0.95rem;
}
.num {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--grad);
  font-size: 0.85rem;
}
</style>
