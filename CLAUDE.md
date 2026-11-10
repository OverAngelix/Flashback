# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Flashback : un jeu de type Hitster. On écoute un extrait de 30 s et on le place au bon endroit dans sa frise chronologique d'après l'année de sortie. TypeScript partout (serveur et client). Usage entre amis pour le moment.

- **Mode local, style Jackbox** : un PC ou une télé héberge la partie et joue le son. L'hôte n'est **pas** un joueur. Les joueurs rejoignent avec un code depuis un téléphone ou un navigateur, après avoir choisi un nom et un avatar parmi 10. Après chaque tour de plateau, l'hôte affiche un récapitulatif de la frise de chaque joueur.
- **Mode en ligne** : reporté à la V2.
- Règles : Hitster de base, avec fin de partie à la fin du tour de plateau (tous les joueurs jouent autant). Un seul meilleur joueur à 10 cartes ou plus gagne ; en cas d'égalité en tête, on rejoue un tour (objectif 11, 12…).

## Suivi des fonctionnalités

Pour une vue globale du jeu (rôles, déroulement d'une partie, règles, imprévus gérés, état d'avancement), lire d'abord [docs/features/vue-d-ensemble.md](docs/features/vue-d-ensemble.md).

Le suivi est dans [docs/features/](docs/features/) (un fichier par fonctionnalité, avec des sous-tâches à cocher, et un index dans `README.md`). La vue d'ensemble est à tenir à jour quand une fonctionnalité visible par les joueurs change ou qu'un domaine change d'état. **Le mettre à jour à chaque avancée** : cocher les sous-tâches faites, ajouter celles qui apparaissent, corriger le statut dans l'index. Les décisions actées y sont aussi.

## Commandes

Trois packages indépendants, chacun avec son `npm install` : `server/`, `client/` et `e2e/`. Pas de linter. Depuis `server/` :

```
npm run dev                 # serveur HTTP en mode watch (PORT, 3000 par défaut, écoute sur le réseau local)
npm run type-check          # tsc --noEmit (tests compris)
npm run build               # tsc vers dist/ (sans les tests), puis npm start
npm test                    # node:test via tsx ; un seul fichier : npx tsx --test src/game/game.test.ts
npm run catalog:build       # iTunes -> data/catalog.json (incrémental ; -- --refresh pour tout refaire)
npm run catalog:download    # extraits 30 s + pochettes -> data/media/ (incrémental ; -- --refresh)
npm run catalog:verify      # recoupe les années avec MusicBrainz -> data/year-report.json
```

Depuis `client/` (Vite, Vue 3, Vuetify 4) :

```
npm run dev          # serveur de dev Vite (relaie /api, /media et /ws vers le serveur sur le port 3000)
npm run type-check   # vue-tsc, sur le code puis sur vite.config.ts
npm run build        # type-check puis vite build -> client/dist, que le serveur sert ensuite sur /
npm test             # vitest (connexion, avatars, QR code, adresse de jonction) ; un seul fichier : npx vitest run src/net/connection.test.ts
```

