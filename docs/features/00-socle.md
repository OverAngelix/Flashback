# 00 · Socle du projet

Statut : En cours

- [x] Package `server` TypeScript (NodeNext, strict) avec scripts `build`, `type-check`, `catalog:build`
- [x] `.gitignore` racine
- [x] `CLAUDE.md` à jour avec les commandes
- [x] Dépôt git initialisé (branche `main`)
- [ ] Package `client` TypeScript (outil de build à choisir)
- [ ] Types partagés serveur/client (messages WebSocket, état de partie)
- [x] Serveur HTTP (Fastify) : catégories, extraits audio et pochettes servis depuis `server/data/media/` (requêtes Range gérées pour Safari/iOS)
- [x] Scripts `dev`, `start`, `test` ; tests avec le runner de Node (`tsx --test`)
- [ ] Le serveur sert aussi le client (une fois le client construit)
