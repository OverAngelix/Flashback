<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { CAMPAIGN, campaignLevel } from "@server/game/campaign";
import { fadeOutExtract, stopExtract } from "@/audio";
import CategoryPicker from "@/components/CategoryPicker.vue";
import Confetti from "@/components/Confetti.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import LivesBar from "@/components/LivesBar.vue";
import MusicLoader from "@/components/MusicLoader.vue";
import PlayTurn from "@/components/PlayTurn.vue";
import RevealPanel from "@/components/RevealPanel.vue";
import RotateOverlay from "@/components/RotateOverlay.vue";
import StarRating from "@/components/StarRating.vue";
import TimelineStrip from "@/components/TimelineStrip.vue";
import { useControls } from "@/composables/useControls";
import { useGame } from "@/composables/useGame";
import { usePortraitPhone } from "@/composables/useOrientation";
import { useSoloStart } from "@/composables/useSoloStart";
import { recordScore, recordStars, selectionKey, starsFor, useSoloProgress } from "@/soloProgress";

/**
 * Partie solo : cet appareil est à la fois l'écran (il joue l'extrait) et la manette. Partie libre :
 * choix des catégories, puis jusqu'à la dernière vie. Campagne : le niveau démarre tout de suite.
 */
const router = useRouter();
const { connection, view, me } = useGame();
const { chosen, toggleCategory, clearCategories, start, advance } = useControls();
const portrait = usePortraitPhone();
const progress = useSoloProgress();
const startSolo = useSoloStart();

onMounted(() => {
  // Rechargement : on reprend la partie mémorisée ; sans partie (ni création en cours), retour au menu solo.
  if (!connection.state.session && connection.state.status === "idle" && !connection.resume()) void router.replace("/solo");
});
onUnmounted(stopExtract);

const solo = computed(() => view.value?.solo ?? null);
// Une session mémorisée qui n'est pas une partie solo se joue sur la manette habituelle.
watch(view, (v) => v && !v.solo && void router.replace("/play"), { immediate: true });

const level = computed(() => (solo.value?.level ? (campaignLevel(solo.value.level) ?? null) : null));
const nextLevel = computed(() => {
  const index = CAMPAIGN.findIndex((l) => l.id === level.value?.id);
  return index >= 0 ? CAMPAIGN[index + 1] : undefined;
});
const levelNumber = computed(() => (level.value ? CAMPAIGN.indexOf(level.value) + 1 : 0));
const cards = computed(() => me.value?.timeline.length ?? 0);
const playing = computed(() => view.value?.phase === "awaiting-placement" || view.value?.phase === "reveal");

/**
 * Un niveau démarre dès sa création (aussi par « Niveau suivant ») : avant le premier titre, une fiche
 * dit lequel c'est. Elle se ferme d'un geste, une fois par partie (code de la salle).
 */
const introSeen = ref<string | null>(null);
const showIntro = computed(() => {
  const v = view.value;
  return !!level.value && !!v && v.phase === "awaiting-placement" && v.round === 1 && !v.listened && introSeen.value !== v.code;
});
const levelStars = computed(() => (level.value ? (progress.stars[level.value.id] ?? 0) : 0));

const stageKey = computed(() => (view.value ? (showIntro.value ? "intro" : `${view.value.phase}-${view.value.round}`) : "loading"));

/** Où en est la frise : « 3 / 5 cartes » en campagne, « 3 cartes » en partie libre. */
const progressText = computed(() => {
  const goal = solo.value?.goal;
  return goal ? `${cards.value} / ${goal} cartes` : `${cards.value} carte${cards.value > 1 ? "s" : ""}`;
});
/** La révélation en cours est la dernière : plus de vie, ou objectif atteint. */
const lastReveal = computed(() => {
  const s = solo.value;
  return !!s && (s.lives <= 0 || (s.goal !== null && cards.value >= s.goal));
});
/** Paquet de la partie libre trop petit pour jouer : il faut une carte de départ et un titre. */
const tooFewTracks = computed(() => (view.value?.trackCount ?? 0) < 2);
const selectionRecord = computed(() => progress.records[selectionKey(view.value?.categories ?? [])]);

// L'extrait appartient à son titre : il s'éteint en une seconde quand on passe au suivant ou à la fin.
watch(
  () => (playing.value ? view.value?.round : null),
  (round, previous) => {
    if (previous != null && round !== previous) fadeOutExtract(1000);
  },
);

