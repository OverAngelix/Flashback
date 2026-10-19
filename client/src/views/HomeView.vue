<script setup lang="ts">
import { useRouter } from "vue-router";
import { unlockAudio } from "@/audio";
import { useConnection } from "@/net/connection";

const router = useRouter();
const connection = useConnection();

function createGame() {
  // Ce clic débloque l'audio du navigateur : l'écran hôte jouera ensuite les extraits sans autre geste.
  unlockAudio();
  connection.createRoom();
  router.push("/host");
}
</script>

<template>
  <v-container class="fill-height d-flex flex-column align-center justify-center text-center ga-6">
    <v-icon icon="mdi-music-circle" size="96" color="primary" />
    <h1 class="text-display-medium font-weight-black">Flashback</h1>
    <p class="text-title-large text-medium-emphasis">Écoute l'extrait, place-le dans ta frise.</p>

    <v-alert v-if="connection.state.sessionLost" type="warning" variant="tonal" max-width="480" closable>
      La partie que tu avais en cours n'existe plus.
    </v-alert>
    <v-alert v-if="connection.state.kicked" type="info" variant="tonal" max-width="480" closable>
      L'hôte t'a retiré de la partie.
    </v-alert>

    <div class="d-flex flex-column flex-sm-row ga-4">
      <v-btn color="primary" size="x-large" prepend-icon="mdi-television-play" @click="createGame">Créer une partie</v-btn>
      <v-btn color="secondary" size="x-large" prepend-icon="mdi-cellphone" to="/play">Rejoindre</v-btn>
    </div>
    <p class="text-body-small text-medium-emphasis">« Créer » sur le PC ou la télé (l'écran ne joue pas), « Rejoindre » sur chaque téléphone.</p>
  </v-container>
</template>
