<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlayerView } from "@server/net/protocol";
import DiscoBall from "./DiscoBall.vue";
import AvatarBadge from "./AvatarBadge.vue";
import TimelineStrip from "./TimelineStrip.vue";
import { useConnection } from "@/net/connection";

/**
 * Le tour d'un autre joueur : sa frise, et le placement groove. Une fois l'extrait lancé, on peut
 * placer le titre dans sa frise, une seule fois et avant lui, pour un point groove si c'est juste.
 */
const props = defineProps<{
  me: PlayerView;
  active: PlayerView;
  listened: boolean;
  /** Le serveur a déjà enregistré mon placement groove pour ce tour. */
  guessed: boolean;
  /** Chef de partie : peut passer le tour d'un joueur déconnecté. */
  leader?: boolean;
}>();
const emit = defineEmits<{ skip: [] }>();
const connection = useConnection();
const selected = ref<number | null>(null);

const canPlace = computed(() => props.listened && !props.guessed);
const hint = computed(() => {
  const name = props.active.name;
  if (props.guessed) return `C'est placé ! Verdict quand ${name} aura joué.`;
  if (!props.listened) return `${name} n'a pas encore lancé l'extrait.`;
  if (selected.value === null) return `Place le titre dans sa frise avant ${name} : +1 groove si c'est juste.`;
  return `Valide vite, avant ${name} !`;
});

function place() {
  if (selected.value === null || !canPlace.value) return;
  connection.send({ type: "player:groove", position: selected.value });
  selected.value = null;
}
</script>

<template>
  <div class="groove-turn" data-testid="groove-turn">
    <div class="side">
      <div class="who">
        <AvatarBadge :avatar="active.avatar" :size="34" />
        <span class="display text-truncate">Tour de {{ active.name }}</span>
      </div>
      <div class="score muted" data-testid="my-score">
        Toi : {{ me.timeline.length }} carte{{ me.timeline.length > 1 ? "s" : "" }} ·
        <span class="gv"><DiscoBall :size="14" class="mr-1" />{{ me.groove }} groove</span>
      </div>
      <div class="hint muted" data-testid="groove-hint">{{ hint }}</div>
      <v-btn v-if="!guessed" class="btn-success w-100" :disabled="!canPlace || selected === null" data-testid="groove-place" @click="place"><template #prepend><DiscoBall :size="20" /></template>Placer ici</v-btn>
      <div v-else class="done display" data-testid="groove-done"><v-icon icon="mdi-check-circle" /> Placé</div>
      <v-btn v-if="leader && !active.connected" class="btn-ghost w-100" size="small" data-testid="leader-skip" @click="emit('skip')">Passer son tour</v-btn>
    </div>
    <div class="main">
      <TimelineStrip :cards="active.timeline" :interactive="canPlace" :selected="selected" class="w-100" @select="selected = $event" />
    </div>
  </div>
</template>

<style scoped>
.groove-turn {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  height: 100dvh;
  overflow: hidden;
}
.side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  width: 176px;
  flex-shrink: 0;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 1.05rem;
}
.score {
  font-size: 0.8rem;
}
.gv {
  color: var(--gold);
  white-space: nowrap;
}
.hint {
  min-height: 3.6em;
  font-size: 0.85rem;
  line-height: 1.2;
}
.done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  border-radius: 999px;
  color: var(--green);
  background: var(--glass-strong);
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
