<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AvatarBadge from "@/components/AvatarBadge.vue";
import CategoryPicker from "@/components/CategoryPicker.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import MusicLoader from "@/components/MusicLoader.vue";
import PlayJoin from "@/components/PlayJoin.vue";
import PlayTurn from "@/components/PlayTurn.vue";
import PlayersBar from "@/components/PlayersBar.vue";
import RecapPanel from "@/components/RecapPanel.vue";
import RevealPanel from "@/components/RevealPanel.vue";
import RotateOverlay from "@/components/RotateOverlay.vue";
import TimelineStrip from "@/components/TimelineStrip.vue";
import { useControls } from "@/composables/useControls";
import { useGame } from "@/composables/useGame";
import { usePortraitPhone } from "@/composables/useOrientation";

const props = defineProps<{ code?: string }>();

const router = useRouter();
const { connection, view, me, active, isMyTurn } = useGame();
const { chosen, isLeader, leader, canStart, startBlocker, toggleCategory, start, advance, skipTurn } = useControls();
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
const stageKey = computed(() => (view.value ? `${view.value.phase}-${view.value.round}-${view.value.activePlayerId}` : "loading"));

/** Pendant la partie, quitter retire le joueur et sa frise : on demande confirmation. */
const canLeaveInGame = computed(() => inGame.value && view.value?.phase !== "finished");
const askLeave = ref(false);

function leave() {
  connection.leave();
  router.push("/");
}
</script>

<template>
  <div class="screen">
    <RotateOverlay v-if="portrait && inGame" />

    <template v-if="canLeaveInGame && me">
      <v-btn icon="mdi-exit-to-app" class="btn-ghost exit" size="small" title="Quitter la partie" aria-label="Quitter la partie" data-testid="leave-game" @click="askLeave = true" />
      <ConfirmDialog
        v-model="askLeave"
        title="Quitter la partie ?"
        text="Ta frise sera perdue et tu ne pourras pas revenir dans cette partie. Les autres continuent sans toi."
        confirm-label="Quitter"
        testid="leave-confirm"
        @confirm="leave"
      />
    </template>

    <PlayJoin v-if="!connection.state.session" :initial-code="code" />

    <div v-else-if="!view || !me" class="loading">
      <MusicLoader :size="96" />
      <div class="muted">Connexion à la partie…</div>
    </div>

    <Transition v-else name="phase" mode="out-in">
      <div :key="stageKey" class="play" :class="{ 'in-game': canLeaveInGame }">
        <div v-if="connection.state.status === 'reconnecting'" class="reconnect glass"><MusicLoader :size="22" /> Reconnexion…</div>

        <!-- Salon -->
        <section v-if="view.phase === 'lobby'" class="p-lobby">
          <header class="me-head">
            <AvatarBadge :avatar="me.avatar" :size="76" :leader="isLeader" />
            <div class="min-width-0">
              <div class="display t-md text-truncate">{{ me.name }}</div>
              <div class="muted">Partie <span class="display">{{ view.code }}</span></div>
            </div>
          </header>

          <template v-if="isLeader">
            <div class="banner glass" data-testid="leader-banner">
              <v-icon icon="mdi-crown" color="warning" size="28" />
              <div>
                <div class="display">Tu es le chef de partie</div>
                <div class="muted small">Choisis les catégories et lance la partie quand tout le monde est là.</div>
              </div>
            </div>
            <CategoryPicker :categories="view.availableCategories" :chosen="chosen" testid-prefix="leader-category" @toggle="toggleCategory" />
            <v-btn class="btn-success w-100" size="x-large" prepend-icon="mdi-play" :disabled="!canStart" data-testid="leader-start" @click="start">Lancer la partie</v-btn>
            <div v-if="startBlocker" class="muted small text-center">{{ startBlocker }}</div>
          </template>
          <div v-else class="wait glass" data-testid="wait">
            <MusicLoader :size="56" />
            <div>
              <div class="display">En attente du lancement…</div>
              <div v-if="leader" class="muted small">{{ leader.name }} lance la partie.</div>
            </div>
          </div>

          <div class="muted label">Joueurs ({{ view.players.length }})</div>
          <PlayersBar :players="view.players" :leader-id="view.leaderId" compact />
          <v-btn class="btn-ghost" size="default" prepend-icon="mdi-exit-to-app" @click="leave">Quitter</v-btn>
        </section>

        <!-- Mon tour -->
        <PlayTurn v-else-if="view.phase === 'awaiting-placement' && isMyTurn" :me="me" :listened="view.listened" :leader="isLeader" />

        <!-- Le tour d'un autre : l'écran principal montre sa frise, la manette montre la mienne -->
        <section v-else-if="view.phase === 'awaiting-placement' && active" class="p-watch">
          <div class="watch-head">
            <AvatarBadge :avatar="active.avatar" :size="40" :leader="active.id === view.leaderId" />
            <div class="display t-md min-width-0 text-truncate">{{ active.name }} réfléchit…</div>
            <v-btn v-if="isLeader && !active.connected" class="btn-ghost ml-auto" size="small" data-testid="leader-skip" @click="skipTurn">Passer son tour</v-btn>
          </div>
          <div class="muted small">Ta frise</div>
          <TimelineStrip :cards="me.timeline" />
        </section>

        <!-- Révélation : le chef peut continuer depuis son téléphone -->
        <section v-else-if="view.phase === 'reveal'" class="p-reveal">
          <RevealPanel :view="view" compact :viewer-id="me.id" :note="isLeader ? undefined : 'En attente de la suite…'">
            <template #action>
              <v-btn v-if="isLeader" class="btn-primary" size="default" append-icon="mdi-arrow-right" data-testid="leader-advance" @click="advance">Continuer</v-btn>
            </template>
          </RevealPanel>
        </section>

        <section v-else-if="view.phase === 'round-recap'" class="p-recap">
          <RecapPanel :view="view" :viewer-id="me.id" />
          <v-btn v-if="isLeader" class="btn-primary w-100" size="x-large" append-icon="mdi-arrow-right" data-testid="leader-advance" @click="advance">Tour suivant</v-btn>
          <div v-else class="muted text-center small">En attente de la suite…</div>
        </section>

        <section v-else-if="view.phase === 'finished'" class="p-recap">
          <RecapPanel :view="view" final :viewer-id="me.id" />
          <v-btn class="btn-primary" prepend-icon="mdi-home" @click="leave">Retour à l'accueil</v-btn>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24vh 16px 0;
}
.play {
  position: relative;
}
/* Toujours accessible pendant la partie, dans le coin laissé libre par chaque écran. */
.exit.v-btn {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 50;
}
.reconnect {
  position: fixed;
  top: 10px;
  left: 50%;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  transform: translateX(-50%);
  font-size: 0.85rem;
}
.p-lobby,
.p-watch,
.p-reveal,
.p-recap {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 920px;
  margin: 0 auto;
  padding: 16px;
}
.p-watch,
.p-reveal {
  gap: 6px;
  padding: 10px 12px;
}
.in-game > section {
  padding-right: 56px;
}
.me-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 18px;
}
.banner,
.wait {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
}
.banner {
  background: linear-gradient(135deg, rgba(255, 201, 77, 0.18), rgba(255, 61, 154, 0.14));
}
.small {
  font-size: 0.9rem;
}
.label {
  margin-top: 4px;
}
.p-watch-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
