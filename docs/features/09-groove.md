# 09 · Groove (jouer pendant le tour des autres)

Statut : Terminé (une décision reste à prendre sur la victoire)

Pour qu'on ne s'ennuie pas pendant le tour des autres : chaque joueur voit la frise du joueur en cours sur son écran et peut, lui aussi, y placer le titre. Il doit être plus rapide que le joueur en cours. Un placement juste rapporte un **point groove** (logo : une boule disco). On a donc deux scores : les cartes de sa frise et ses points groove.

## Règles

- [x] Pendant le tour d'Ana, chaque autre joueur peut placer le titre dans la frise d'Ana, **une seule fois**, sans revenir en arrière
- [x] Seulement après le lancement de l'extrait (sinon ce serait du hasard)
- [x] Seulement avant qu'Ana place sa carte : dès qu'elle a placé, c'est trop tard (« Trop tard : le titre a déjà été placé »)
- [x] Points uniquement dans la frise des autres : le joueur en cours ne peut pas placer en groove dans la sienne
- [x] Correction sur la frise d'Ana telle qu'elle était **avant** son placement ; années égales acceptées comme pour une carte normale
- [x] Tour passé (joueur déconnecté) : les placements groove déjà faits sont corrigés quand même
- [x] Un joueur qui quitte la partie : son placement groove du tour est oublié
- [x] Les points groove ne comptent pas pour la victoire, qui ne dépend que des frises ; ils départagent seulement l'ordre d'affichage du récapitulatif
- [ ] À décider : faire compter les points groove (cartes + groove, ou groove pour départager une égalité en tête au lieu de rejouer un tour)

## Serveur

- [x] Moteur : `Game.placeGroove`, `Player.groove`, correction dans `placeCard` et `skipTurn` (`settleGroove`), `PlacementResult.groove`
- [x] Protocole : message `player:groove` (position), `PlayerView.groove`, `GameView.grooveGuessIds` (qui a placé, jamais où, pour que le joueur en cours ne s'en inspire pas), `lastResult.groove` (positions et verdicts, révélés après le placement)
- [x] Règle de placement (`isCorrectPlacement`, `correctPositions`) déplacée dans `game/types.ts`, partagé avec le client, pour afficher les bonnes réponses
- [x] Tests : moteur (points, refus, tour passé, départ), salle (secret de la position, révélation, trop tard), lecture du message

## Interface

- [x] Manette du joueur qui attend : frise du joueur en cours, « Placer ici » avec la boule disco (grisé avant l'écoute), puis « Placé » ; son score « Toi : 3 cartes · 1 groove »
- [x] Manette du joueur en cours : « 1 joueur a déjà placé » pour mettre la pression
- [x] Écran hôte pendant le tour : « Les autres : placez aussi ce titre dans cette frise depuis votre écran, avant Ana, pour un point groove. 1/2 ont placé. » et une pastille sur chaque joueur qui a placé
- [x] Révélation, écran hôte : « Ben a aussi trouvé » (si Ana a trouvé), « Ben a trouvé » (si elle a raté), « Ben et Cléo ont aussi trouvé », « Personne n'a trouvé » ; rien si personne n'a tenté
- [x] Révélation, téléphone : uniquement son propre résultat, s'il a placé (« Toi aussi ! », « Toi, tu as trouvé ! », « Toi non plus… », « Toi, tu n'as pas trouvé… »)
- [x] Pas d'avatar sur la frise pour le groove : juste le texte de qui a trouvé
- [x] Points groove dans la barre des joueurs de l'écran hôte et au récapitulatif (« 0 groove »)
- [x] Logo : boule disco dessinée en SVG (`DiscoBall.vue`), Material Design Icons n'en ayant pas
- [x] Test de bout en bout : Ben place en groove pendant le tour d'Ana, l'écran et Ana le voient, verdict et résultat groove vérifiés sur l'écran et sur le téléphone

## Idées hors cadre (non demandées)

- [ ] Garder la position de son placement groove après un rechargement de la page (aujourd'hui, seul « Placé » reste affiché)
- [ ] Manette sur un PC : agrandir l'écran groove (il garde la taille d'un téléphone sur un grand écran)
- [ ] Son ou animation quand un joueur place en groove, sur l'écran hôte
- [ ] Classement groove à la fin de la partie (meilleur « groover »)
