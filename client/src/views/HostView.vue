<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { audio, playExtract, stopExtract, unlockAudio } from "@/audio";
import AvatarBadge from "@/components/AvatarBadge.vue";
import PlayersBar from "@/components/PlayersBar.vue";
import RecapPanel from "@/components/RecapPanel.vue";
import RevealPanel from "@/components/RevealPanel.vue";
import TimelineStrip from "@/components/TimelineStrip.vue";
import { useGame } from "@/composables/useGame";
import { joinBase, joinLink } from "@/joinUrl";
import { qrDataUrl } from "@/qr";
import { MIN_PLAYERS } from "@server/game/types";

const router = useRouter();
const { connection, view, active } = useGame();

const joinUrls = ref<string[]>([]);

const lastAudioUrl = ref<string>();
let offAudio: (() => void) | undefined;

function advance() {
  const phase = view.value?.phase;
  // `from` rend un double clic (ou Entrée sur le bouton) inoffensif : le serveur ignore le second.
  if (phase === "reveal" || phase === "round-recap") connection.send({ type: "host:advance", from: phase });
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    advance();
  }
}

onMounted(async () => {
  // Arrivée directe (rechargement) sans session : on en crée une, ou on reprend celle mémorisée.
  if (!connection.state.session && !connection.resume()) connection.createRoom();
  offAudio = connection.onAudioPlay((url) => {
    lastAudioUrl.value = url;
    playExtract(url);
  });
  window.addEventListener("keydown", onKey);
  try {
    const res = await fetch("/api/network");
    joinUrls.value = ((await res.json()) as { urls: string[] }).urls;
  } catch {
    joinUrls.value = [];
  }
});
onUnmounted(() => {
  offAudio?.();
  stopExtract();
  window.removeEventListener("keydown", onKey);
});

/** Adresse que les téléphones peuvent joindre (jamais localhost) : texte à taper et QR code. */
const base = computed(() => joinBase(location, joinUrls.value));
const joinUrl = computed(() => `${base.value}/play`);
const qrLink = computed(() => (view.value ? joinLink(base.value, view.value.code) : null));
const qr = ref<string>();
watch(
  qrLink,
  async (link) => {
    qr.value = link ? await qrDataUrl(link) : undefined;
  },
  { immediate: true },
);

