# 00 · Socle du projet

Statut : En cours

- [x] Package `server` TypeScript (NodeNext, strict) avec scripts `build`, `type-check`, `catalog:build`
- [x] `.gitignore` racine
- [x] `CLAUDE.md` à jour avec les commandes
- [x] Dépôt git initialisé (branche `main`)
- [x] Package `client` : Vite, Vue 3, Vuetify 4, vue-router, TypeScript 6 (vue-tsc n'est pas compatible avec TypeScript 7, utilisé par le serveur)
- [x] Types partagés serveur/client : le client importe `net/protocol.ts`, `game/types.ts` et `catalog/types.ts` via l'alias `@server` ; un test garantit que ces fichiers n'importent rien de Node
- [x] Test de bout en bout (`e2e/`) : un hôte et deux téléphones jouent un tour dans un vrai Chrome
- [x] Serveur HTTP (Fastify) : catégories, extraits audio et pochettes servis depuis `server/data/media/` (requêtes Range gérées pour Safari/iOS)
- [x] Scripts `dev`, `start`, `test` ; tests avec le runner de Node (`tsx --test`)
- [x] Le serveur sert aussi le client compilé (`client/dist`) avec repli vers `index.html`
