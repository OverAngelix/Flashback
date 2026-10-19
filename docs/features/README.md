# Suivi des fonctionnalités

Un fichier par fonctionnalité, avec ses sous-tâches. Mis à jour au fil du développement :
cocher `[x]` quand c'est fait, `[~]` quand c'est en cours, `[ ]` sinon.

| # | Fonctionnalité | Statut | Fichier |
|---|----------------|--------|---------|
| 00 | Socle du projet | Terminé | [00-socle.md](00-socle.md) |
| 01 | Catalogue musical | En cours | [01-catalogue.md](01-catalogue.md) |
| 02 | Catégories et sélection | En cours | [02-categories.md](02-categories.md) |
| 03 | Moteur de jeu (règles Hitster) | Terminé | [03-moteur-de-jeu.md](03-moteur-de-jeu.md) |
| 04 | Salles et temps réel | Terminé (hors limite de débit) | [04-salles-temps-reel.md](04-salles-temps-reel.md) |
| 05 | Mode local (style Jackbox) | En cours | [05-mode-local.md](05-mode-local.md) |
| 06 | Mode en ligne | V2 | [06-mode-en-ligne.md](06-mode-en-ligne.md) |

Statuts : À faire · En cours · Terminé · V2 (reporté).

## Décisions actées

- TypeScript partout (serveur et client).
- Règles Hitster de base : frise chronologique, on place le titre au bon endroit selon l'année de sortie.
- Usage entre amis pour le moment (pas de contrainte d'hébergement public).
- Extraits audio de 30 s via l'API de recherche iTunes ; le catalogue est figé côté serveur (pas d'appel iTunes pendant une partie).
- Mode local style Jackbox : l'hôte (PC ou télé) affiche le plateau et joue le son, mais n'est pas un joueur. Les joueurs rejoignent avec un code depuis un téléphone ou un navigateur de PC.
- Avant de rejoindre, chaque joueur choisit un nom et un avatar parmi 10.
- Le code de salle fait 6 caractères.
- Après chaque tour de plateau, l'hôte affiche un récapitulatif de la frise de chaque joueur.
- Le mode en ligne est reporté à la V2.
- Front : Vite, Vue 3, Vuetify 4 et TypeScript.
- Sur téléphone, le jeu se joue en paysage (obligatoire pendant la partie) pour faire glisser la frise.
- Le joueur doit toucher l'écran pour lancer la musique (restriction d'autoplay des navigateurs mobiles).
- Version actuelle : 100 titres. Version finale : environ 1000.
