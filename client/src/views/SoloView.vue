<script setup lang="ts">
import { computed } from "vue";
import { CAMPAIGN } from "@server/game/campaign";
import { SOLO_LIVES } from "@server/game/types";
import LivesBar from "@/components/LivesBar.vue";
import StarRating from "@/components/StarRating.vue";
import { useSoloStart } from "@/composables/useSoloStart";
import { isUnlocked, useSoloProgress } from "@/soloProgress";

const progress = useSoloProgress();
const startSolo = useSoloStart();

const levels = computed(() =>
  CAMPAIGN.map((level, index) => ({ level, index, stars: progress.stars[level.id] ?? 0, open: isUnlocked(index, progress.stars) })),
);
const totalStars = computed(() => levels.value.reduce((sum, l) => sum + l.stars, 0));
/** Meilleure frise en partie libre, toutes sélections confondues. */
const bestRecord = computed(() => Math.max(0, ...Object.values(progress.records)));
</script>

<!-- Menu solo : la partie libre en haut, puis les niveaux de la campagne. -->
<template>
  <div class="s-menu">
    <header class="s-top">
      <v-btn icon="mdi-arrow-left" class="btn-ghost" size="default" to="/" title="Retour au menu" aria-label="Retour au menu" data-testid="solo-back" />
      <h1 class="display t-lg grad-text">Solo</h1>
    </header>

    <section class="s-free glass">
      <span class="s-ico"><v-icon icon="mdi-infinity" size="34" /></span>
      <div class="s-free-text">
        <div class="display t-md">Partie libre</div>
        <div class="muted">Choisis tes catégories et va le plus loin possible. La partie s'arrête à la troisième erreur.</div>
        <div class="s-free-meta">
          <LivesBar :lives="SOLO_LIVES" :max="SOLO_LIVES" :size="18" />
          <span v-if="bestRecord" class="muted" data-testid="solo-best">Meilleur score : <span class="display">{{ bestRecord }} cartes</span></span>
          <span v-if="progress.lastScore" class="muted" data-testid="solo-last">Dernière partie : {{ progress.lastScore }} carte{{ progress.lastScore > 1 ? "s" : "" }}</span>
        </div>
      </div>
      <v-btn class="btn-primary" size="large" prepend-icon="mdi-play" data-testid="solo-free" @click="startSolo(null)">Jouer</v-btn>
    </section>

    <section class="s-campaign">
      <div class="s-head">
        <h2 class="display t-md">Campagne</h2>
        <span class="s-total display" data-testid="campaign-total"><v-icon icon="mdi-star" color="warning" size="20" /> {{ totalStars }} / {{ CAMPAIGN.length * 3 }}</span>
      </div>
      <p class="muted s-rules">
        Des titres tirés au sort dans le thème du niveau, {{ SOLO_LIVES }} vies pour compléter ta frise. Sans erreur : trois étoiles. Réussis un niveau pour ouvrir le suivant.
      </p>
      <div class="s-levels">
        <button
          v-for="l in levels"
          :key="l.level.id"
          type="button"
          class="s-level"
          :class="{ locked: !l.open, done: l.stars > 0 }"
          :disabled="!l.open"
          :data-testid="`level-${l.level.id}`"
          @click="startSolo(l.level.id)"
        >
          <span class="s-num display">{{ l.index + 1 }}</span>
          <span class="s-body">
            <span class="display s-title">{{ l.level.title }}</span>
            <span class="muted s-desc">{{ l.level.description }}</span>
            <span class="s-foot">
              <span class="s-goal muted"><v-icon icon="mdi-cards-outline" size="16" /> {{ l.level.goal }} cartes</span>
              <v-icon v-if="!l.open" icon="mdi-lock" size="20" class="s-lock" />
              <StarRating v-else :stars="l.stars" :size="18" />
            </span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.s-menu {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1040px;
  margin: 0 auto;
  padding: 18px clamp(16px, 4vw, 40px) 40px;
}
.s-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.s-top h1 {
  margin: 0;
}
.s-free {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
}
.s-ico {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 20px;
  background: var(--grad);
  box-shadow: 0 8px 26px rgba(255, 61, 154, 0.4);
}
.s-free-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.s-free-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
}
.s-campaign {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.s-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.s-head h2 {
  margin: 0;
}
.s-total {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
}
.s-rules {
  margin: 0;
  font-size: 0.95rem;
}
.s-levels {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}
/* Douze boutons : fond translucide sans flou (le flou de .glass coûte cher sur téléphone). */
.s-level {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--glass);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s, box-shadow 0.25s ease;
}
.s-level:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.32);
  box-shadow: 0 14px 34px rgba(124, 92, 255, 0.28);
}
.s-level:active:not(:disabled) {
  transform: scale(0.98);
}
.s-level.done {
  border-color: rgba(255, 201, 77, 0.4);
}
.s-level.locked {
  cursor: not-allowed;
  opacity: 0.45;
}
.s-num {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--violet), var(--cyan));
  font-size: 1.15rem;
}
.locked .s-num {
  background: var(--glass-strong);
}
.s-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.s-title {
  font-size: 1.15rem;
}
.s-desc {
  font-size: 0.85rem;
  line-height: 1.25;
}
.s-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}
.s-goal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
}
.s-lock {
  color: rgba(255, 255, 255, 0.6);
}
@media (max-width: 560px) {
  .s-free {
    flex-wrap: wrap;
  }
  .s-free .v-btn {
    width: 100%;
  }
}
</style>
