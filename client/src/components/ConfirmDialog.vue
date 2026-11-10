<script setup lang="ts">
/** Demande de confirmation avant une action sans retour (quitter ou arrêter une partie). */
defineProps<{ title: string; text: string; confirmLabel: string; testid?: string }>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ confirm: [] }>();

function confirm() {
  open.value = false;
  emit("confirm");
}
</script>

<template>
  <v-dialog v-model="open" max-width="420">
    <div class="confirm glass" :data-testid="testid">
      <div class="display t-md">{{ title }}</div>
      <p class="muted">{{ text }}</p>
      <div class="actions">
        <v-btn class="btn-ghost" size="default" :data-testid="testid && `${testid}-cancel`" @click="open = false">Annuler</v-btn>
        <v-btn class="btn-danger" size="default" prepend-icon="mdi-exit-to-app" :data-testid="testid && `${testid}-ok`" @click="confirm">{{ confirmLabel }}</v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 22px;
  /* La boîte flotte au-dessus d'un fond animé : plus opaque que le verre habituel. */
  background: rgba(24, 14, 48, 0.94);
}
.confirm p {
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.btn-danger.v-btn {
  background: #e5484d;
  color: #fff;
}
</style>
