<script setup lang="ts">
import { ref, watch } from "vue";
import DiscoBall from "@/components/DiscoBall.vue";
import { markSeen, newsFor, seenVersion } from "@/news";

/**
 * Nouveautés de la version, montrées une fois : la présentation complète à un nouveau venu, les
 * seules nouveautés à qui a vu une version précédente. Fermer (bouton, clic à côté, Échap) note la
 * version comme vue dans le navigateur.
 */
const news = newsFor(seenVersion());
const open = ref(news !== null);

watch(open, (v) => {
  if (!v && news) markSeen(news.version);
});
</script>

<template>
  <v-dialog v-if="news" v-model="open" max-width="560" scrollable>
    <div class="news glass" data-testid="news">
      <header class="news-head">
        <span class="version display" data-testid="news-version">v{{ news.version }}</span>
        <div class="display t-md grad-text">{{ news.welcome ? "Bienvenue sur Flashback" : "Quoi de neuf ?" }}</div>
        <p class="muted">
          {{ news.welcome ? "Écoute l'extrait, remets la musique dans l'ordre." : "Depuis ta dernière visite :" }}
        </p>
      </header>

      <div class="news-body">
        <section v-for="section in news.sections" :key="section.version" class="news-section">
          <div v-if="news.sections.length > 1" class="section-version display muted">Version {{ section.version }}</div>
          <ul>
            <li v-for="item in section.items" :key="item.title" class="news-item">
              <span class="news-ico">
                <DiscoBall v-if="item.icon === 'disco'" :size="26" />
                <v-icon v-else :icon="item.icon" size="24" />
              </span>
              <span>
                <span class="display item-title">{{ item.title }}</span>
                <span class="muted item-text">{{ item.text }}</span>
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div class="news-actions">
        <v-btn class="btn-primary" size="large" data-testid="news-close" @click="open = false">C'est parti !</v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.news {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 90dvh;
  padding: clamp(14px, 3dvh, 24px) 22px;
  /* La boîte flotte au-dessus d'un fond animé : plus opaque que le verre habituel. */
  background: rgba(24, 14, 48, 0.95);
}
/* Le badge de version au-dessus du titre, dans le flux : il ne peut pas le chevaucher sur un écran étroit. */
.news-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.news-head p {
  margin: 0;
}
.version {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--gold);
  color: #3a2600;
  font-size: 0.8rem;
}
/* Seule la liste défile quand l'écran est bas (téléphone en paysage). */
.news-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
}
.section-version {
  margin-bottom: 6px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.news-section ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.news-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--glass);
}
.news-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--grad);
}
.item-title {
  display: block;
  font-size: 1.05rem;
}
.item-text {
  display: block;
  font-size: 0.92rem;
  line-height: 1.35;
}
.news-actions {
  display: flex;
  justify-content: center;
}
</style>
