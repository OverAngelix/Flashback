# 07 · Interface et identité visuelle

Statut : Terminé (à valider sur de vrais appareils)

Direction : « néon sur fond de nuit », disques vinyle et notes de musique. Thème sombre rose, violet et cyan, polices Fredoka (titres) et Outfit (texte) **embarquées** dans le client (les téléphones d'un réseau local n'ont pas forcément accès à Internet).

- [x] Thème et système de style : variables et classes dans `client/src/styles.css`, thème Vuetify dans `client/src/plugins/vuetify.ts`
- [x] Écran de démarrage : disque vinyle géant qui tourne dans un coin, logo, note de musique qui tourne sur elle-même dans un anneau lumineux (`MusicLoader`) ; il dure au moins 1,7 s (0,7 s quand on reprend une partie) et disparaît en fondu ; `?nosplash` le désactive (tests)
- [x] Chargement : la note qui tourne remplace les indicateurs classiques (création de la salle, connexion à la partie, reconnexion)
- [x] Fond animé (halos qui dérivent) et surfaces en verre dépoli
- [x] Menu principal : le titre en haut, puis une grille de 2 boîtes sur 2 (Héberger, Rejoindre, Multijoueur grisé « Bientôt », Paramètres), adaptée à la hauteur de l'écran (tient à 1280x720) ; `/host` sans partie en cours renvoie au menu (le clic sur « Héberger » débloque aussi le son)
- [x] Page Paramètres : volume des extraits, musique de menu (activer, volume), animations réduites, écran de démarrage, nom par défaut proposé pour rejoindre, quitter la partie mémorisée ; réglages enregistrés dans le navigateur (`client/src/settings.ts`)
- [x] Musique de menu « ascenseur » générée par l'API Web Audio (`menuScore.ts` pour la partition, `menuMusic.ts` pour le son) : piano électrique, basse, balais, vibraphone, grille de 8 accords qui boucle ; aucun fichier audio ni droit musical ; elle démarre au premier toucher (les navigateurs l'imposent), s'arrête en entrant dans une partie, se coupe avec le bouton du menu
- [x] Salon de l'écran hôte en trois zones séparées : informations de la partie (code, QR code, adresse), joueurs et catégories dans deux panneaux, barre de lancement
- [x] Salon de l'écran hôte : code en grosses tuiles, QR code, joueurs qui apparaissent avec une animation, catégories en cartes
- [x] Tour : disque vinyle qui tourne pendant l'extrait, égaliseur, tableau des joueurs avec le joueur actif en lumière
- [x] Cartes en pochettes (année en pastille sur l'image), frise posée sur un fil chronologique, emplacements qui pulsent
- [x] Révélation : confettis si bon placement, secousse sinon ; fin de partie : trophée et confettis
- [x] Transitions entre écrans (page et phase), `prefers-reduced-motion` respecté
- [x] Lisible sur un écran de 740x300 (téléphone en paysage) et de 320 à 390 px de large en portrait
- [ ] Sons d'interface et jingle de victoire
- [ ] Écouter la musique de menu sur de vrais haut-parleurs et ajuster le mixage (vérifié seulement par mesure : niveau, saturation, silences)
- [ ] Icône d'application (favicon, écran d'accueil du téléphone) et manifeste web
- [ ] Vérifier le rendu sur de vrais téléphones iOS et Android et sur une vraie télé