Depuis `e2e/` : `npm test` joue deux tours (un écran hôte, deux téléphones en paysage, Ana chef de partie puis Ben) dans un vrai Chrome contre le vrai serveur et le vrai catalogue. Prérequis : `npm run build` dans `server/` et dans `client/`, et Chrome (variable `CHROME_PATH` si le chemin n'est pas standard). Le script démarre lui-même le serveur (port 3399, `E2E_PORT`) et écrit des captures dans `e2e/shots/`. Les tests unitaires et le build ne voient pas les problèmes de rendu : relancer ce test après toute modification de l'interface, et regarder les captures.

Versions : le serveur est en TypeScript 7 (`tsconfig.json` doit déclarer `"types": ["node"]`), le client en TypeScript 6.0.3 car `vue-tsc` ne fonctionne pas avec TypeScript 7.

## Architecture du serveur

- `src/game/` : le moteur Hitster (`Game`), pur et sans réseau, c'est la seule source des règles. Il manipule des `GameTrack` qui contiennent l'année : toute vue envoyée à un client devra masquer titre, artiste et année du titre courant jusqu'à la phase `reveal`.
- `src/catalog/store.ts` : `loadCatalog` ne garde que les titres dont l'audio et la pochette existent sur disque ; `Catalog.select(categories)` fournit le paquet au moteur.
- `src/net/protocol.ts` : le protocole WebSocket (messages client → serveur validés par `parseClientMessage`, messages serveur, `GameView`). `src/net/view.ts` construit la vue envoyée à tous les clients ; `src/net/ws.ts` branche `/ws` sur le serveur HTTP avec un ping de 20 s.
- `src/rooms/` : `Room` (une partie, l'hôte, les joueurs, la diffusion de l'état) et `RoomManager`/`Session` (code de 6 caractères, routage des messages, nettoyage). Ils ne connaissent que l'interface `Connection`, donc se testent sans réseau. Hôte et joueurs se reconnectent avec un jeton reçu dans le message `session`.
- Le serveur sert aussi `client/dist` sur `/` (repli vers `index.html` pour `/host`, `/play`, `/join/CODE`). Fichiers lus à la demande : pas besoin de redémarrer après un `npm run build` du client.
- Chef de partie : `Room.leaderId` (premier joueur arrivé ; remplacé par le premier joueur connecté s'il se déconnecte, et il le reste si l'ancien revient). `Session` laisse un joueur envoyer les messages de `CONTROL_MESSAGE_TYPES` (`host:setCategories|start|advance|skipTurn|kick`) seulement s'il est chef ; `host:create` et `host:rejoin` restent réservés à l'hôte. `GameView.leaderId` l'expose.
- Une seule écoute de l'extrait par tour : `Game.listen` (drapeau `listened`, remis à zéro à chaque pioche) ; `Room` ne la consomme que si l'écran hôte est connecté.
- `host:advance` porte la phase quittée (`from`) : un message en double ou obsolète est ignoré sans erreur, ce qui rend le double clic inoffensif.
- Quitter : `player:leave` retire le joueur à tout moment (`Game.removePlayer` gère le tour en cours) ; `host:close` supprime la salle et envoie `closed` aux joueurs. `connection.leave()` côté client envoie le bon message selon le rôle.
- `src/http/app.ts` : Fastify. Volontairement aucune route ne renvoie les titres ou les années (un test le vérifie) ; `/api/rooms/:code` renseigne le formulaire d'entrée ; `/media/` sert les fichiers nommés par identifiant iTunes, avec les requêtes Range.

## Architecture du client

- `src/net/connection.ts` : connexion WebSocket unique (`useConnection()`), état réactif, file d'attente avant l'ouverture, reconnexion avec le jeton (délai 1 s à 8 s, immédiate au réveil de l'appareil), session mémorisée dans `localStorage` pour reprendre après un rechargement. Testée avec un faux WebSocket.
- `src/views/` : `HomeView`, `HostView` (écran hôte, une section par phase), `PlayView` (manette). Les composants partagés sont dans `src/components/` : `TimelineStrip` (frise défilante, interactive côté joueur), `TrackCard`, `RevealPanel`, `RecapPanel`.
- `src/audio.ts` : l'écran hôte joue les extraits. Le clic « Créer une partie » appelle `unlockAudio()`, ce qui autorise ensuite la lecture sans geste.
- Les types et constantes du protocole viennent du serveur via l'alias `@server` (`../server/src`). N'importer que `net/protocol.ts`, `game/types.ts` et `catalog/types.ts` : `shared-purity.test.ts` vérifie qu'ils n'importent rien de Node.
- Le QR code (`src/qr.ts`, bibliothèque `qrcode`) encode `joinLink(joinBase(...), code)` (`src/joinUrl.ts`) : sur `localhost`, l'adresse du réseau local donnée par `/api/network`. Ses tests le décodent avec `jsqr`.
- Chaque manette montre la frise de son joueur (jamais celle du joueur actif, visible sur l'écran hôte) ; `RevealPanel` et `RecapPanel` prennent `viewerId`.
- Écrans peu hauts (téléphone en paysage, environ 300 px utiles) : cartes et emplacements rétrécis par media query (`TrackCard`, `TimelineStrip`), boutons de jeu dans la colonne de gauche (`PlayTurn`).
- Menu (`HomeView`) : quatre boîtes, dont « Multijoueur » grisé (V2). Seul « Héberger » crée une salle (`connection.createRoom()` puis `/host`) ; `HostView` sans session renvoie au menu. Tailles du menu en `dvh` : le tester à 1280x720.
- Réglages : `src/settings.ts` (enregistrés dans `localStorage`, invalides ignorés champ par champ), page `SettingsView`. `?nosplash` coupe l'écran de démarrage.
- Musique de menu : `src/menuScore.ts` (partition pure et testée, graine reproductible) et `src/menuMusic.ts` (Web Audio, un seul `AudioContext` fermé après un fondu). Lancée par `App.vue` seulement sur `/` et `/settings`. Pour la vérifier sans l'écouter, `renderOffline()` mesure niveau, crête et silences ; elle est exposée sur `window.__menuMusic` uniquement quand `navigator.webdriver` est vrai (navigateur piloté).
- Commandes partagées par l'écran hôte et le téléphone du chef : `src/composables/useControls.ts` (catégories, lancement, suite, tour passé, exclusion).
- Style : `src/styles.css` (variables `--pink`, `--violet`…, classes `.glass`, `.display`, `.grad-text`, boutons `.btn-primary|success|ghost`), polices Fredoka et Outfit embarquées. Éléments visuels : `BrandMark`, `MusicLoader` (la note qui tourne), `VinylDisc`, `Equalizer`, `Confetti`, `AppBackground`, `SplashScreen` (désactivé par `?nosplash`).
- Les avatars sont des icônes `mdi-*` dans `src/avatars.ts` ; l'index est l'identifiant échangé avec le serveur.
- Pendant la partie, la manette affiche `RotateOverlay` tant que le téléphone est en portrait (`useOrientation`).

Pièges d'interface rencontrés (aucun n'est vu par le type-check ni le build) :

- Une même classe CSS définie deux fois dans un fichier (ex. `.info` dans deux sections de `HostView`) : la seconde écrase la première. Donner un nom propre à chaque bloc.

- Un style `scoped` d'une vue s'applique aussi à la **racine** des composants enfants : ne pas réutiliser le nom de classe de la racine d'un composant (`.reveal`, `.recap`) dans la vue qui l'utilise (les vues préfixent `h-` et `p-`).
- Deux `<Transition>` ne doivent pas se retrouver sur le même élément racine (celle du routeur et celle d'une vue) : leurs classes se gênent et l'élément reste bloqué à `opacity: 0`. Chaque vue a une racine `<div>` unique. Le test de bout en bout le vérifie avec `painted()`.

Pièges de Vuetify 4 rencontrés :

- Les classes `text-h1` à `text-h6`, `text-subtitle-*` et `text-caption` n'existent plus : utiliser `text-display-*`, `text-headline-*`, `text-title-*`, `text-body-*`, `text-label-*`.
- `:model-value` sur un `v-chip` en contrôle la visibilité : un `false` cache la pastille. Pour une sélection, jouer sur `variant`, `color` et `prepend-icon`.
- `v-btn block` a `flex: 1 0 auto` : dans une colonne flex il s'étire en hauteur. Utiliser `class="w-100"`.

## Catalogue musical

La chaîne complète se lit en croisant plusieurs fichiers :

- `server/src/catalog/source-tracks.ts` : la liste d'origine, une ligne `"Titre - Artiste"` par morceau, par catégorie. C'est la seule entrée à modifier pour ajouter des titres.
- `server/src/catalog/types.ts` : `CatalogTrack`, et les catégories avec la boutique iTunes interrogée en premier.
- `server/data/catalog.json` : généré, mais **modifiable à la main pour corriger une année** : changer `year` et mettre `yearSource` à `"manual"`. Les scripts ne la touchent plus ensuite, même avec `--refresh`. Ne pas supprimer ce fichier sans le sauvegarder (les corrections n'existent que là).
- `server/data/media/` : audio et images, ignoré par git, regénérable. Le jeu ne doit jamais appeler iTunes pendant une partie : le serveur sert ses propres fichiers (`audioFile`, `imageFile`).

Pièges connus :

- La date iTunes est celle du fichier trouvé, pas de l'œuvre : remaster, compilation, remix donnent des années fausses. Le script prend la sortie la plus ancienne parmi les résultats retenus et écarte live, remix, karaoké, hommages (regex `ALT_VERSION` dans `build-catalog.ts`), mais des erreurs subsistent (ex. 1948 pour « Rock Around the Clock », 1995 pour « Sous le vent »). Toute année `yearSource: "itunes"` est non vérifiée.
- Dans `year-report.json`, seul le statut `earlier` est un signal. `later` désigne en général une autre version de l'enregistrement dans MusicBrainz et ne prouve rien.
- iTunes limite à environ 20 requêtes par minute ; le script attend 3,2 s entre deux appels. MusicBrainz tolère 1 requête par seconde.
- Les titres de la liste d'origine peuvent être inexacts (« Les yeux revolver » est en réalité « Elle a les yeux revolver ») : un échec de correspondance vient souvent de là, regarder `catalog-misses.json`.

## Déploiement

Sur le VPS, comme SDPC (GitHub Actions, registre privé, K3s, Keel, Traefik) : voir [DEPLOY.md](DEPLOY.md). L'image client se construit depuis la racine du dépôt (alias `@server`), et Traefik envoie `/api`, `/media` et `/ws` au serveur. Les médias ne sont pas dans l'image : rsync vers le VPS, puis redémarrage du serveur.

## Conventions de commit

Définies dans [.claude/commands/commit.md](.claude/commands/commit.md) (commande `/commit`) :

- Titre : `[#<issue>][<scope>][<type>] <description courte>`, 72 caractères au plus (balises comprises), en français, au présent ou à l'infinitif, sans point final.
- `#<issue>` : numéro du ticket, sinon `#-`.
- `<scope>` : `server`, `client` ou `conf` (outillage, configuration racine, `CLAUDE.md`, `.claude/`, `.gitignore`). Deux scopes au plus, séparés par une virgule ; au-delà, scinder le commit.
- `<type>` : `F` feature, `B` bugfix, `R` refactor, `D` documentation, `C` chore, `T` test.
- Corps : une ligne `- <fichier ou zone> : <changement>` par élément modifié, séparé du titre par une ligne vide.
- Aucune signature ni ligne `Co-Authored-By`.
- Indexer les fichiers explicitement (jamais `git add -A` à l'aveugle), ne pas embarquer de fichier généré ni de secret (`.env`, `node_modules`, `dist`), et ne jamais pousser sans demande explicite.
