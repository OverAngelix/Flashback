<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { audio, fadeOutExtract, playExtract, stopExtract, unlockAudio } from "@/audio";
import DiscoBall from "@/components/DiscoBall.vue";
import AvatarBadge from "@/components/AvatarBadge.vue";
import BrandMark from "@/components/BrandMark.vue";
import CategoryPicker from "@/components/CategoryPicker.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import Equalizer from "@/components/Equalizer.vue";
import MusicLoader from "@/components/MusicLoader.vue";
import PlayersBar from "@/components/PlayersBar.vue";
import RecapPanel from "@/components/RecapPanel.vue";
import RevealPanel from "@/components/RevealPanel.vue";
import TimelineStrip from "@/components/TimelineStrip.vue";
import VinylDisc from "@/components/VinylDisc.vue";
import { useControls } from "@/composables/useControls";
import { useGame } from "@/composables/useGame";
import { joinBase, joinLink } from "@/joinUrl";
import { qrDataUrl } from "@/qr";

const router = useRouter();
const { connection, view, active } = useGame();
const { chosen, leader, canStart, startBlocker, toggleCategory, start, advance, skipTurn, kick } = useControls();

const joinUrls = ref<string[]>([]);
const lastAudioUrl = ref<string>();
let offAudio: (() => void) | undefined;

function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    advance();
  }
}

