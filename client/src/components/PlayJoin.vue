<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { AVATARS } from "@/avatars";
import AvatarBadge from "@/components/AvatarBadge.vue";
import BrandMark from "@/components/BrandMark.vue";
import { useConnection } from "@/net/connection";
import { ROOM_CODE_LENGTH } from "@server/net/protocol";
import { MAX_NAME_LENGTH } from "@server/game/types";

const props = defineProps<{ initialCode?: string }>();
const connection = useConnection();

interface RoomInfo {
  phase: string;
  playerCount: number;
  takenAvatars: number[];
  joinable: boolean;
}

const code = ref((props.initialCode ?? "").toUpperCase());
const name = ref("");
const avatar = ref<number | null>(null);
const info = ref<RoomInfo | null>(null);
const notFound = ref(false);
const sending = ref(false);
/** Arrivé par un lien ou un QR code : le code est connu, inutile de le faire retaper. */
const editCode = ref(code.value.length !== ROOM_CODE_LENGTH);

const codeReady = computed(() => code.value.length === ROOM_CODE_LENGTH);
const taken = computed(() => new Set(info.value?.takenAvatars ?? []));
const problem = computed(() => {
  if (notFound.value) return "Aucune partie avec ce code.";
  if (info.value && !info.value.joinable) return "Cette partie a déjà commencé ou est pleine.";
  return null;
});
const canJoin = computed(
  () => codeReady.value && name.value.trim().length > 0 && avatar.value !== null && info.value?.joinable === true && !sending.value,
);

async function refresh() {
  if (!codeReady.value) {
    info.value = null;
    notFound.value = false;
    return;
  }
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code.value)}`);
    notFound.value = res.status === 404;
    info.value = res.ok ? ((await res.json()) as RoomInfo) : null;
    // Un avatar choisi puis pris par quelqu'un d'autre : on laisse le joueur en choisir un autre.
    if (avatar.value !== null && taken.value.has(avatar.value)) avatar.value = null;
  } catch {
    info.value = null;
  }
}

// Les avatars pris évoluent pendant que le joueur remplit le formulaire.
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refresh();
  timer = setInterval(refresh, 3000);
});
onUnmounted(() => clearInterval(timer));
watch(code, (v) => {
  code.value = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
  refresh();
});
// Le code du lien ne mène nulle part : on laisse le joueur le corriger.
watch(notFound, (nf) => nf && (editCode.value = true));
watch(
  () => connection.state.error,
  (e) => {
    if (e) sending.value = false;
  },
);

function join() {
  if (!canJoin.value || avatar.value === null) return;
  sending.value = true;
  connection.join(code.value, name.value, avatar.value);
}
</script>

<template>
  <div class="join">
    <header class="head">
      <BrandMark class="mark" />
      <h1 class="display t-md">Rejoindre une partie</h1>
    </header>

    <div class="grid">
      <div class="fields">
        <div v-if="!editCode" class="chip glass" data-testid="code-chip">
          <span class="muted">Partie</span>
          <span class="display code">{{ code }}</span>
          <button type="button" class="link" @click="editCode = true">Changer</button>
        </div>
        <v-text-field
          v-else
          v-model="code"
          label="Code de la partie"
          :maxlength="ROOM_CODE_LENGTH"
          autocapitalize="characters"
          autocomplete="off"
          inputmode="text"
          density="comfortable"
          class="code-field"
          :error-messages="problem ?? undefined"
          data-testid="code-input"
        />
        <p v-if="!editCode && problem" class="problem">{{ problem }}</p>
        <v-text-field v-model="name" label="Ton nom" :maxlength="MAX_NAME_LENGTH" counter density="comfortable" autocomplete="off" data-testid="name-input" />
      </div>

      <div class="picker">
        <div class="display label">Ton avatar</div>
        <div class="avatars">
          <button
            v-for="(a, i) in AVATARS"
            :key="i"
            type="button"
            class="choice"
            :class="{ selected: avatar === i }"
            :disabled="taken.has(i)"
            :aria-label="a.label"
            :data-testid="`avatar-${i}`"
            @click="avatar = i"
          >
            <AvatarBadge :avatar="i" :size="56" />
            <v-icon v-if="taken.has(i)" icon="mdi-lock" size="small" class="lock" />
          </button>
        </div>
        <v-btn class="btn-primary w-100" size="x-large" :disabled="!canJoin" :loading="sending" data-testid="join" @click="join">Rejoindre</v-btn>
        <v-btn class="btn-ghost w-100" size="default" to="/">Retour</v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.join {
  max-width: 560px;
  margin: 0 auto;
  padding: 18px 16px 28px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.mark {
  width: 40px;
  height: 40px;
}
.head h1 {
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}
.grid > * {
  min-width: 0;
}
.fields,
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 16px;
}
.code {
  font-size: 1.5rem;
  letter-spacing: 0.18em;
}
.link {
  margin-left: auto;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: var(--cyan);
  font-family: var(--font-display);
  font-weight: 600;
  cursor: pointer;
}
.problem {
  margin: -4px 0 0;
  color: var(--red);
  font-size: 0.9rem;
}
.code-field :deep(input) {
  font-family: var(--font-display);
  font-size: 1.5rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
}
.label {
  font-size: 1.1rem;
}
.avatars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.choice {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 5px;
  border: 3px solid transparent;
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
/* L'avatar se réduit avec la colonne au lieu de la faire déborder (téléphones étroits). */
.choice :deep(.avatar) {
  width: 100% !important;
  max-width: 60px;
  height: auto !important;
  aspect-ratio: 1;
}
.choice.selected {
  border-color: var(--pink);
  background: rgba(255, 61, 154, 0.18);
  transform: scale(1.06);
}
.choice:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}
.lock {
  position: absolute;
  right: 2px;
  bottom: 2px;
}
/* Téléphone en paysage : peu de hauteur, on met les champs et les avatars côte à côte. */
@media (orientation: landscape) and (max-height: 520px) {
  .join {
    max-width: 920px;
  }
  .grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
}
</style>
