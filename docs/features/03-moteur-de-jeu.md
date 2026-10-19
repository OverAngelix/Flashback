# 03 · Moteur de jeu (règles Hitster de base)

Statut : Terminé

Logique pure côté serveur (`server/src/game/`), indépendante du réseau et du mode de jeu. Classe `Game` : `addPlayer`, `start`, `placeCard`, `advance`. Les actions invalides lèvent une `GameError` au message lisible par un joueur.

Déroulement : `lobby` → `awaiting-placement` → `reveal` → (fin de tour de plateau : `round-recap`) → `awaiting-placement` … → `finished`.

- [x] Modèle d'état : joueurs (nom, avatar), frise de chacun, titre en cours, tour actif
- [x] Joueurs : nom unique et limité à 16 caractères, avatar unique parmi 10, 2 à 10 joueurs, plus d'ajout après le départ
- [x] Notion de tour de plateau (tous les joueurs ont joué une fois) : phase `round-recap` pour le récapitulatif des frises
- [x] Tirage d'un titre dans le paquet mélangé, sans répétition
- [x] Carte de départ pour chaque joueur
- [x] Placement dans la frise et validation (les années égales sont acceptées)
- [x] Carte gardée si le placement est bon, défaussée sinon
- [x] Victoire : premier joueur à 10 cartes (`cardsToWin`, configurable), fin immédiate sans récapitulatif
- [x] Paquet épuisé : la partie se termine, victoire à égalité possible
- [x] Tests unitaires des règles (17 tests)

Décisions : la partie s'arrête dès qu'un joueur atteint 10 cartes (Hitster de base), même au milieu d'un tour de plateau.
