# 04 · Salles et temps réel

Statut : Terminé (hors limite de débit, voir plus bas)

WebSocket sur le même port que le HTTP, chemin `/ws` (bibliothèque `ws`). Code dans `server/src/net/` (protocole, vue, WebSocket) et `server/src/rooms/` (salle et gestionnaire). Le gestionnaire est indépendant de WebSocket : les tests l'utilisent avec de fausses connexions, et un second jeu de tests passe par de vrais sockets.

## Serveur

- [x] Serveur WebSocket sur le port HTTP, messages limités à 4 Ko, texte uniquement
- [x] Création d'une salle avec un code de 6 caractères (sans I, O, 0, 1), saisie insensible à la casse
- [x] Rejoindre avec un code, un nom et un avatar (0 à 9) ; `GET /api/rooms/:code` donne les avatars déjà pris pour griser le formulaire, sans révéler les noms
- [x] Validation du nom et de l'avatar côté serveur (nom unique, 16 caractères, avatar unique)
- [x] Rôles : l'hôte (écran, ne joue pas) et les joueurs ; chaque message est réservé à son rôle
- [x] Chef de partie (`leaderId` dans l'état) : premier joueur arrivé, remplacé par le premier joueur connecté s'il se déconnecte ou part, et il le reste même si l'ancien revient ; il peut envoyer `host:setCategories`, `host:setCardsToWin`, `host:start`, `host:advance`, `host:skipTurn`, `host:kick` (pas `host:create` ni `host:rejoin`, et il ne peut pas s'exclure)
- [x] Protocole de messages typé et validé (`server/src/net/protocol.ts`)
- [x] Vue publique de l'état, identique pour tous : jamais le titre, l'artiste, l'année ni la pochette du titre courant avant la révélation (testé)
- [x] Lancement de l'extrait : le joueur actif envoie `player:play` (une seule fois par tour, et seulement si l'écran est connecté), l'hôte reçoit `audio:play` et joue le son ; l'état porte `listened`
- [x] Déconnexion : le joueur reste dans la partie, marqué absent ; il revient avec son jeton (`player:rejoin`) ; l'hôte aussi (`host:rejoin`)
- [x] Battement de cœur (ping toutes les 20 s) pour détecter un téléphone en veille
- [x] L'hôte peut passer le tour d'un joueur absent (`host:skipTurn`) et exclure un joueur dans le salon (`host:kick`)
- [x] Nettoyage des salles sans connexion depuis 30 min, plafond de 100 salles
- [ ] Limite de débit par connexion (non fait : usage entre amis)
- [x] Protocole partagé avec le client (alias `@server`)
- [x] Reprise automatique de l'hôte et des joueurs après rechargement ou coupure (code et jeton mémorisés dans le navigateur)
- [x] `host:advance` indique la phase quittée : un message en double (double clic) est ignoré

## Messages (résumé)

Client → serveur : `host:create`, `host:rejoin`, `host:setCategories`, `host:setCardsToWin` (de 3 à 10), `host:start`, `host:advance` (avec `from`), `host:skipTurn`, `host:kick`, `player:join`, `player:rejoin`, `player:place`, `player:play`, `player:leave`.

Serveur → client : `session` (jeton à conserver), `state` (vue complète à chaque changement, `you` = identifiant du joueur ou null pour l'hôte), `audio:play`, `kicked`, `error` (`bad-message`, `room-not-found`, `not-allowed`, `rule`, `internal`).

## Client

- [x] 10 avatars (icônes d'animaux colorées, `client/src/avatars.ts`)
