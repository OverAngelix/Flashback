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
- [x] Piloter la partie sans toucher à l'écran : le chef de partie (premier joueur arrivé, puis le suivant s'il se déconnecte) choisit les catégories, lance la partie, fait avancer et passe un tour depuis son téléphone ; l'écran hôte garde ses propres commandes
- [x] L'écran hôte montre le chef de partie (couronne) et le dit dans le salon
- [ ] Avancement automatique optionnel après quelques secondes (pour une partie sans aucun pilotage)
- [x] Code QR pour rejoindre sans taper l'adresse : il mène à `/join/CODE` (code pré-rempli) et utilise l'adresse du réseau local, jamais `localhost`
- [ ] Empêcher la mise en veille de l'écran pendant la partie (Wake Lock)
- [x] Quitter l'écran met fin à la partie pour tout le monde (`host:close`, confirmation s'il y a des joueurs) : la salle est supprimée et les téléphones reviennent à l'accueil avec « L'hôte a mis fin à la partie »
- [x] L'extrait s'éteint en fondu d'une seconde dès qu'on quitte son tour (joueur suivant, récapitulatif, fin de partie, départ du joueur actif)

## Manette joueur (téléphone ou PC)

- [x] Saisie du code de salle, ou lien direct `/join/CODE` (QR code) : dans ce cas le champ code disparaît, il ne reste que le nom et l'avatar (bouton « Changer » pour corriger)
- [x] Choix du nom et d'un avatar parmi 10 avant de rejoindre ; les avatars déjà pris sont grisés en direct
- [x] Salon du chef de partie : catégories et bouton de lancement ; « Continuer », « Tour suivant » et « Passer son tour » aux bons moments
- [x] Chaque joueur voit sa propre frise quand ce n'est pas son tour, à la révélation et au récapitulatif (l'écran principal montre celle du joueur actif)
- [x] Au tour du joueur : bouton « Écouter » (l'écran hôte joue le son, une seule écoute par tour), frise défilante avec emplacements entre les cartes, bouton « Placer ici » ; les deux boutons sont dans la colonne de gauche, visibles même sur un écran de 740x300
- [x] L'écran hôte suit l'écoute : attente du lancement, « Écoute… », puis « place le titre dans sa frise » à la fin de l'extrait
- [x] Formulaire d'entrée sans débordement de 320 à 390 px de large
- [x] Paysage obligatoire pendant la partie : écran « Tourne ton téléphone » tant que le téléphone est en portrait (le salon et la saisie du nom restent possibles en portrait ; le formulaire passe sur deux colonnes en paysage)
- [x] Reprise automatique après une coupure ou un rechargement, et dès le réveil du téléphone
- [x] Bouton « Quitter » toujours visible pendant la partie (coin supérieur droit, confirmation) : le joueur est retiré avec sa frise ; si c'était son tour, le titre est défaussé et la main passe au suivant ; sous 2 joueurs, la partie se termine et le meilleur restant gagne
- [ ] Verrouillage d'orientation en plein écran (Android seulement, optionnel)
- [ ] Essai sur de vrais téléphones iOS et Android (testé jusqu'ici dans Chrome de bureau en émulation tactile)

## Récapitulatif après chaque tour de plateau

Un « tour de plateau » = tous les joueurs ont joué une fois. À la fin, l'écran hôte affiche la frise de chaque joueur (avatar, nom, cartes dans l'ordre chronologique avec l'année) avant de passer au tour suivant.

- [x] Écran de récapitulatif sur l'hôte et sur les manettes
- [x] Bouton « Tour suivant » (touche Entrée ou Espace aussi) ; un double clic est ignoré par le serveur
- [ ] Durée d'affichage automatique (à décider avec l'avancement sans pointeur)
- [ ] Mise en évidence des cartes gagnées pendant le tour
