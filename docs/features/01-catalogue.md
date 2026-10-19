# 01 · Catalogue musical

Statut : En cours

Le catalogue est construit par des scripts (dans `server/`) à partir de `server/src/catalog/source-tracks.ts` :

1. `npm run catalog:build` : cherche chaque titre sur iTunes et écrit `server/data/catalog.json`.
2. `npm run catalog:download` : télécharge les extraits de 30 s et les pochettes dans `server/data/media/` (ignoré par git, à regénérer).
3. `npm run catalog:verify` : recoupe les années avec MusicBrainz (`server/data/year-report.json`, ignoré par git).

Le serveur sert ses propres fichiers : aucun appel à iTunes pendant une partie.

## Version 100 titres

- [x] Format de données (`CatalogTrack`) et catégories (`server/src/catalog/types.ts`)
- [x] Liste source (94 titres uniques : 45 FR, 49 internationaux)
- [x] Script de récupération iTunes (cache incrémental, limite de débit, reprise après erreur, repli sur plusieurs boutiques)
- [x] Filtrage des versions parasites (live, remix, karaoké, hommage, commentaires…) et choix de la sortie la plus ancienne
- [x] Téléchargement local des extraits et pochettes (94 titres, 30 s chacun vérifiés)
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
- [ ] Rafraîchissement des extraits via `lookup?id=` si une URL iTunes change
- [ ] Contrôle qualité sur l'ensemble (doublons, versions, années)
- [ ] Prévoir la taille du stockage : 94 titres = environ 100 Mo, soit environ 1 Go pour 1000 titres
