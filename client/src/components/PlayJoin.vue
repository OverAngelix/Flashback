<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { AVATARS } from "@/avatars";
import AvatarBadge from "@/components/AvatarBadge.vue";
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

const codeReady = computed(() => code.value.length === ROOM_CODE_LENGTH);
const taken = computed(() => new Set(info.value?.takenAvatars ?? []));
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
  <v-container class="join d-flex flex-column ga-3">
    <h1 class="text-headline-medium font-weight-bold">Rejoindre une partie</h1>

    <div class="join-grid">
      <div class="d-flex flex-column ga-2">
        <v-text-field
          v-model="code"
          label="Code de la partie"
          :maxlength="ROOM_CODE_LENGTH"
          autocapitalize="characters"
          autocomplete="off"
          inputmode="text"
          density="comfortable"
          class="code-field"
          :error-messages="notFound ? 'Aucune partie avec ce code.' : info && !info.joinable ? 'Cette partie a déjà commencé ou est pleine.' : undefined"
          data-testid="code-input"
        />
        <v-text-field v-model="name" label="Ton nom" :maxlength="MAX_NAME_LENGTH" counter density="comfortable" autocomplete="off" data-testid="name-input" />
      </div>

      <div class="d-flex flex-column ga-3">
        <div>
          <div class="text-title-medium mb-2">Ton avatar</div>
          <div class="avatar-grid">
            <button
              v-for="(a, i) in AVATARS"
              :key="i"
              type="button"
              class="avatar-choice"
              :class="{ selected: avatar === i }"
              :disabled="taken.has(i)"
              :aria-label="a.label"
              :data-testid="`avatar-${i}`"
              @click="avatar = i"
            >
              <AvatarBadge :avatar="i" :size="52" />
              <v-icon v-if="taken.has(i)" icon="mdi-lock" size="small" class="lock" />
            </button>
          </div>
        </div>

        <v-btn color="primary" size="x-large" class="w-100" :disabled="!canJoin" :loading="sending" data-testid="join" @click="join">Rejoindre</v-btn>
        <v-btn variant="text" to="/">Retour</v-btn>
      </div>
    </div>
  </v-container>
</template>

<style scoped>
.join {
  max-width: 560px;
}
.join-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.join-grid > * {
  min-width: 0;
}
/* Téléphone en paysage : peu de hauteur, on met les champs et les avatars côte à côte. */
@media (orientation: landscape) and (max-height: 520px) {
  .join {
    max-width: 900px;
  }
  .join-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
}
.code-field :deep(input) {
  font-size: 1.6rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.avatar-choice {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 4px;
  border: 3px solid transparent;
  border-radius: 16px;
  background: transparent;
  cursor: pointer;
}
/* L'avatar se réduit avec la colonne au lieu de la faire déborder (téléphones étroits). */
.avatar-choice :deep(.v-avatar) {
  width: 100% !important;
  max-width: 56px;
  height: auto !important;
  aspect-ratio: 1;
}
.avatar-choice.selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.2);
}
.avatar-choice:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.lock {
  position: absolute;
  bottom: 2px;
  right: 2px;
}
</style>
