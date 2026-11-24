# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Flashback : un jeu de type Hitster. On écoute un extrait de 30 s et on le place au bon endroit dans sa frise chronologique d'après l'année de sortie. TypeScript partout (serveur et client). Usage entre amis pour le moment.

- **Mode local, style Jackbox** : un PC ou une télé héberge la partie et joue le son. L'hôte n'est **pas** un joueur. Les joueurs rejoignent avec un code depuis un téléphone ou un navigateur, après avoir choisi un nom et un avatar parmi 10. Après chaque tour de plateau, l'hôte affiche un récapitulatif de la frise de chaque joueur.
- **Solo** : sur un seul appareil (écran et manette), partie libre (catégories au choix, 3 vies) ou campagne de 12 niveaux (titres tirés au sort, 3 vies, une étoile par vie restante).
- **Mode en ligne** : reporté à la V2.
- Règles : Hitster de base, avec fin de partie à la fin du tour de plateau (tous les joueurs jouent autant). Un seul meilleur joueur à l'objectif ou plus gagne (10 cartes par défaut, réglable de 3 à 10 dans le salon) ; en cas d'égalité en tête, on rejoue un tour (l'objectif monte d'une carte).

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
npm run catalog:check       # vérifie les liens Apple (HEAD), renouvelle les morts via lookup -> data/catalog.json
npm run catalog:verify      # recoupe les années avec MusicBrainz -> data/year-report.json
```

Depuis `client/` (Vite, Vue 3, Vuetify 4) :

```
npm run dev          # serveur de dev Vite (relaie /api et /ws vers le serveur sur le port 3000)
npm run type-check   # vue-tsc, sur le code puis sur vite.config.ts
npm run build        # type-check puis vite build -> client/dist, que le serveur sert ensuite sur /
npm test             # vitest (connexion, avatars, QR code, adresse de jonction) ; un seul fichier : npx vitest run src/net/connection.test.ts
npm run commentator:build   # macOS : voix du commentateur -> public/commentator/*.m4a (enregistrements, sinon voix provisoire say)
```

Depuis `e2e/` : `npm test` joue deux tours (un écran hôte, deux téléphones en paysage, Ana chef de partie, qui règle l'objectif à 5 cartes et active le commentateur, puis Ben, qui place aussi en groove pendant le tour d'Ana), puis le solo (niveau 1 de la campagne et partie libre ; l'année du titre en cours est retrouvée dans `catalog.json` d'après l'extrait joué) dans un vrai Chrome contre le vrai serveur et le vrai catalogue. Prérequis : `npm run build` dans `server/` et dans `client/`, et Chrome (variable `CHROME_PATH` si le chemin n'est pas standard). Le script démarre lui-même le serveur (port 3399, `E2E_PORT`) et écrit des captures dans `e2e/shots/`. Les tests unitaires et le build ne voient pas les problèmes de rendu : relancer ce test après toute modification de l'interface, et regarder les captures.

Versions : le serveur est en TypeScript 7 (`tsconfig.json` doit déclarer `"types": ["node"]`), le client en TypeScript 6.0.3 car `vue-tsc` ne fonctionne pas avec TypeScript 7.

## Architecture du serveur

- `src/game/` : le moteur Hitster (`Game`), pur et sans réseau, c'est la seule source des règles. La règle de placement (`isCorrectPlacement`, `correctPositions`) est dans `types.ts`, partagé avec le client. Il manipule des `GameTrack` qui contiennent l'année : toute vue envoyée à un client devra masquer titre, artiste et année du titre courant jusqu'à la phase `reveal`.
- `src/catalog/store.ts` : `loadCatalog` ne garde que les titres qui ont `previewUrl` et `artworkUrl` ; `Catalog.select(categories)` (selon `matchesSelection` ; une salle part de `select([])`, tout le catalogue) fournit au moteur les entrées elles-mêmes (pas des copies : un lien renouvelé profite aux parties en cours), sans celles marquées `unavailable`.
- `src/catalog/links.ts` : extraits et pochettes sont lus chez Apple par les navigateurs. `watchLinks` (lancé par `index.ts`) vérifie au démarrage puis toutes les 24 h chaque lien (HEAD) ; un 4xx déclenche `lookup?id=` (boutique de l'origine, puis US, FR), sinon le titre passe `unavailable` jusqu'à la vérification suivante. 429, 5xx et erreurs réseau ne concluent rien. Corrections en mémoire seulement (`catalog.json` est dans l'image) ; `npm run catalog:check` les écrit dans le fichier. `/api/health` donne `tracks` (jouables), `unavailable` et `linksCheckedAt`.
- `src/net/protocol.ts` : le protocole WebSocket (messages client → serveur validés par `parseClientMessage`, messages serveur, `GameView`). `src/net/view.ts` construit la vue envoyée à tous les clients ; `src/net/ws.ts` branche `/ws` sur le serveur HTTP avec un ping de 20 s.
- `src/rooms/` : `Room` (une partie, l'hôte, les joueurs, la diffusion de l'état) et `RoomManager`/`Session` (code de 6 caractères, routage des messages, nettoyage). Ils ne connaissent que l'interface `Connection`, donc se testent sans réseau. Hôte et joueurs se reconnectent avec un jeton reçu dans le message `session`.
- Le serveur sert aussi `client/dist` sur `/` (repli vers `index.html` pour `/host`, `/play`, `/join/CODE`). Fichiers lus à la demande : pas besoin de redémarrer après un `npm run build` du client.
- Chef de partie : `Room.leaderId` (premier joueur arrivé ; remplacé par le premier joueur connecté s'il se déconnecte, et il le reste si l'ancien revient). `Session` laisse un joueur envoyer les messages de `CONTROL_MESSAGE_TYPES` (`host:setCategories|setCardsToWin|start|advance|skipTurn|kick|replay`) seulement s'il est chef ; `host:create` et `host:rejoin` restent réservés à l'hôte. `GameView.leaderId` l'expose.
- Une seule écoute de l'extrait par tour : `Game.listen` (drapeau `listened`, remis à zéro à chaque pioche) ; `Room` ne la consomme que si l'écran hôte est connecté.
- Groove : pendant le tour d'un autre, après l'écoute, chaque joueur peut placer le titre une fois dans la frise du joueur actif (`player:groove`, `Game.placeGroove`). Les placements sont corrigés par `settleGroove` sur la frise d'avant le placement du joueur actif (dans `placeCard` et `skipTurn`) ; un juste vaut `Player.groove + 1`, sans effet sur la victoire. Pendant le tour, `GameView.grooveGuessIds` ne dit que qui a placé (jamais où) ; `lastResult.groove` révèle positions et verdicts.
- Objectif : `Game.setCardsToWin` (salon uniquement, de `MIN_CARDS_TO_WIN` à `MAX_CARDS_TO_WIN`, soit 3 à 10), via `host:setCardsToWin` ; exposé par `GameView.cardsToWin`.
- Solo : `Game` avec l'option `solo` (`SoloState` : vies, objectif ; un seul joueur, pas de récapitulatif, `round` compte les titres, fin après la révélation de la dernière vie ou de l'objectif). Message `solo:create` (`level` ou null) : `Room` sans écran hôte, le joueur est chef de partie, `player:play` consomme l'écoute sans `audio:play` (l'appareil joue l'extrait lui-même) ; un niveau démarre tout de suite ; `player:leave` supprime la salle. Niveaux : `src/game/campaign.ts`, partagé avec le client. `GameView.solo`.
- Commentateur : `host:setCommentator` (message de contrôle, salon uniquement) règle `Room.commentator` (bêta : faux par défaut, gardé quand on rejoue), exposé par `GameView.commentator`. Le serveur ne fait rien d'autre : c'est l'écran hôte qui parle.
- Rejouer : `host:replay` (partie terminée, sinon ignoré) appelle `Game.reset` (retour au salon, frises et groove à zéro, nouveau paquet, objectif gardé) dans la même salle ; `Room` y retire les joueurs partis depuis la fin (plus de jeton : une partie terminée garde ses joueurs pour le classement).
- `host:advance` porte la phase quittée (`from`) : un message en double ou obsolète est ignoré sans erreur, ce qui rend le double clic inoffensif.
- Quitter : `player:leave` retire le joueur à tout moment (`Game.removePlayer` gère le tour en cours) ; `host:close` supprime la salle et envoie `closed` aux joueurs. `connection.leave()` côté client envoie le bon message selon le rôle.
- `src/http/app.ts` : Fastify. Volontairement aucune route ne renvoie les titres ou les années (un test le vérifie) ; `/api/rooms/:code` renseigne le formulaire d'entrée. Plus de route `/media` : les clients reçoivent les adresses Apple (`previewUrl` comme `audioUrl`, `artworkUrl` comme `imageUrl`).

## Architecture du client

- `src/net/connection.ts` : connexion WebSocket unique (`useConnection()`), état réactif, file d'attente avant l'ouverture, reconnexion avec le jeton (délai 1 s à 8 s, immédiate au réveil de l'appareil), session mémorisée dans `localStorage` pour reprendre après un rechargement. Testée avec un faux WebSocket.
- `src/views/` : `HomeView`, `HostView` (écran hôte, une section par phase), `PlayView` (manette). Les composants partagés sont dans `src/components/` : `TimelineStrip` (frise défilante, interactive côté joueur), `TrackCard`, `RevealPanel`, `RecapPanel`.
- `src/audio.ts` : l'écran hôte joue les extraits. Le clic « Créer une partie » appelle `unlockAudio()`, ce qui autorise ensuite la lecture sans geste.
- Les types et constantes du protocole viennent du serveur via l'alias `@server` (`../server/src`). N'importer que `net/protocol.ts`, `game/types.ts`, `game/campaign.ts` et `catalog/types.ts` : `shared-purity.test.ts` vérifie qu'ils n'importent rien de Node.
- Le QR code (`src/qr.ts`, bibliothèque `qrcode`) encode `joinLink(joinBase(...), code)` (`src/joinUrl.ts`) : sur `localhost`, l'adresse du réseau local donnée par `/api/network`. Ses tests le décodent avec `jsqr`.
- Pendant le tour d'un autre, la manette montre la frise du joueur actif, pour y placer le titre (`PlayGroove`). À la révélation, tous les écrans montrent cette frise : `RevealPanel` passe à `TimelineStrip` la frise d'avant le placement, la carte jouée (`placed`, verte ou rouge via `TrackCard` `tone`) et, si elle est fausse, les emplacements justes (`solutions`, calculés par `correctPositions`) ; le groove n'y est qu'une ligne de texte : « X et Y ont (aussi) trouvé » sur l'écran hôte, le seul résultat du spectateur (« Toi non plus… ») quand `viewerId` est donné et à n'afficher que sa propre frise au récapitulatif (`RecapPanel`).
- Récapitulatif et fin sur l'écran hôte : `HostView` passe en hauteur fixe (`.fit`, 100dvh) et `RecapPanel fill` fait défiler tout seul la liste des frises si elle dépasse (`src/autoScroll.ts`, fonction pure testée, animée par `useAutoScroll`) ; la page elle-même ne défile pas.
- `CategoryPicker` : une ligne de pastilles par axe (`AXES` et icônes dans `src/categories.ts`), une catégorie sans titre est grisée.
- Les points groove ont pour logo `DiscoBall` (SVG maison, MDI n'a pas de boule disco).
- Écrans peu hauts (téléphone en paysage, environ 300 px utiles) : cartes et emplacements rétrécis par media query (`TrackCard`, `TimelineStrip`), boutons de jeu dans la colonne de gauche (`PlayTurn`).
- Menu (`HomeView`) : cinq boîtes sur deux rangées (Héberger, Rejoindre, Solo ; puis Multijoueur, grisé (V2), et Paramètres). Seul « Héberger » crée une salle (`connection.createRoom()` puis `/host`) ; `HostView` sans session renvoie au menu. Tailles du menu en `dvh` : le tester à 1280x720.
- Nouveautés : `src/news.ts` (`RELEASES`, de la plus ancienne à la plus récente ; un même `id` dans une version suivante remplace l'élément pour un nouveau venu, `update`/`updateTitle` en donnent la formulation pour un ancien joueur) et `NewsDialog`, monté par `App.vue` sur `/` après l'écran de démarrage. Fermer la modale enregistre la version dans `localStorage` (`flashback.news`). Publier une version = ajouter une entrée à la fin de `RELEASES`.
- Commentateur (écran hôte) : `src/commentatorLines.json` (banque, identifiants stables : ce sont les noms des fichiers), `src/commentator.ts` (`situationFor` déduit le moment du passage d'une vue à la suivante, rien au premier état reçu ; `pickLine` sans répétition), `useCommentator` dans `HostView`, `playVoice` dans `src/audio.ts` (second élément audio, débloqué par `unlockAudio` ; l'extrait baisse à 30 % tant que `audio.speaking` est vrai ; rien n'est affiché à l'écran, le texte des phrases ne sert qu'à les enregistrer). Fichiers `public/commentator/<id>.m4a` produits par `scripts/commentator.mjs` : enregistrement de `commentator/recordings/<id>.*` s'il existe, sinon voix provisoire `say` ; `commentator/manifest.json` dit d'où vient chaque fichier et `commentator/phrases.md` liste les phrases à enregistrer. Un test vérifie qu'aucun fichier ne manque : après un ajout dans la banque, relancer le script.
- Réglages : `src/settings.ts` (enregistrés dans `localStorage`, invalides ignorés champ par champ), page `SettingsView`. `?nosplash` coupe l'écran de démarrage.
- Musique de menu : `src/menuScore.ts` (partition pure et testée, graine reproductible) et `src/menuMusic.ts` (Web Audio, un seul `AudioContext` fermé après un fondu). Lancée par `App.vue` seulement sur `/`, `/settings` et `/solo`. Pour la vérifier sans l'écouter, `renderOffline()` mesure niveau, crête et silences ; elle est exposée sur `window.__menuMusic` uniquement quand `navigator.webdriver` est vrai (navigateur piloté).
- Commandes partagées par l'écran hôte et le téléphone du chef : `src/composables/useControls.ts` (catégories, effacées d'un coup par `clearCategories`, objectif, lancement, suite, tour passé, exclusion). Le choix de l'objectif (`GoalPicker`) est dans la ligne de lancement sur l'écran hôte, sous les catégories sur le téléphone du chef.
- Style : `src/styles.css` (variables `--pink`, `--violet`…, classes `.glass`, `.display`, `.grad-text`, boutons `.btn-primary|success|ghost`), polices Fredoka et Outfit embarquées. Éléments visuels : `BrandMark`, `DiscoBall`, `MusicLoader` (la note qui tourne), `VinylDisc`, `Equalizer`, `Confetti`, `AppBackground`, `SplashScreen` (désactivé par `?nosplash`).
- Les avatars sont des icônes `mdi-*` dans `src/avatars.ts` ; l'index est l'identifiant échangé avec le serveur.
- Solo : `SoloView` (`/solo`, partie libre et carte de la campagne) et `SoloPlayView` (`/solo/play`). `PlayTurn` reçoit `audio-url` pour jouer l'extrait pendant le geste (lecture autorisée sur mobile) et un slot `head`. Étoiles et records : `src/soloProgress.ts` (`localStorage`). `useSoloStart` crée la partie (nom des paramètres, avatar 0). `PlayView` renvoie une session solo vers `/solo/play`. Un niveau démarrant sans salon, `SoloPlayView` le présente d'abord (`showIntro` : premier titre pas encore écouté, fermé localement par « C'est parti »), puis affiche son nom dans le slot `head`.
- Pendant la partie, la manette affiche `RotateOverlay` tant que le téléphone est en portrait (`useOrientation`).

Pièges d'interface rencontrés (aucun n'est vu par le type-check ni le build) :

- Un état global créé à la demande (`useXxx()` avec un `watch` qui enregistre dans `localStorage`) hérite de la portée du premier composant qui l'appelle : quand ce composant disparaît, le `watch` s'arrête et plus rien n'est enregistré (perte au rechargement). Créer ce `watch` dans `effectScope(true)` (voir `soloProgress.ts`).
- Une même classe CSS définie deux fois dans un fichier (ex. `.info` dans deux sections de `HostView`) : la seconde écrase la première. Donner un nom propre à chaque bloc.

- Un style `scoped` d'une vue s'applique aussi à la **racine** des composants enfants : ne pas réutiliser le nom de classe de la racine d'un composant (`.reveal`, `.recap`) dans la vue qui l'utilise (les vues préfixent `h-` et `p-`).
- `.glass` applique un flou d'arrière-plan (`backdrop-filter`) recalculé à chaque image au-dessus du fond animé (`AppBackground`) : sur téléphone, une vingtaine d'éléments flous suffisent à faire ramer la page. Le réserver aux grands panneaux ; pour les pastilles et boutons répétés (`CategoryPicker`, `GoalPicker`, `PlayersBar`), un fond `var(--glass)` avec bordure `var(--border)`.
- Deux `<Transition>` ne doivent pas se retrouver sur le même élément racine (celle du routeur et celle d'une vue) : leurs classes se gênent et l'élément reste bloqué à `opacity: 0`. Chaque vue a une racine `<div>` unique. Le test de bout en bout le vérifie avec `painted()`.

Pièges de Vuetify 4 rencontrés :

- Les classes `text-h1` à `text-h6`, `text-subtitle-*` et `text-caption` n'existent plus : utiliser `text-display-*`, `text-headline-*`, `text-title-*`, `text-body-*`, `text-label-*`.
- `:model-value` sur un `v-chip` en contrôle la visibilité : un `false` cache la pastille. Pour une sélection, jouer sur `variant`, `color` et `prepend-icon`.
- `v-btn block` a `flex: 1 0 auto` : dans une colonne flex il s'étire en hauteur. Utiliser `class="w-100"`.

## Catalogue musical

La chaîne complète se lit en croisant plusieurs fichiers :

- `server/src/catalog/source-tracks.ts` : la liste d'origine, rangée par origine, une ligne `"Titre - Artiste | genre, genre"` par morceau. C'est la seule entrée à modifier pour ajouter des titres ou changer leurs genres. La partie « Titre - Artiste » est la clé de cache (`query`) : la modifier relance la recherche iTunes ; les genres et l'origine sont relus à chaque `catalog:build`.
- `server/src/catalog/types.ts` : `CatalogTrack`, les trois axes de catégories (`ORIGINS` avec la boutique iTunes interrogée en premier, `ERAS` déduites de l'année par `eraOf`, `GENRES`) et la règle de sélection `matchesSelection` (OU dans un axe, ET entre axes, rien de coché = tout). Partagé avec le client.
- `server/data/catalog.json` : généré, mais **modifiable à la main pour corriger une année** : changer `year` et mettre `yearSource` à `"manual"`. Les scripts ne la touchent plus ensuite, même avec `--refresh`. Ne pas supprimer ce fichier sans le sauvegarder (les corrections n'existent que là).
- Pas de médias stockés : `previewUrl` et `artworkUrl` (600x600) de `catalog.json` sont lus chez Apple, qui demande de diffuser les extraits plutôt que de les héberger. Le jeu a donc besoin d'Internet.

Pièges connus :

- La date iTunes est celle du fichier trouvé, pas de l'œuvre : remaster, compilation, remix donnent des années fausses. Le script prend la sortie la plus ancienne parmi les résultats retenus et écarte live, remix, karaoké, hommages (regex `ALT_VERSION` dans `build-catalog.ts`), mais des erreurs subsistent (ex. 1948 pour « Rock Around the Clock », 1995 pour « Sous le vent »). Toute année `yearSource: "itunes"` est non vérifiée.
- Dans `year-report.json`, seul le statut `earlier` est un signal. `later` désigne en général une autre version de l'enregistrement dans MusicBrainz et ne prouve rien.
- iTunes limite à environ 20 requêtes par minute ; le script attend 3,2 s entre deux appels. MusicBrainz tolère 1 requête par seconde.
- iTunes renvoie souvent des variantes (remix, a cappella, réenregistrement « 2024 Version », « Sped Up », « Spanglish »…) et des compilations aux dates absurdes (1900, 1949). `ALT_VERSION` couvre l'anglais et le français, et `altParenthetical` refuse toute parenthèse qui parle de version, mix ou edit sauf celles de `BENIGN_VERSION`. Après un `catalog:build`, regarder `match.trackName` des nouveaux titres. Pour forcer une nouvelle recherche, retirer l'entrée de `catalog.json` (en gardant son année si elle est `manual`). Si la recherche s'obstine sur une mauvaise version, imposer le titre dans la liste source : `"Titre - Artiste | genres | itunes:<trackId>"` (recherche `lookup`).
- L'année retenue est celle de la sortie originale, pas celle où le titre a cartonné.
- Certains tubes n'existent pas dans l'API de recherche (Bad Bunny, NTM, Booba, PNL) : les remplacer plutôt que de forcer.
- Les titres de la liste d'origine peuvent être inexacts (« Les yeux revolver » est en réalité « Elle a les yeux revolver ») : un échec de correspondance vient souvent de là, regarder `catalog-misses.json`.

## Déploiement

Sur le VPS, comme SDPC (GitHub Actions, registre privé, K3s, Keel, Traefik) : voir [DEPLOY.md](DEPLOY.md). L'image client se construit depuis la racine du dépôt (alias `@server`), et Traefik envoie `/api` et `/ws` au serveur. Aucun média à envoyer : seul `catalog.json`, dans l'image.

## Conventions de commit

Définies dans [.claude/commands/commit.md](.claude/commands/commit.md) (commande `/commit`) :

- Titre : `[#<issue>][<scope>][<type>] <description courte>`, 72 caractères au plus (balises comprises), en français, au présent ou à l'infinitif, sans point final.
- `#<issue>` : numéro du ticket, sinon `#-`.
- `<scope>` : `server`, `client` ou `conf` (outillage, configuration racine, `CLAUDE.md`, `.claude/`, `.gitignore`). Deux scopes au plus, séparés par une virgule ; au-delà, scinder le commit.
- `<type>` : `F` feature, `B` bugfix, `R` refactor, `D` documentation, `C` chore, `T` test.
- Corps : une ligne `- <fichier ou zone> : <changement>` par élément modifié, séparé du titre par une ligne vide.
- Aucune signature ni ligne `Co-Authored-By`.
- Indexer les fichiers explicitement (jamais `git add -A` à l'aveugle), ne pas embarquer de fichier généré ni de secret (`.env`, `node_modules`, `dist`), et ne jamais pousser sans demande explicite.
