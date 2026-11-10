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
- [x] Victoire : on termine toujours le tour de plateau ; à la fin du tour, un seul joueur en tête avec au moins 10 cartes (`cardsToWin`, configurable) gagne
- [x] Égalité en tête : on rejoue un tour, l'objectif monte à 11, 12…
- [x] Paquet épuisé : la partie se termine, victoire à égalité possible
- [x] Paquet modifiable avant le départ (`setTracks`, pour le choix des catégories) et tour passé par l'hôte (`skipTurn`)
- [x] Une seule écoute de l'extrait par tour (`listen`, drapeau `listened`)
- [x] Tests unitaires des règles (23 tests)

Décisions : tous les joueurs jouent le même nombre de tours. Atteindre 10 cartes ne met pas fin à la partie en cours de tour de plateau ; la victoire est évaluée à la fin du tour. Seule exception : le paquet épuisé met fin à la partie immédiatement.