const chosen = computed(() => new Set(view.value?.categories ?? []));
function toggleCategory(id: string) {
  const next = new Set(chosen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  connection.send({ type: "host:setCategories", categories: [...next] });
}

const canStart = computed(() => (view.value?.players.length ?? 0) >= MIN_PLAYERS && chosen.value.size > 0);

/** Où en est le tour : avant l'écoute, pendant l'extrait, puis pendant que le joueur place son titre. */
const status = computed(() => {
  const name = active.value?.name ?? "";
  if (!view.value?.listened) return `${name}, lance l'extrait depuis ton téléphone`;
  return audio.playing ? "Écoute…" : `${name} place le titre dans sa frise`;
});

function reactivateSound() {
  unlockAudio();
  if (lastAudioUrl.value) playExtract(lastAudioUrl.value);
}
function leave() {
  connection.leave();
  router.push("/");
}
</script>

<template>
  <v-container fluid class="pa-6" @click="audio.blocked && reactivateSound()">
    <v-alert v-if="audio.blocked" type="warning" variant="flat" icon="mdi-volume-off" class="mb-4 text-title-large">
      Touche l'écran pour activer le son.
    </v-alert>
    <v-alert v-if="connection.state.status === 'reconnecting'" type="warning" variant="tonal" class="mb-4">
      Connexion au serveur perdue, nouvelle tentative…
    </v-alert>

    <div v-if="!view" class="d-flex justify-center pa-12">
      <v-progress-circular indeterminate size="64" />
    </div>

    <!-- Salon -->
    <div v-else-if="view.phase === 'lobby'" class="d-flex flex-column ga-8">
      <div class="d-flex flex-column flex-md-row ga-8 align-center">
        <v-sheet rounded="xl" class="pa-8 text-center" color="primary">
          <div class="text-title-large">Code de la partie</div>
          <div class="code font-weight-black" data-testid="room-code">{{ view.code }}</div>
        </v-sheet>
        <v-sheet v-if="qr" rounded="xl" class="qr pa-2 flex-shrink-0" color="white">
          <img :src="qr" :data-join-url="qrLink" alt="QR code pour rejoindre la partie" width="200" height="200" data-testid="qr" />
        </v-sheet>
        <div class="text-headline-small">
          Scanne le QR code avec ton téléphone,
          <div class="text-title-large text-medium-emphasis mt-2">
            ou ouvre
            <span class="text-primary font-weight-bold" data-testid="join-url">{{ joinUrl }}</span>
            et entre le code.
          </div>
        </div>
      </div>

      <div>
        <div class="text-title-large mb-3">Catégories</div>
        <div class="d-flex flex-wrap ga-3">
          <v-chip
            v-for="c in view.availableCategories"
            :key="c.id"
            size="x-large"
            :variant="chosen.has(c.id) ? 'flat' : 'outlined'"
            :prepend-icon="chosen.has(c.id) ? 'mdi-check' : undefined"
            :color="chosen.has(c.id) ? 'primary' : undefined"
            :data-testid="`category-${c.id}`"
            @click="toggleCategory(c.id)"
          >
            {{ c.label }} · {{ c.count }}
          </v-chip>
        </div>
      </div>

      <div>
        <div class="text-title-large mb-3">Joueurs ({{ view.players.length }})</div>
        <div v-if="view.players.length === 0" class="text-medium-emphasis">En attente des premiers joueurs…</div>
        <div class="d-flex flex-wrap ga-3">
          <v-chip v-for="p in view.players" :key="p.id" size="x-large" closable close-icon="mdi-account-remove" :class="{ 'opacity-60': !p.connected }" @click:close="connection.send({ type: 'host:kick', playerId: p.id })">
            <template #prepend><AvatarBadge :avatar="p.avatar" :size="36" class="mr-2" /></template>
            {{ p.name }}
          </v-chip>
        </div>
      </div>

      <div class="d-flex align-center ga-4">
        <v-btn color="success" size="x-large" prepend-icon="mdi-play" :disabled="!canStart" data-testid="start" @click="connection.send({ type: 'host:start' })">
          Lancer la partie
        </v-btn>
        <span v-if="view.players.length < MIN_PLAYERS" class="text-medium-emphasis">Il faut au moins {{ MIN_PLAYERS }} joueurs.</span>
        <span v-else-if="chosen.size === 0" class="text-medium-emphasis">Choisis au moins une catégorie.</span>
        <span v-else class="text-medium-emphasis">{{ view.trackCount }} titres dans le paquet · premier à {{ view.cardsToWin }} cartes.</span>
      </div>
    </div>

    <!-- Un joueur écoute et place son titre -->
    <div v-else-if="view.phase === 'awaiting-placement' && active" class="d-flex flex-column ga-6">
      <PlayersBar :players="view.players" :active-id="view.activePlayerId" />
      <div class="d-flex align-center ga-4">
        <AvatarBadge :avatar="active.avatar" :size="96" />
        <div>
          <div class="text-display-small font-weight-bold">{{ active.name }}</div>
          <div class="text-title-large text-medium-emphasis">Tour {{ view.round }}</div>
        </div>
      </div>
      <v-sheet rounded="xl" class="pa-8 text-center">
        <v-icon :icon="audio.playing ? 'mdi-music-note' : view.listened ? 'mdi-gesture-tap' : 'mdi-cellphone-sound'" size="72" :color="audio.playing ? 'primary' : undefined" />
        <div class="text-headline-large mt-2" data-testid="turn-status">{{ status }}</div>
        <div class="text-medium-emphasis mt-1">{{ view.listened ? "Une seule écoute par tour." : "Une seule écoute : bien écouter !" }}</div>
      </v-sheet>
      <TimelineStrip :cards="active.timeline" />
      <v-alert v-if="!active.connected" type="warning" variant="tonal">
        {{ active.name }} est déconnecté.
        <template #append>
          <v-btn variant="flat" @click="connection.send({ type: 'host:skipTurn' })">Passer son tour</v-btn>
        </template>
      </v-alert>
    </div>

    <!-- Révélation -->
    <div v-else-if="view.phase === 'reveal'" class="d-flex flex-column ga-6">
      <PlayersBar :players="view.players" :active-id="view.activePlayerId" />
      <RevealPanel :view="view" />
      <v-btn color="primary" size="x-large" class="align-self-start" append-icon="mdi-arrow-right" data-testid="advance" @click="advance">Continuer</v-btn>
    </div>

    <!-- Récapitulatif de fin de tour -->
    <div v-else-if="view.phase === 'round-recap'" class="d-flex flex-column ga-6">
      <RecapPanel :view="view" />
      <v-btn color="primary" size="x-large" class="align-self-start" append-icon="mdi-arrow-right" data-testid="advance" @click="advance">Tour suivant</v-btn>
    </div>

    <!-- Fin de partie -->
    <div v-else-if="view.phase === 'finished'" class="d-flex flex-column ga-6">
      <RecapPanel :view="view" final />
      <v-btn color="primary" size="x-large" class="align-self-start" prepend-icon="mdi-home" @click="leave">Nouvelle partie</v-btn>
    </div>

    <v-btn v-if="view" icon="mdi-exit-to-app" variant="text" class="exit" title="Quitter" @click.stop="leave" />
  </v-container>
</template>

<style scoped>
.code {
  font-size: clamp(3rem, 12vw, 8rem);
  letter-spacing: 0.15em;
  line-height: 1.1;
}
.qr img {
  display: block;
  border-radius: 12px;
}
.exit {
  position: fixed;
  top: 8px;
  right: 8px;
}
</style>
