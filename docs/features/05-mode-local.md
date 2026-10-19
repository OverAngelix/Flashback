# 05 · Mode local (style Jackbox)

Statut : En cours (jouable de bout en bout, à éprouver sur de vrais appareils)

Fonctionnement calqué sur les jeux Jackbox : un PC ou une télé **héberge** la partie, l'hôte **n'est pas un joueur**. Seules les personnes qui rejoignent jouent, depuis leur téléphone ou leur navigateur de PC, avec le code affiché sur l'écran. Le son sort de l'écran hôte.

Client : Vite, Vue 3, Vuetify 4, TypeScript (`client/`). Écran hôte : `client/src/views/HostView.vue`. Manette : `PlayView.vue`, `components/PlayJoin.vue`, `components/PlayTurn.vue`.

## Écran hôte (PC ou télé)

- [x] Création de la partie et affichage du code de salle (6 caractères) et de l'adresse à taper sur le téléphone
- [x] Sélection des catégories avant le lancement (voir [02-categories.md](02-categories.md))
- [x] Salle d'attente : joueurs connectés avec leur nom et leur avatar, exclusion d'un joueur, bouton de lancement
- [x] Lecture de l'extrait sur l'écran hôte (le clic de création débloque l'audio ; bandeau « Touche l'écran » si le navigateur bloque quand même)
- [x] Plateau : joueur actif, frise du joueur actif, barre des joueurs avec leur nombre de cartes
- [x] Révélation du titre, de l'artiste et de l'année après chaque placement
- [x] Récapitulatif des frises de tous les joueurs après chaque tour de plateau
- [x] Écran de fin avec le ou les gagnants
- [x] Passer le tour d'un joueur déconnecté
- [x] Reprise de l'écran après un rechargement de la page (code et jeton mémorisés)
- [ ] Vérifier la lisibilité sur une vraie télé (tailles de texte, distance)
- [ ] Faire avancer la partie sans souris ni clavier (depuis un téléphone, ou automatiquement après quelques secondes) : une télé n'a pas toujours de pointeur
- [ ] Code QR pour rejoindre sans taper l'adresse
- [ ] Empêcher la mise en veille de l'écran pendant la partie (Wake Lock)

## Manette joueur (téléphone ou PC)

- [x] Saisie du code de salle (ou lien direct `/join/CODE`)
- [x] Choix du nom et d'un avatar parmi 10 avant de rejoindre ; les avatars déjà pris sont grisés en direct
- [x] Écran d'attente quand ce n'est pas son tour (frise du joueur actif visible)
- [x] Au tour du joueur : bouton « Écouter » (l'écran hôte joue le son), frise défilante avec emplacements entre les cartes, bouton « Placer ici »
- [x] Paysage obligatoire pendant la partie : écran « Tourne ton téléphone » tant que le téléphone est en portrait (le salon et la saisie du nom restent possibles en portrait ; le formulaire passe sur deux colonnes en paysage)
- [x] Reprise automatique après une coupure ou un rechargement, et dès le réveil du téléphone
- [ ] Verrouillage d'orientation en plein écran (Android seulement, optionnel)
- [ ] Essai sur de vrais téléphones iOS et Android (testé jusqu'ici dans Chrome de bureau en émulation tactile)

## Récapitulatif après chaque tour de plateau

Un « tour de plateau » = tous les joueurs ont joué une fois. À la fin, l'écran hôte affiche la frise de chaque joueur (avatar, nom, cartes dans l'ordre chronologique avec l'année) avant de passer au tour suivant.

- [x] Écran de récapitulatif sur l'hôte et sur les manettes
- [x] Bouton « Tour suivant » (touche Entrée ou Espace aussi) ; un double clic est ignoré par le serveur
- [ ] Durée d'affichage automatique (à décider avec l'avancement sans pointeur)
- [ ] Mise en évidence des cartes gagnées pendant le tour
