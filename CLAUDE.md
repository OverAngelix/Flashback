# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Flashback : un jeu de type Hitster. On écoute un extrait de 30 s et on le place au bon endroit dans sa frise chronologique d'après l'année de sortie. TypeScript partout (serveur et client). Usage entre amis pour le moment.

- **Mode local, style Jackbox** : un PC ou une télé héberge la partie et joue le son. L'hôte n'est **pas** un joueur. Les joueurs rejoignent avec un code depuis un téléphone ou un navigateur, après avoir choisi un nom et un avatar parmi 10. Après chaque tour de plateau, l'hôte affiche un récapitulatif de la frise de chaque joueur.
- **Mode en ligne** : reporté à la V2.
- Règles : Hitster de base, avec fin de partie à la fin du tour de plateau (tous les joueurs jouent autant). Un seul meilleur joueur à 10 cartes ou plus gagne ; en cas d'égalité en tête, on rejoue un tour (objectif 11, 12…).

## Suivi des fonctionnalités

Le suivi est dans [docs/features/](docs/features/) (un fichier par fonctionnalité, avec des sous-tâches à cocher, et un index dans `README.md`). **Le mettre à jour à chaque avancée** : cocher les sous-tâches faites, ajouter celles qui apparaissent, corriger le statut dans l'index. Les décisions actées y sont aussi.

## Commandes

État actuel : seul le dossier `server/` existe (pas de client, pas de linter). À lancer depuis `server/` :

```
npm run dev                 # serveur HTTP en mode watch (PORT, 3000 par défaut, écoute sur le réseau local)
npm run type-check          # tsc --noEmit (tests compris)
npm run build               # tsc vers dist/ (sans les tests), puis npm start
npm test                    # node:test via tsx ; un seul fichier : npx tsx --test src/game/game.test.ts
npm run catalog:build       # iTunes -> data/catalog.json (incrémental ; -- --refresh pour tout refaire)
npm run catalog:download    # extraits 30 s + pochettes -> data/media/ (incrémental ; -- --refresh)
npm run catalog:verify      # recoupe les années avec MusicBrainz -> data/year-report.json
```

TypeScript 7 : `tsconfig.json` doit déclarer `"types": ["node"]` explicitement, sinon les types Node ne sont pas vus.

## Architecture du serveur

- `src/game/` : le moteur Hitster (`Game`), pur et sans réseau, c'est la seule source des règles. Il manipule des `GameTrack` qui contiennent l'année : toute vue envoyée à un client devra masquer titre, artiste et année du titre courant jusqu'à la phase `reveal`.
- `src/catalog/store.ts` : `loadCatalog` ne garde que les titres dont l'audio et la pochette existent sur disque ; `Catalog.select(categories)` fournit le paquet au moteur.
- `src/net/protocol.ts` : le protocole WebSocket (messages client → serveur validés par `parseClientMessage`, messages serveur, `GameView`). `src/net/view.ts` construit la vue envoyée à tous les clients ; `src/net/ws.ts` branche `/ws` sur le serveur HTTP avec un ping de 20 s.
- `src/rooms/` : `Room` (une partie, l'hôte, les joueurs, la diffusion de l'état) et `RoomManager`/`Session` (code de 6 caractères, routage des messages, nettoyage). Ils ne connaissent que l'interface `Connection`, donc se testent sans réseau. Hôte et joueurs se reconnectent avec un jeton reçu dans le message `session`.
- `src/http/app.ts` : Fastify. Volontairement aucune route ne renvoie les titres ou les années (un test le vérifie) ; `/api/rooms/:code` renseigne le formulaire d'entrée ; `/media/` sert les fichiers nommés par identifiant iTunes, avec les requêtes Range.

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

## Conventions de commit

Définies dans [.claude/commands/commit.md](.claude/commands/commit.md) (commande `/commit`) :

- Titre : `[#<issue>][<scope>][<type>] <description courte>`, 72 caractères au plus (balises comprises), en français, au présent ou à l'infinitif, sans point final.
- `#<issue>` : numéro du ticket, sinon `#-`.
- `<scope>` : `server`, `client` ou `conf` (outillage, configuration racine, `CLAUDE.md`, `.claude/`, `.gitignore`). Deux scopes au plus, séparés par une virgule ; au-delà, scinder le commit.
- `<type>` : `F` feature, `B` bugfix, `R` refactor, `D` documentation, `C` chore, `T` test.
- Corps : une ligne `- <fichier ou zone> : <changement>` par élément modifié, séparé du titre par une ligne vide.
- Aucune signature ni ligne `Co-Authored-By`.
- Indexer les fichiers explicitement (jamais `git add -A` à l'aveugle), ne pas embarquer de fichier généré ni de secret (`.env`, `node_modules`, `dist`), et ne jamais pousser sans demande explicite.