/** Résultat figé à la fin de la partie, avec ce qu'il change dans la progression. */
interface Outcome {
  code: string;
  won: boolean;
  stars: number;
  /** Campagne : une note précédente du niveau est battue. */
  improved: boolean;
  /** Partie libre : ancien record de cette sélection. */
  previous: number | undefined;
}
const outcome = ref<Outcome | null>(null);
watch(
  () => (view.value?.phase === "finished" ? view.value.code : null),
  (code) => {
    const v = view.value;
    if (!code || !v?.solo || !me.value || outcome.value?.code === code) return;
    const won = v.winnerIds.includes(me.value.id);
    const stars = level.value ? starsFor(won, v.solo.lives) : 0;
    const before = level.value ? (progress.stars[level.value.id] ?? 0) : 0;
    const raised = level.value ? recordStars(progress, level.value.id, stars) : false;
    outcome.value = {
      code,
      won,
      stars,
      improved: raised && before > 0,
      previous: level.value ? undefined : recordScore(progress, selectionKey(v.categories), cards.value),
    };
  },
  { immediate: true },
);
/** Record battu (la carte de départ seule ne compte pas comme un exploit). */
const newRecord = computed(() => !!outcome.value && !level.value && cards.value > 1 && cards.value > (outcome.value.previous ?? 0));

const endTitle = computed(() => {
  const o = outcome.value;
  if (!o) return "";
  if (level.value) return o.won ? "Niveau réussi !" : "Plus de vies…";
  return o.won ? "Paquet épuisé, bravo !" : "Partie terminée";
});

const askLeave = ref(false);
function leave() {
  connection.leave();
  void router.push("/solo");
}
/** Recommence : le même niveau, ou une partie libre avec les mêmes catégories, lancée tout de suite. */
function replay() {
  if (level.value) return startSolo(level.value.id);
  const categories = [...(view.value?.categories ?? [])];
  startSolo(null, [{ type: "host:setCategories", categories }, { type: "host:start" }]);
}
</script>

