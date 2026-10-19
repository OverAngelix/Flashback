# 05 · Mode local (style Jackbox)

Statut : À faire

Fonctionnement calqué sur les jeux Jackbox : un PC ou une télé **héberge** la partie, l'hôte **n'est pas un joueur**. Seules les personnes qui rejoignent jouent, depuis leur téléphone ou leur navigateur de PC, avec le code affiché sur l'écran. Le son sort de l'écran hôte.

## Écran hôte (PC ou télé)

- [ ] Création de la partie et affichage du code de salle
- [ ] Sélection des catégories avant le lancement (voir [02-categories.md](02-categories.md))
- [ ] Salle d'attente : joueurs connectés avec leur nom et leur avatar, bouton de lancement
- [ ] Lecture de l'extrait sur l'écran hôte
- [ ] Plateau : joueur actif, titre à placer, frise du joueur actif
- [ ] Révélation du titre, de l'artiste et de l'année après chaque placement
- [ ] **Récapitulatif des frises de tous les joueurs après chaque tour de plateau** (voir ci-dessous)
- [ ] Écran de fin avec le gagnant
- [ ] Lisibilité sur télé (grandes tailles, contraste)

## Manette joueur (téléphone ou PC)

- [ ] Saisie du code de salle
- [ ] Choix du nom et d'un avatar parmi 10 avant de rejoindre (voir [04-salles-temps-reel.md](04-salles-temps-reel.md))
- [ ] Écran d'attente quand ce n'est pas son tour
- [ ] Au tour du joueur : placement de la carte dans sa frise
- [ ] Appui pour lancer l'extrait (geste utilisateur exigé par les navigateurs)

## Récapitulatif après chaque tour de plateau

Un « tour de plateau » = tous les joueurs ont joué une fois. À la fin, l'écran hôte affiche la frise de chaque joueur (avatar, nom, cartes dans l'ordre chronologique avec l'année) avant de passer au tour suivant.

- [ ] Écran de récapitulatif sur l'hôte
- [ ] Durée d'affichage ou bouton « continuer » (à décider)
- [ ] Mise en évidence des cartes gagnées pendant le tour
