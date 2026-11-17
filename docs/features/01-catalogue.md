# 01 · Catalogue musical

Statut : En cours

Le catalogue est construit par des scripts (dans `server/`) à partir de `server/src/catalog/source-tracks.ts` :

1. `npm run catalog:build` : cherche chaque titre sur iTunes et écrit `server/data/catalog.json`.
2. `npm run catalog:check` : vérifie que les liens Apple (extrait, pochette) répondent, renouvelle les liens morts via l'API `lookup` et les enregistre dans `catalog.json`.
3. `npm run catalog:verify` : recoupe les années avec MusicBrainz (`server/data/year-report.json`, ignoré par git).

Extraits et pochettes sont lus directement chez Apple par les navigateurs (rien n'est stocké sur le serveur). Le serveur vérifie leurs liens au démarrage puis chaque jour (`server/src/catalog/links.ts`) : un lien mort est renouvelé via `lookup?id=`, et un titre qu'Apple ne fournit plus est mis de côté jusqu'à la vérification suivante.

## Version 100 titres

- [x] Format de données (`CatalogTrack`) et catégories (`server/src/catalog/types.ts`)
- [x] Liste source (94 titres uniques : 45 FR, 49 internationaux)
- [x] Script de récupération iTunes (cache incrémental, limite de débit, reprise après erreur, repli sur plusieurs boutiques)
- [x] Filtrage des versions parasites (live, remix, karaoké, hommage, commentaires…) et choix de la sortie la plus ancienne
- [x] ~~Téléchargement local des extraits et pochettes~~ remplacé par la lecture directe chez Apple (voir Décisions)
- [x] Années corrigeables à la main dans `catalog.json` (`yearSource: "manual"`)
- [~] Vérification des années, titre par titre (13 titres tranchés, 27 non concluants à relire)
- [x] « Formidable » de Stromae retiré (iTunes ne propose que des reprises karaoké)
- [x] Entrées écartées de la liste d'origine :
  - « Le Freak (version française) » de Claude François : « Le Freak » est un titre de Chic, pas de Claude François ;
  - « Love Again » d'Aya Nakamura : ce titre n'existe pas chez elle (c'est un titre de Dua Lipa) ;
  - « Les yeux revolver » corrigé en « Elle a les yeux revolver » (Marc Lavoine).

## Fiabilité des années

La date iTunes est celle de la sortie du fichier trouvé : réédition, compilation ou remaster donnent parfois une date fausse pour le jeu. Chaque titre porte `yearSource` : `itunes` (non vérifié) ou `manual` (corrigé ou confirmé à la main, avec `yearNote`). Pour corriger : éditer `year` dans `catalog.json` et passer `yearSource` à `"manual"` ; les scripts ne la modifient plus, même avec `--refresh`.

- [x] Corrections ou confirmations manuelles (13 titres)
- [x] Recoupement MusicBrainz (seuls les écarts « earlier » sont des signaux ; une année MusicBrainz plus récente désigne en général une autre version)
- [x] Titres signalés par MusicBrainz tranchés : « Quand on n'a que l'amour » (1956), « Shape of You » (2017), « Someone Like You » (2011)
- [x] « Respire » (2002), « C'est la ouate » (1986) et « Sous le vent » (2000) fixés par vos soins
- [ ] 27 titres où MusicBrainz n'est pas concluant : relire leur année, en priorité « La vie en rose » de ZAZ (2013) et « Si jamais j'oublie » de Zazie (2015), qui semblent suspects
- [ ] Relire les années restantes en `itunes`

## Version finale (environ 1000 titres)

- [ ] Compléter `source-tracks.ts` (nouvelles catégories, voir [02-categories.md](02-categories.md))
- [x] Vérification quotidienne des liens Apple par le serveur, renouvellement via `lookup?id=`, titres injouables écartés (`/api/health`)
- [x] `npm run catalog:check` : même vérification, nouvelles adresses enregistrées dans `catalog.json` (94/94 valides au 17/11/2026)
- [ ] Contrôle qualité sur l'ensemble (doublons, versions, années)
- [ ] Surveiller les titres retirés par la vérification quotidienne (journal du serveur, `/api/health`) et les remplacer

## Décisions

- **Lecture directe chez Apple, plus de médias sur le serveur** (17/11/2026) : le site est en ligne, un mode hors ligne n'a pas de sens. Plus de stockage (environ 1 Mo par titre), plus de rsync, et les conditions d'Apple demandent de diffuser les extraits depuis chez eux. Contrepartie : les adresses peuvent changer, d'où la vérification quotidienne.