<template>
  <div class="s-screen">
    <RotateOverlay v-if="portrait && playing" />

    <template v-if="playing">
      <v-btn icon="mdi-exit-to-app" class="btn-ghost s-exit" size="small" title="Abandonner" aria-label="Abandonner la partie" data-testid="solo-leave" @click="askLeave = true" />
      <ConfirmDialog v-model="askLeave" title="Abandonner la partie ?" text="Cette partie s'arrête là et ne compte pas." confirm-label="Abandonner" testid="solo-leave-confirm" @confirm="leave" />
    </template>

    <div v-if="!view || !me || !solo" class="s-loading">
      <MusicLoader :size="96" />
      <div class="muted">Préparation de la partie…</div>
    </div>

    <Transition v-else name="phase" mode="out-in">
      <div :key="stageKey" class="s-stage" :class="{ 'in-game': playing }">
        <div v-if="connection.state.status === 'reconnecting'" class="s-reconnect glass"><MusicLoader :size="22" /> Reconnexion…</div>

        <!-- Partie libre : choix des catégories -->
        <section v-if="view.phase === 'lobby'" class="s-lobby">
          <header class="s-lobby-head">
            <v-btn icon="mdi-arrow-left" class="btn-ghost" size="default" title="Retour" aria-label="Retour" @click="leave" />
            <div>
              <div class="display t-md">Partie libre</div>
              <div class="muted s-small">Va le plus loin possible : la partie s'arrête à la troisième erreur.</div>
            </div>
          </header>
          <CategoryPicker :categories="view.availableCategories" :chosen="chosen" testid-prefix="solo-category" @toggle="toggleCategory" @clear="clearCategories" />
          <v-btn class="btn-success w-100" size="x-large" prepend-icon="mdi-play" :disabled="tooFewTracks" data-testid="solo-start" @click="start">Lancer la partie</v-btn>
          <div class="muted s-small text-center" data-testid="solo-track-count">
            <template v-if="tooFewTracks">Pas assez de titres pour cette sélection : décoche une catégorie.</template>
            <template v-else>{{ view.trackCount }} titres dans le paquet<template v-if="selectionRecord"> · record : {{ selectionRecord }} cartes</template></template>
          </div>
        </section>

        <!-- Campagne : présentation du niveau avant le premier titre -->
        <section v-else-if="showIntro && level" class="s-intro" data-testid="solo-intro">
          <div class="muted" data-testid="solo-intro-number">Niveau {{ levelNumber }} / {{ CAMPAIGN.length }}</div>
          <div class="display t-lg grad-text" data-testid="solo-intro-title">{{ level.title }}</div>
          <div class="muted">{{ level.description }}</div>
          <div class="s-intro-meta">
            <span class="display"><v-icon icon="mdi-cards-outline" size="20" /> {{ level.goal }} cartes à réunir</span>
            <LivesBar :lives="solo.lives" :max="solo.maxLives" :size="20" />
            <StarRating v-if="levelStars" :stars="levelStars" :size="20" />
          </div>
          <v-btn class="btn-primary" size="large" append-icon="mdi-arrow-right" data-testid="solo-intro-go" @click="introSeen = view.code">C'est parti</v-btn>
        </section>

        <!-- Mon titre : l'appareil joue l'extrait lui-même -->
        <PlayTurn v-else-if="view.phase === 'awaiting-placement'" :me="me" :listened="view.listened" :audio-url="view.current?.audioUrl">
          <template #head>
            <div v-if="level" class="s-level-name muted text-truncate" data-testid="solo-level-name">Niv. {{ levelNumber }} · {{ level.title }}</div>
            <div class="s-status">
              <LivesBar :lives="solo.lives" :max="solo.maxLives" />
              <span class="display" data-testid="solo-progress">{{ progressText }}</span>
            </div>
          </template>
        </PlayTurn>

        <section v-else-if="view.phase === 'reveal'" class="s-reveal">
          <RevealPanel :view="view" compact :viewer-id="me.id">
            <template #action>
              <LivesBar :lives="solo.lives" :max="solo.maxLives" :size="20" />
              <v-btn class="btn-primary" size="default" append-icon="mdi-arrow-right" data-testid="solo-advance" @click="advance">{{ lastReveal ? "Voir le résultat" : "Continuer" }}</v-btn>
            </template>
          </RevealPanel>
        </section>

        <section v-else-if="view.phase === 'finished' && outcome" class="s-end">
          <Confetti v-if="outcome.won || newRecord" :count="70" />
          <div class="s-end-head">
            <div v-if="level" class="muted">Niveau {{ levelNumber }} · {{ level.title }}</div>
            <div class="display t-lg" :class="outcome.won || newRecord ? 'grad-text' : ''" data-testid="solo-end-title">{{ endTitle }}</div>
            <StarRating v-if="level && outcome.won" :stars="outcome.stars" :size="44" />
            <div v-if="level" class="muted" data-testid="solo-end-detail">
              <template v-if="!outcome.won">{{ cards }} carte{{ cards > 1 ? "s" : "" }} sur {{ level.goal }}. Réessaie !</template>
              <template v-else-if="outcome.stars < 3">Sans erreur, tu aurais eu trois étoiles.</template>
              <template v-else>Aucune erreur !</template>
              <template v-if="outcome.improved"> Ton meilleur résultat sur ce niveau.</template>
            </div>
            <div v-else class="muted" data-testid="solo-end-detail">
              Ta frise : <span class="display">{{ cards }} carte{{ cards > 1 ? "s" : "" }}</span>
              <template v-if="newRecord"> · nouveau record !</template>
              <template v-else-if="outcome.previous"> · record : {{ outcome.previous }}</template>
            </div>
          </div>
          <TimelineStrip :cards="me.timeline" centered />
          <div class="s-end-actions">
            <v-btn class="btn-ghost" prepend-icon="mdi-arrow-left" data-testid="solo-menu" @click="leave">Menu solo</v-btn>
            <v-btn :class="outcome.won && nextLevel ? 'btn-ghost' : 'btn-primary'" prepend-icon="mdi-replay" data-testid="solo-replay" @click="replay">{{ outcome.won ? "Rejouer" : "Réessayer" }}</v-btn>
            <v-btn v-if="level && outcome.won && nextLevel" class="btn-primary" append-icon="mdi-arrow-right" data-testid="solo-next" @click="startSolo(nextLevel.id)">Niveau suivant</v-btn>
          </div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.s-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24vh 16px 0;
}
.s-stage {
  position: relative;
}
.s-exit.v-btn {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 50;
}
.s-reconnect {
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
.s-lobby,
.s-reveal,
.s-end {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 920px;
  margin: 0 auto;
  padding: 16px;
}
.s-lobby-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 8px;
}
.s-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 640px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 16px;
  text-align: center;
}
.s-intro-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 18px;
  margin: 4px 0 6px;
}
.s-level-name {
  margin-bottom: -6px;
  font-size: 0.85rem;
}
.s-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 1.05rem;
}
.s-reveal {
  max-width: 1400px;
  min-height: 100dvh;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
}
.in-game > .s-reveal {
  padding-right: 56px;
}
.s-end {
  min-height: 100dvh;
  justify-content: center;
}
.s-end-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.s-end-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.s-small {
  font-size: 0.9rem;
}
/* Téléphone en paysage : la fin de partie doit tenir sans défiler, boutons compris. */
@media (orientation: landscape) and (max-height: 430px) {
  .s-end {
    gap: 6px;
    padding: 8px 16px;
  }
  .s-end-head {
    gap: 2px;
  }
  .s-intro {
    gap: 4px;
  }
  .s-intro .t-lg {
    font-size: 1.8rem;
  }
  .s-end-head .t-lg {
    font-size: 1.6rem;
  }
  .s-end-head :deep(.stars .v-icon) {
    width: 30px;
    height: 30px;
    font-size: 30px !important;
  }
}
</style>
