# 11 · Commentateur

Statut : Bêta (voix provisoires)

Un présentateur de quiz télé exubérant, sur l'écran hôte uniquement : à certains moments de la partie, il dit une phrase enregistrée, tirée au hasard dans une banque. Rien ne s'affiche : c'est une voix seulement. Les phrases ne citent personne (un enregistrement ne connaît pas les prénoms ; le nom du joueur est déjà à l'écran).

## Règles

- [x] En bêta : interrupteur « Commentateur » marqué « Bêta » dans le salon, **coupé par défaut** ; le chef ou l'hôte l'active, réglage gardé quand on rejoue
- [x] Écran hôte seulement ; jamais en solo, jamais sur les téléphones
- [x] Moments : lancement, titre bien placé, raté de 2 ans ou moins, raté mais trouvé en groove, raté de 20 ans ou plus, autre raté, fin de tour de plateau, égalité en tête à l'objectif, victoire ; rien pour un tour passé (joueur absent)
- [x] Jamais deux fois de suite la même phrase pour un même moment ; une nouvelle phrase coupe la précédente
- [x] Pendant qu'il parle, l'extrait baisse (30 % du volume) puis remonte
- [x] Rien au chargement ni à la reconnexion de l'écran hôte (seul un changement de phase le fait parler)

## Réalisation

- [x] Serveur : `host:setCommentator` (message de contrôle, salon uniquement), réglage de la `Room`, `GameView.commentator` ; tests
- [x] Client : banque `src/commentatorLines.json`, choix du moment `src/commentator.ts` (`situationFor`, `pickLine`, testés), `useCommentator` dans `HostView`, voix et baisse de l'extrait dans `src/audio.ts`, interrupteur `CommentatorToggle` (écran hôte et téléphone du chef)
- [x] Fichiers audio : `public/commentator/<id>.m4a`, produits par `npm run commentator:build` (macOS) à partir des enregistrements de `client/commentator/recordings/`, ou à défaut d'une voix provisoire (`say`, voix Thomas) ; liste à enregistrer dans `client/commentator/phrases.md`
- [x] Test de bout en bout : interrupteur, annonce du lancement, réaction au placement, extrait baissé
- [ ] Enregistrer les 41 phrases avec une vraie voix et remplacer les voix provisoires
- [ ] Sortir de la bêta (activé par défaut ?) une fois les vraies voix en place
- [ ] Écouter le mixage voix et extrait sur de vrais haut-parleurs
