<script setup lang="ts">
import { nextTick, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BrandMark from "@/components/BrandMark.vue";

const route = useRoute();
const router = useRouter();

const SECTIONS = [
  { id: "projet", label: "Le projet" },
  { id: "editeur", label: "Éditeur et hébergeur" },
  { id: "droits", label: "Musiques et marques" },
  { id: "retrait", label: "Retrait de contenu" },
  { id: "confidentialite", label: "Confidentialité" },
  { id: "regles", label: "Règles d'usage" },
  { id: "contact", label: "Contact" },
];

/** Le menu peut viser une section (/legal#retrait) : on y descend une fois la page affichée. */
async function scrollToHash(hash: string) {
  if (!hash) return;
  await nextTick();
  document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
}
onMounted(() => setTimeout(() => scrollToHash(route.hash), 320));
watch(() => route.hash, scrollToHash);
</script>

<!-- Mentions légales, droits, retrait de contenu et confidentialité. Liées depuis le bas du menu. -->
<template>
  <div class="legal">
    <header class="head">
      <v-btn icon="mdi-arrow-left" class="btn-ghost" size="default" title="Retour au menu" data-testid="legal-back" @click="router.push('/')" />
      <BrandMark class="mark" />
      <div>
        <h1 class="display t-md">Mentions légales et confidentialité</h1>
        <p class="muted small">Dernière mise à jour : 24 novembre 2026</p>
      </div>
    </header>

    <nav class="toc" aria-label="Sommaire">
      <router-link v-for="s in SECTIONS" :key="s.id" :to="{ hash: `#${s.id}` }" class="toc-link">{{ s.label }}</router-link>
    </nav>

    <section id="projet" class="panel glass">
      <h2 class="display">Le projet</h2>
      <p>
        Flashback est un jeu musical <strong>non officiel, gratuit et sans but lucratif</strong>, jouable dans le navigateur. Il ne contient ni publicité ni achats, et
        n'accepte pas de dons. Il est développé et financé, serveur compris, par une seule personne, OverAngelix, sur son temps libre.
      </p>
    </section>

    <section id="editeur" class="panel glass">
      <h2 class="display">Éditeur et hébergeur</h2>
      <p>
        <strong>Éditeur et directeur de la publication</strong> : OverAngelix, particulier agissant à titre non professionnel. Comme le permet la loi pour la confiance
        dans l'économie numérique (LCEN) du 21 juin 2004, il ne publie pas ses coordonnées personnelles et les a communiquées à l'hébergeur. Pour le joindre, voir
        <router-link :to="{ hash: '#contact' }">Contact</router-link>.
      </p>
      <p>
        <strong>Hébergeur</strong> : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France. Téléphone : +33 9 72 10 10 07.
        <a href="https://www.ovhcloud.com/fr/" target="_blank" rel="noopener">ovhcloud.com</a>
      </p>
    </section>

    <section id="droits" class="panel glass">
      <h2 class="display">Musiques, marques et ressources</h2>
      <p>
        Les titres, extraits et pochettes appartiennent à leurs artistes, labels et ayants droit respectifs. Flashback n'en revendique aucune propriété.
      </p>
      <p>
        Les extraits de 30 secondes et les pochettes sont <strong>fournis par iTunes</strong> : ton navigateur les lit directement sur les serveurs d'Apple, et Flashback
        n'en conserve aucune copie. Flashback n'est ni affilié, ni parrainé, ni approuvé par Apple Inc. iTunes et Apple Music sont des marques d'Apple Inc.
      </p>
      <p>Les années de sortie sont recoupées avec MusicBrainz et corrigées à la main, mais il peut rester des erreurs : n'hésite pas à les signaler.</p>
      <p>
        Ressources tierces, servies depuis ce site : polices Fredoka et Outfit (SIL Open Font License 1.1), icônes Material Design Icons (Pictogrammers, licence
        Apache 2.0). L'interface, les illustrations et la musique du menu ont été créées pour le jeu.
      </p>
    </section>

    <section id="retrait" class="panel glass">
      <h2 class="display">Retrait de contenu</h2>
      <p>
        Tu es titulaire de droits sur un titre, une pochette ou un autre élément de Flashback et tu souhaites qu'il soit retiré ? Écris par l'un des moyens indiqués
        dans <router-link :to="{ hash: '#contact' }">Contact</router-link> en précisant l'élément concerné. Aucun formulaire ni démarche formelle n'est nécessaire :
        il sera retiré du jeu dans les meilleurs délais.
      </p>
    </section>

    <section id="confidentialite" class="panel glass">
      <h2 class="display">Confidentialité</h2>
      <p>Flashback ne demande ni compte ni adresse e-mail, et n'utilise ni cookie, ni publicité, ni outil de mesure d'audience.</p>
      <h3 class="display">Pendant une partie</h3>
      <p>
        Le serveur garde en mémoire, sans base de données, le code de la salle, le pseudo et l'avatar de chaque joueur, un jeton de reconnexion et le déroulement de
        la partie. Tout est effacé quand l'hôte ferme la salle, 30 minutes après le départ du dernier appareil, et à chaque redémarrage du serveur. Choisis un pseudo
        plutôt que ton vrai nom.
      </p>
      <h3 class="display">Journaux techniques</h3>
      <p>
        Comme la plupart des sites, le serveur note les requêtes qu'il reçoit (adresse IP comprise) pour fonctionner et se protéger des abus. Ces journaux ne sont ni
        analysés ni partagés, et sont effacés à chaque mise à jour du serveur.
      </p>
      <h3 class="display">Sur ton appareil</h3>
      <p>Le jeu enregistre dans le stockage local de ton navigateur (ce ne sont pas des cookies, et rien n'est envoyé ailleurs) :</p>
      <ul>
        <li><code>flashback.session</code> : de quoi reprendre ta partie après un rechargement ;</li>
        <li><code>flashback.settings</code> : tes paramètres (volumes, animations, écran de démarrage, nom proposé) ;</li>
        <li><code>flashback.solo</code> : tes étoiles et records du mode solo ;</li>
        <li><code>flashback.news</code> : la dernière version des nouveautés que tu as vue.</li>
      </ul>
      <p>Tu peux tout supprimer en effaçant les données de ce site dans ton navigateur.</p>
      <h3 class="display">Apple</h3>
      <p>
        Ton navigateur télécharge les extraits et les pochettes chez Apple, qui reçoit donc ton adresse IP comme pour n'importe quelle page web : voir la
        <a href="https://www.apple.com/fr/legal/privacy/" target="_blank" rel="noopener">politique de confidentialité d'Apple</a>.
      </p>
      <h3 class="display">Tes droits</h3>
      <p>
        Ces traitements reposent sur l'intérêt légitime à faire fonctionner le jeu (RGPD, article 6.1.f), et les données restent hébergées en France. Pour exercer tes
        droits d'accès, de rectification ou d'effacement, passe par <router-link :to="{ hash: '#contact' }">Contact</router-link>. Tu peux aussi adresser une
        réclamation à la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">CNIL</a>.
      </p>
    </section>

    <section id="regles" class="panel glass">
      <h2 class="display">Règles d'usage</h2>
      <ul>
        <li>Pas de pseudo offensant, haineux ou qui se fait passer pour quelqu'un d'autre. Le chef de partie peut exclure un joueur.</li>
        <li>Pas de triche automatisée ni de surcharge volontaire du serveur.</li>
        <li>Le jeu est fourni tel quel, sans garantie : il peut changer, être interrompu ou s'arrêter, par exemple si des extraits ne sont plus disponibles chez Apple.</li>
      </ul>
    </section>

    <section id="contact" class="panel glass">
      <h2 class="display">Contact</h2>
      <p>Pour une question, une demande de retrait, une demande sur tes données ou une année erronée :</p>
      <ul class="contacts">
        <li><v-icon icon="mdi-chat" size="20" /> Discord : <strong>OverAngelix</strong></li>
        <li>
          <v-icon icon="mdi-at" size="20" /> X (Twitter) :
          <a href="https://x.com/OverAngelix" target="_blank" rel="noopener"><strong>@OverAngelix</strong></a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.legal {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 820px;
  margin: 0 auto;
  padding: 20px 16px 48px;
  user-select: text;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head h1,
.head p {
  margin: 0;
}
.mark {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}
.small {
  font-size: 0.9rem;
}
.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* Pastilles répétées : fond simple, pas de .glass (flou coûteux sur téléphone). */
.toc-link {
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--glass);
  border: 1px solid var(--border);
  color: inherit;
  font-size: 0.9rem;
  text-decoration: none;
}
.toc-link:hover {
  border-color: rgba(255, 255, 255, 0.32);
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 22px;
  scroll-margin-top: 16px;
  line-height: 1.55;
}
.panel h2 {
  margin: 0;
  font-size: 1.3rem;
}
.panel h3 {
  margin: 6px 0 0;
  font-size: 1.05rem;
}
.panel p,
.panel ul {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
}
.panel ul {
  padding-left: 1.2em;
}
.panel li + li {
  margin-top: 4px;
}
.panel a {
  color: var(--cyan);
}
.panel strong {
  color: #fff;
}
code {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--glass-strong);
  font-size: 0.85em;
}
.contacts {
  list-style: none;
  padding-left: 0 !important;
}
.contacts .v-icon {
  margin-right: 4px;
  color: var(--pink);
}
</style>