onMounted(async () => {
  // Une salle se crée depuis le menu (« Héberger »), dont le clic débloque aussi le son. Un rechargement
  // reprend la partie mémorisée ; sans rien de tout cela, on revient au menu.
  if (!connection.state.session && connection.state.status === "idle" && !connection.resume()) {
    await router.replace("/");
    return;
  }
  offAudio = connection.onAudioPlay((url) => {
    lastAudioUrl.value = url;
    extractTurn = turnKey.value;
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

/** Où en est le tour : avant l'écoute, pendant l'extrait, puis pendant que le joueur place son titre. */
const status = computed(() => {
  const name = active.value?.name ?? "";
  if (!view.value?.listened) return `${name}, lance l'extrait depuis ton téléphone`;
  return audio.playing ? "Écoute…" : `${name} place le titre dans sa frise`;
});

/** Change à chaque phase et à chaque tour : déclenche la transition entre écrans. */
const stageKey = computed(() => (view.value ? `${view.value.phase}-${view.value.round}-${view.value.activePlayerId}` : "loading"));

function reactivateSound() {
  unlockAudio();
  if (lastAudioUrl.value) playExtract(lastAudioUrl.value);
}
/** Quitter l'écran met fin à la partie pour tous : confirmation dès qu'il y a des joueurs. */
const askLeave = ref(false);
function requestLeave() {
  if (view.value && view.value.phase !== "finished" && view.value.players.length > 0) askLeave.value = true;
  else leave();
}
function leave() {
  connection.leave();
  router.push("/");
}

/**
 * L'extrait appartient au tour pendant lequel il a été lancé. Dès qu'on en sort (joueur suivant,
 * récapitulatif, fin de partie, départ du joueur actif), il s'éteint en une seconde.
 */
const turnKey = computed(() => {
  const v = view.value;
  return v && (v.phase === "awaiting-placement" || v.phase === "reveal") ? `${v.round}-${v.activePlayerId}` : null;
});
let extractTurn: string | null = null;
watch(turnKey, (key) => {
  if (extractTurn === null || key === extractTurn) return;
  extractTurn = null;
  fadeOutExtract(1000);
});
</script>

<template>
  <div class="host" @click="audio.blocked && reactivateSound()">
    <header class="top">
      <div class="brand"><BrandMark class="mark" /><span class="display">Flashback</span></div>
      <v-btn v-if="view" icon="mdi-exit-to-app" class="btn-ghost" size="default" title="Mettre fin à la partie" data-testid="host-leave" @click.stop="requestLeave" />
    </header>
    <ConfirmDialog
      v-model="askLeave"
      title="Mettre fin à la partie ?"
      text="La partie s'arrête pour tout le monde : les téléphones reviennent à l'accueil."
      confirm-label="Mettre fin"
      testid="host-leave-confirm"
      @confirm="leave"
    />

    <v-alert v-if="audio.blocked" type="warning" variant="flat" icon="mdi-volume-off" class="mb-4 sound-alert">Touche l'écran pour activer le son.</v-alert>
    <v-alert v-if="connection.state.status === 'reconnecting'" type="warning" variant="tonal" class="mb-4">Connexion au serveur perdue, nouvelle tentative…</v-alert>

    <Transition name="phase" mode="out-in">
      <div :key="stageKey" class="stage">
        <div v-if="!view" class="loading">
          <MusicLoader :size="110" />
          <div class="muted">Création de la salle…</div>
        </div>

        <!-- Salon -->
        <section v-else-if="view.phase === 'lobby'" class="h-lobby">
          <div class="join-panel glass">
            <div class="code-block">
              <div class="muted label">Code de la partie</div>
              <div class="code" data-testid="room-code"><span v-for="(ch, i) in view.code.split('')" :key="i" class="tile display" :style="{ '--i': i }">{{ ch }}</span></div>
            </div>
            <div v-if="qr" class="qr-card">
              <img :src="qr" :data-join-url="qrLink" alt="QR code pour rejoindre la partie" width="176" height="176" data-testid="qr" />
              <div class="qr-label display">Scanne pour rejoindre</div>
            </div>
            <div class="how">
              <div class="display t-md">Rejoins la partie</div>
              <p class="muted">
                Scanne le QR code avec ton téléphone, ou ouvre
                <span class="grad-text url" data-testid="join-url">{{ joinUrl }}</span>
                et entre le code.
              </p>
            </div>
          </div>

          <div class="cols">
            <div class="panel glass">
              <h2 class="display t-md">Joueurs ({{ view.players.length }})</h2>
              <div v-if="view.players.length === 0" class="waiting"><MusicLoader :size="44" /><span class="muted">En attente des premiers joueurs…</span></div>
              <TransitionGroup name="pop" tag="div" class="players">
                <div v-for="p in view.players" :key="p.id" class="player" :class="{ off: !p.connected }">
                  <AvatarBadge :avatar="p.avatar" :size="52" :leader="p.id === view.leaderId" />
                  <span class="display pname text-truncate">{{ p.name }}</span>
                  <v-btn icon="mdi-close" size="x-small" class="btn-ghost kick" title="Exclure" @click.stop="kick(p.id)" />
                </div>
              </TransitionGroup>
              <p v-if="leader" class="muted leader-hint">
                <v-icon icon="mdi-crown" color="warning" size="small" /> {{ leader.name }} est le chef de partie : il peut tout piloter depuis son téléphone.
              </p>
            </div>

            <div class="panel glass">
              <h2 class="display t-md">Catégories</h2>
              <CategoryPicker :categories="view.availableCategories" :chosen="chosen" @toggle="toggleCategory" />
            </div>
          </div>

          <div class="start-row glass">
            <v-btn class="btn-success" size="x-large" prepend-icon="mdi-play" :disabled="!canStart" data-testid="start" @click="start">Lancer la partie</v-btn>
            <span class="muted">{{ startBlocker ?? `${view.trackCount} titres dans le paquet · premier à ${view.cardsToWin} cartes` }}</span>
          </div>
        </section>

        <!-- Un joueur écoute et place son titre -->
        <section v-else-if="view.phase === 'awaiting-placement' && active" class="turn">
          <PlayersBar :players="view.players" :active-id="view.activePlayerId" :leader-id="view.leaderId" groove :guessed-ids="view.grooveGuessIds" />
          <div class="spotlight">
            <VinylDisc :size="260" :spinning="audio.playing" />
            <div class="info">
              <div class="who">
                <AvatarBadge :avatar="active.avatar" :size="84" />
                <div>
                  <div class="muted">Tour {{ view.round }}</div>
                  <div class="display t-lg">{{ active.name }}</div>
                </div>
              </div>
              <div class="status display t-md" data-testid="turn-status">{{ status }}</div>
              <div class="eq-row"><Equalizer :active="audio.playing" /><span class="muted">{{ view.listened ? "Une seule écoute par tour." : "Une seule écoute : bien écouter !" }}</span></div>
              <div class="groove-hint" data-testid="groove-hint">
                <DiscoBall :size="30" />
                <span>
                  Les autres : placez aussi ce titre dans cette frise depuis votre écran, avant {{ active.name }}, pour un point groove.
                  <strong v-if="view.grooveGuessIds.length">{{ view.grooveGuessIds.length }}/{{ view.players.length - 1 }} ont placé.</strong>
                </span>
              </div>
            </div>
          </div>
          <TimelineStrip :cards="active.timeline" />
          <v-alert v-if="!active.connected" type="warning" variant="tonal">
            {{ active.name }} est déconnecté.
            <template #append><v-btn class="btn-ghost" size="small" @click="skipTurn">Passer son tour</v-btn></template>
          </v-alert>
        </section>

        <!-- Révélation -->
        <section v-else-if="view.phase === 'reveal'" class="h-reveal">
          <PlayersBar :players="view.players" :active-id="view.activePlayerId" :leader-id="view.leaderId" groove />
          <RevealPanel :view="view" />
          <div class="next-row">
            <v-btn class="btn-primary" size="x-large" append-icon="mdi-arrow-right" data-testid="advance" @click="advance">Continuer</v-btn>
            <span class="muted">Entrée ou Espace · le chef de partie peut aussi continuer depuis son téléphone</span>
          </div>
        </section>

        <!-- Récapitulatif de fin de tour -->
        <section v-else-if="view.phase === 'round-recap'" class="h-recap">
          <RecapPanel :view="view" />
          <div class="next-row">
            <v-btn class="btn-primary" size="x-large" append-icon="mdi-arrow-right" data-testid="advance" @click="advance">Tour suivant</v-btn>
          </div>
        </section>

        <!-- Fin de partie -->
        <section v-else-if="view.phase === 'finished'" class="h-recap">
          <RecapPanel :view="view" final />
          <div class="next-row"><v-btn class="btn-primary" size="x-large" prepend-icon="mdi-home" @click="leave">Nouvelle partie</v-btn></div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.host {
  min-height: 100dvh;
  padding: 20px clamp(16px, 3vw, 44px) 40px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
}
.mark {
  width: 34px;
  height: 34px;
}
.sound-alert {
  font-family: var(--font-display);
  font-size: 1.2rem;
}
.stage {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 12vh 0;
}

/* Salon : informations de la partie, puis deux panneaux séparés, puis le lancement. */
.h-lobby {
  display: flex;
  flex-direction: column;
  gap: clamp(20px, 4dvh, 40px);
}
.join-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px clamp(24px, 3vw, 44px);
  padding: clamp(16px, 2.2vw, 26px) clamp(18px, 2.6vw, 34px);
  background: linear-gradient(135deg, rgba(255, 61, 154, 0.22), rgba(124, 92, 255, 0.22));
  border-color: rgba(255, 255, 255, 0.22);
}
.label {
  margin-bottom: 8px;
  font-size: 1rem;
}
.code {
  display: flex;
  gap: clamp(6px, 1vw, 12px);
}
.tile {
  display: grid;
  place-items: center;
  width: clamp(40px, 5.2vw, 76px);
  height: clamp(54px, 6.8vw, 100px);
  border-radius: 18px;
  background: #fff;
  color: #1a1340;
  font-size: clamp(1.8rem, 4.2vw, 3.6rem);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  animation: drop 0.6s cubic-bezier(0.2, 1.3, 0.4, 1) both;
  animation-delay: calc(var(--i) * 70ms);
}
.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 10px;
  border-radius: 24px;
  background: #fff;
  color: #1a1340;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4);
}
.qr-card img {
  display: block;
  border-radius: 10px;
}
.qr-label {
  font-size: 1rem;
}
.how {
  flex: 1;
  min-width: 240px;
  max-width: 460px;
}
.how p {
  margin: 6px 0 0;
  font-size: 1.05rem;
  line-height: 1.5;
}
.url {
  display: block;
  margin: 2px 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.2rem;
}
.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
  gap: clamp(18px, 3vw, 32px);
  align-items: start;
}
.panel {
  padding: clamp(18px, 2.4vw, 28px);
}
.panel h2 {
  margin: 0 0 16px;
}
.players {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.player {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  padding: 8px 8px 8px 12px;
  border-radius: 999px;
  background: var(--glass-strong);
  border: 1px solid var(--border);
}
.player.off {
  opacity: 0.5;
}
.pname {
  font-size: 1.2rem;
}
.kick {
  opacity: 0.6;
}
.waiting {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 0 8px;
}
.leader-hint {
  margin: 18px 0 0;
}
.start-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding: 18px 24px;
}
.next-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}

/* Tour */
.turn {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.spotlight {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: clamp(24px, 5vw, 64px);
}
.info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 18px;
  min-width: 280px;
}
.who {
  display: flex;
  align-items: center;
  gap: 18px;
}
.status {
  line-height: 1.2;
}
.eq-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.groove-hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 620px;
  font-size: 1.05rem;
  line-height: 1.35;
}
.groove-hint strong {
  color: var(--gold);
}
.h-reveal,
.h-recap {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-28px) rotate(-6deg);
  }
}
.pop-enter-active {
  transition: all 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.pop-leave-active {
  transition: all 0.25s ease;
  position: absolute;
}
.pop-leave-to {
  opacity: 0;
  transform: scale(0.7);
}
</style>
