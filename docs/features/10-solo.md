# 10 · Solo (partie libre et campagne)

Statut : Terminé (à valider sur appareils)

Jouer seul, sur un seul appareil (PC ou téléphone), qui est à la fois l'écran (il joue l'extrait) et la manette. Deux façons de jouer, depuis la boîte « Solo » du menu (`/solo`) :

- **Partie libre** : on choisit ses catégories comme dans un salon, puis on va le plus loin possible. **3 vies** : chaque erreur (ou tour passé) en coûte une, la partie s'arrête après la révélation de la troisième. Le score est la longueur de la frise ; un record est gardé par sélection de catégories.
- **Campagne** : 12 niveaux à thème, du plus facile au plus dur. Chaque niveau impose ses catégories et une frise à réunir (de 5 à 10 cartes, carte de départ comprise). Titres **tirés au sort** à chaque essai. 3 vies ; niveau réussi si la frise est complète avant la troisième erreur. **Étoiles = vies restantes** : ★★★ sans erreur, ★★ avec une, ★ avec deux. Réussir un niveau ouvre le suivant.

Décisions : 3 vies dans les deux modes (une vie perdue par erreur) ; titres de la campagne tirés au sort dans le thème (pas de liste fixe, donc pas de réponses à apprendre) ; étoiles selon les vies restantes. Progression et records gardés dans le navigateur (pas de comptes).

## Serveur

- [x] Moteur : option `solo` de `Game` (`SoloState` : `maxLives`, `lives`, `goal`), un seul joueur, vie retirée dans `placeCard` (faux) et `skipTurn`, pas de récapitulatif (`round` compte les titres), fin après la révélation (`nextSolo`, `finishSolo` : gagné s'il reste une vie et que l'objectif éventuel est atteint ; paquet épuisé = gagné en partie libre, perdu en campagne)
- [x] Niveaux : `game/campaign.ts` (`CAMPAIGN`, `campaignLevel`), partagé avec le client et ajouté à `shared-purity.test.ts`
- [x] Protocole : message `solo:create` (`name`, `avatar`, `level` ou null), `GameView.solo` (vies, objectif, niveau)
- [x] Salle solo (`Room`, option `solo`) : pas d'écran hôte, le joueur est chef de partie (catégories, lancement, « Continuer » avec les messages habituels) ; `player:play` consomme l'écoute sans écran hôte ; catégories figées en campagne ; personne ne peut la rejoindre ; supprimée quand le joueur s'en va (`player:leave`), gardée 30 min pour une reconnexion
- [x] Un niveau de campagne démarre dès la création (pas de salon)
- [x] Tests : moteur (vies, fin, objectif, paquet épuisé), salle (création, écoute sans hôte, campagne, niveau inconnu, reprise, départ), lecture du message, niveaux (catégories connues, objectifs croissants, assez de titres sur le vrai catalogue)

## Interface

- [x] Menu : boîte « Solo » (rangée Héberger, Rejoindre, Solo ; puis Multijoueur et Paramètres)
- [x] `/solo` (`SoloView`) : partie libre (avec la meilleure frise), carte de la campagne (numéro, thème, taille de la frise, étoiles, cadenas, total sur 36)
- [x] `/solo/play` (`SoloPlayView`) : salon de la partie libre (catégories, record de la sélection), tour (`PlayTurn` avec `audio-url` : l'appareil joue l'extrait pendant le geste ; cœurs et « 3 / 5 cartes » en haut), révélation (cœurs, « Continuer » ou « Voir le résultat »), fin (étoiles ou record, frise, Rejouer / Réessayer, Niveau suivant, Menu solo)
- [x] Abandon en cours de partie avec confirmation ; rechargement : reprise de la partie
- [x] Progression : `src/soloProgress.ts` (`localStorage`, meilleure note par niveau, record par sélection, dernier score de la partie libre, déblocage), testée
- [x] Corrigé : la progression n'était plus enregistrée après avoir quitté `/solo` (étoiles perdues au rechargement) ; enregistrement détaché des écrans (`effectScope`)
- [x] Menu solo : meilleur score et dernier score de la partie libre
- [x] Musique de menu aussi sur `/solo`
- [x] Test de bout en bout : menu, niveau 1 avec une erreur volontaire puis sans faute (2 étoiles), rechargement en pleine partie, tour à 740x300, déblocage du niveau 2, partie libre jusqu'à la troisième erreur, record

## Idées hors cadre (non demandées)

- [ ] Choisir son avatar pour le solo (aujourd'hui l'avatar 0 et le nom des paramètres)
- [ ] Classement des records entre amis (demande un compte ou un serveur de scores)
