<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import AvatarBadge from "@/components/AvatarBadge.vue";
import PlayJoin from "@/components/PlayJoin.vue";
import PlayTurn from "@/components/PlayTurn.vue";
import PlayersBar from "@/components/PlayersBar.vue";
import RecapPanel from "@/components/RecapPanel.vue";
import RevealPanel from "@/components/RevealPanel.vue";
import RotateOverlay from "@/components/RotateOverlay.vue";
import TimelineStrip from "@/components/TimelineStrip.vue";
import { useGame } from "@/composables/useGame";
import { usePortraitPhone } from "@/composables/useOrientation";
import { onMounted } from "vue";

const props = defineProps<{ code?: string }>();

const router = useRouter();
const { connection, view, me, active, isMyTurn } = useGame();
const portrait = usePortraitPhone();

onMounted(() => {
  // Un lien /join/CODE vers une autre salle l'emporte sur une ancienne session mémorisée.
  const wanted = props.code?.toUpperCase();
  const current = connection.state.session;
  if (wanted && current && current.code !== wanted) connection.leave();
  else if (!current) connection.resume();
});

// En partie, le téléphone doit être en paysage ; le salon et la saisie du nom restent possibles en portrait.
const inGame = computed(() => !!view.value && view.value.phase !== "lobby");

function leave() {
  if (view.value?.phase === "lobby") connection.send({ type: "player:leave" });
  connection.leave();
  router.push("/");
}
</script>

<template>
  <RotateOverlay v-if="portrait && inGame" />

  <PlayJoin v-if="!connection.state.session" :initial-code="code" />

  <div v-else-if="!view || !me" class="d-flex justify-center pa-12">
    <v-progress-circular indeterminate size="64" />
  </div>

  <!-- Salon -->
  <v-container v-else-if="view.phase === 'lobby'" class="d-flex flex-column align-center text-center ga-4" style="max-width: 560px">
    <AvatarBadge :avatar="me.avatar" :size="96" />
    <div class="text-headline-large font-weight-bold">{{ me.name }}</div>
    <div class="text-title-large text-medium-emphasis">Tu es dans la partie {{ view.code }}.<br />En attente du lancement…</div>
    <PlayersBar :players="view.players" compact />
    <v-btn variant="text" prepend-icon="mdi-exit-to-app" @click="leave">Quitter</v-btn>
  </v-container>

  <!-- Mon tour -->
  <PlayTurn v-else-if="view.phase === 'awaiting-placement' && isMyTurn" :me="me" :listened="view.listened" />

  <!-- Le tour d'un autre : l'écran principal montre sa frise, la manette montre la mienne -->
  <v-container v-else-if="view.phase === 'awaiting-placement' && active" fluid class="d-flex flex-column ga-2">
    <div class="d-flex align-center ga-3">
      <AvatarBadge :avatar="active.avatar" :size="40" />
      <div class="text-title-large">{{ active.name }} réfléchit…</div>
    </div>
    <div class="text-label-large text-medium-emphasis">Ta frise</div>
    <TimelineStrip :cards="me.timeline" />
  </v-container>

  <v-container v-else-if="view.phase === 'reveal'" fluid class="pa-2">
    <RevealPanel :view="view" compact :viewer-id="me.id" note="En attente de l'écran…" />
  </v-container>

  <v-container v-else-if="view.phase === 'round-recap'" fluid>
    <RecapPanel :view="view" :viewer-id="me.id" />
  </v-container>

  <v-container v-else-if="view.phase === 'finished'" fluid class="d-flex flex-column ga-3">
    <RecapPanel :view="view" final :viewer-id="me.id" />
    <v-btn color="primary" prepend-icon="mdi-home" class="align-self-start" @click="leave">Retour à l'accueil</v-btn>
  </v-container>
</template>
