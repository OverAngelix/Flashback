<script setup lang="ts">
import { computed } from "vue";
import { correctPositions } from "@server/game/types";
import type { GameView } from "@server/net/protocol";
import DiscoBall from "./DiscoBall.vue";
import AvatarBadge from "./AvatarBadge.vue";
import Confetti from "./Confetti.vue";
import TimelineStrip from "./TimelineStrip.vue";
import TrackCard from "./TrackCard.vue";

/**
 * Tous les écrans montrent la frise du joueur qui vient de jouer, avec sa carte à l'endroit choisi
 * (verte si juste, rouge sinon) et, si elle est fausse, les emplacements qui étaient justes. L'écran
 * hôte dit qui a trouvé le groove ; un téléphone (`viewerId`) ne donne que le résultat de son joueur.
 */
const props = defineProps<{ view: GameView; compact?: boolean; viewerId?: string | null; note?: string }>();

const result = computed(() => props.view.lastResult);
const player = computed(() => props.view.players.find((p) => p.id === result.value?.playerId));
const skipped = computed(() => result.value?.position === -1);
const nameOf = (id: string) => props.view.players.find((p) => p.id === id)?.name;

/** La frise telle qu'elle était au moment du placement : la carte jouée est affichée à part. */
const before = computed(() => {
  const r = result.value;
  return (player.value?.timeline ?? []).filter((c) => !(r?.correct && c.id === r.track.id));
});
/** Carte ratée ou tour passé : tous les emplacements qui auraient été justes. */
const solutions = computed(() => {
  const r = result.value;
  return r && !r.correct ? correctPositions(before.value, r.track.year) : [];
});
const placed = computed(() => {
  const r = result.value;
  return r && !skipped.value ? { card: r.track, position: r.position, correct: r.correct } : null;
});
/** « Dark a trouvé ! » pour tous ; « Bien joué ! » sur le téléphone de Dark lui-même. */
const verdict = computed(() => {
  const own = !!props.viewerId && props.viewerId === player.value?.id;
  const name = player.value?.name ?? "";
  if (skipped.value) return own ? "Tour passé" : `${name} passe ce tour`;
  if (result.value?.correct) return own ? "Bien joué !" : `${name} a trouvé !`;
  return own ? "Raté…" : `${name} n'a pas trouvé…`;
});

/**
 * Ligne groove. Écran hôte : « Ben et Cléo ont (aussi) trouvé », rien si personne n'a tenté.
 * Téléphone : seulement le résultat du spectateur s'il a placé (« Toi non plus… »), sans les autres.
 */
const groove = computed(() => {
  const guesses = result.value?.groove ?? [];
  const activeOk = !!result.value?.correct;
  if (props.viewerId) {
    const mine = guesses.find((g) => g.playerId === props.viewerId);
    if (!mine) return null;
    if (mine.correct) return { ok: true, text: activeOk ? "Toi aussi !" : "Toi, tu as trouvé !" };
    return { ok: false, text: activeOk || skipped.value ? "Toi, tu n'as pas trouvé…" : "Toi non plus…" };
  }
  if (guesses.length === 0) return null;
  const winners = guesses.filter((g) => g.correct).flatMap((g) => nameOf(g.playerId) ?? []);
  if (winners.length === 0) return { ok: false, text: "Personne n'a trouvé" };
  const list = winners.length === 1 ? winners[0] : `${winners.slice(0, -1).join(", ")} et ${winners.at(-1)}`;
  // « aussi » quand le joueur actif a trouvé lui aussi.
  const also = activeOk ? " aussi" : "";
  return { ok: true, text: `${list} ${winners.length > 1 ? "ont" : "a"}${also} trouvé` };
});
</script>

<template>
  <div v-if="result && player" class="reveal" :class="{ compact, wrong: !result.correct }">
    <Confetti v-if="result.correct && !compact" />
    <div class="card-wrap"><TrackCard :card="result.track" big :tone="skipped ? undefined : result.correct ? 'ok' : 'ko'" /></div>
    <div class="side">
      <div class="head">
        <AvatarBadge :avatar="player.avatar" :size="compact ? 34 : 64" />
        <div class="min-width-0">
          <div class="verdict display" :class="result.correct ? 'ok' : 'ko'" data-testid="verdict">{{ verdict }}</div>
          <div v-if="groove" class="groove-line text-truncate" :class="groove.ok ? 'ok' : 'ko'" data-testid="groove-result">
            <DiscoBall :size="18" class="mr-1" />{{ groove.text }}
          </div>
        </div>
      </div>
      <TimelineStrip :cards="before" :placed="placed" :solutions="solutions" />
    </div>
  </div>
  <!-- En bas au centre : l'attente, ou le bouton du chef de partie. -->
  <div v-if="result && player && (note || $slots.action)" class="reveal-foot">
    <span v-if="note" class="muted note">{{ note }}</span>
    <slot name="action" />
  </div>
</template>

<style scoped>
.reveal {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
}
.reveal.compact {
  flex-wrap: nowrap;
  justify-content: center;
  gap: 14px;
}
/* La frise prend la place de son contenu : l'ensemble reste centré, et défile s'il ne tient pas. */
.compact .side {
  flex: 0 1 auto;
}
.reveal-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.reveal.wrong .card-wrap {
  animation: shake 0.6s ease both;
}
.side {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: min(100%, 320px);
}
.compact .side {
  gap: 4px;
  min-width: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.verdict {
  font-size: clamp(2rem, 4.4vw, 3.4rem);
}
.verdict {
  line-height: 1.1;
}
.compact .verdict {
  overflow: hidden;
  font-size: 1.5rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.verdict.ok {
  color: var(--green);
}
.verdict.ko {
  color: var(--red);
}
.groove-line {
  margin-top: 6px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.4rem;
}
.groove-line.ok {
  color: var(--gold);
}
.groove-line.ko {
  color: rgba(255, 255, 255, 0.6);
}
.compact .groove-line,
.note {
  font-size: 0.85rem;
}
.compact .groove-line {
  margin-top: 0;
}
@keyframes shake {
  20%,
  60% {
    transform: translateX(-7px);
  }
  40%,
  80% {
    transform: translateX(7px);
  }
}
</style>
