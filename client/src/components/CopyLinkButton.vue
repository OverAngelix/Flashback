<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { copyText } from "@/clipboard";

/**
 * Copie le lien direct vers la salle (`/join/CODE`), à coller dans une conversation : ceux qui
 * l'ouvrent n'ont plus qu'à choisir leur nom et leur avatar. Si la copie échoue, le lien est
 * affiché dans une fenêtre pour être copié à la main.
 */
const props = defineProps<{ link: string; size?: string; testid?: string }>();

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(timer));

async function copy() {
  if (!(await copyText(props.link))) {
    window.prompt("Copie ce lien pour inviter tes amis :", props.link);
    return;
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <v-btn
    class="btn-ghost"
    :size="size ?? 'default'"
    :prepend-icon="copied ? 'mdi-check' : 'mdi-link-variant'"
    :data-testid="testid ?? 'copy-link'"
    :data-link="link"
    @click.stop="copy"
  >
    {{ copied ? "Lien copié !" : "Copier le lien" }}
  </v-btn>
</template>
