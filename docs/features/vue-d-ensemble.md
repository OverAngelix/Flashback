# Vue d'ensemble du jeu

Ce que fait Flashback, du point de vue de ceux qui y jouent, et où en est chaque partie du jeu. Le détail des sous-tâches est dans les fichiers numérotés (voir l'[index](README.md)) ; l'architecture du code est dans [CLAUDE.md](../../CLAUDE.md).

## Le concept

Un jeu musical de type Hitster entre amis. À son tour, un joueur écoute un extrait de 30 s d'un titre inconnu et le place dans sa frise chronologique, entre les cartes qu'il a déjà, d'après l'année de sortie. S'il a vu juste, il garde la carte ; sinon, elle est défaussée. Le premier à construire une frise de 10 cartes gagne.

## Les rôles

| Rôle | Appareil | Ce qu'il fait |
|------|----------|---------------|
| **Écran hôte** | PC ou télé | Crée la salle, affiche le code et le QR code, joue le son, montre le plateau, les révélations et les récapitulatifs. **Il ne joue pas.** |
| **Joueur** | Téléphone (en paysage) ou navigateur | Rejoint avec un nom et un avatar, écoute l'extrait et place sa carte à son tour. Pendant le tour des autres, voit la frise du joueur en cours et peut y placer le titre pour un point groove. |
| **Chef de partie** | Le téléphone du premier joueur arrivé | Un joueur qui pilote aussi la partie (catégories, lancement, « Continuer », passer un tour, exclure) pour qu'on n'ait pas à toucher l'écran hôte. Remplacé par le joueur connecté suivant s'il se déconnecte. |

## Déroulement d'une partie

1. **Menu** (`/`) : Héberger, Rejoindre, Multijoueur (grisé, V2), Paramètres. Musique d'ambiance générée par le navigateur.
2. **Création** : « Héberger » crée une salle (code de 6 caractères) et débloque l'audio de l'écran hôte.
3. **Salon** (`lobby`) : les joueurs rejoignent en tapant le code ou en scannant le QR code (`/join/CODE`), choisissent un nom (16 caractères, unique) et un avatar parmi 10 (les avatars pris sont grisés). Le chef ou l'hôte choisit les catégories et lance la partie (2 à 10 joueurs).
4. **Départ** : chaque joueur reçoit une carte de départ, déjà révélée, dans sa frise.
5. **Tour d'un joueur** (`awaiting-placement`) : il appuie sur « Écouter » (une seule écoute par tour), l'écran hôte joue l'extrait, puis il fait défiler sa frise et choisit l'emplacement (« Placer ici »). Pendant ce temps, les autres voient sa frise sur leur écran et peuvent y placer le titre eux aussi (**groove**), une fois, et avant lui : dès qu'il a placé, c'est trop tard. L'écran montre qui a déjà placé, jamais où.
6. **Révélation** (`reveal`) : titre, artiste, année et pochette apparaissent ; confettis si c'est bon, secousse sinon. Tous les écrans montrent la frise du joueur avec sa carte à l'endroit choisi, en vert si c'est juste, en rouge sinon (avec, dans ce cas, tous les emplacements qui étaient justes en vert), et le verdict porte le nom du joueur (« Dark a trouvé ! », « Dark n'a pas trouvé… ») ; l'écran hôte dit qui a trouvé le groove (« Ben et Cléo ont aussi trouvé », « Personne n'a trouvé ») ; chaque téléphone ne donne que le résultat de son joueur (« Toi non plus… »). Détail : [09-groove.md](09-groove.md).
7. **Récapitulatif** (`round-recap`) : quand tous les joueurs ont joué une fois (un « tour de plateau »), l'écran affiche la frise de chacun, avec cartes et points groove ; chaque manette montre la frise de son joueur, centrée.
8. **Fin** (`finished`) : trophée et confettis pour le ou les gagnants.

Les titres, artistes et années du titre en cours ne quittent jamais le serveur avant la révélation.

## Règles de victoire

- On finit toujours le tour de plateau : tous les joueurs jouent le même nombre de fois.
- À la fin d'un tour de plateau, un **seul** joueur en tête avec au moins 10 cartes gagne.
- Égalité en tête : on rejoue un tour, l'objectif passe à 11, puis 12…
- Deux années égales sont acceptées dans n'importe quel ordre.
- **Points groove** (logo : boule disco) : un titre bien placé dans la frise d'un autre, pendant son tour, rapporte 1 point groove. Ils s'affichent à côté du nombre de cartes (barre des joueurs, récapitulatif, téléphone) et départagent l'ordre d'affichage du récapitulatif, mais ne comptent pas pour la victoire, qui ne dépend que des frises.
- Paquet épuisé : la partie s'arrête aussitôt, victoire partagée possible.
- Moins de 2 joueurs restants (départs) : la partie s'arrête, le meilleur restant gagne.

## Imprévus gérés

- **Coupure ou rechargement** : le joueur reste dans la partie, marqué absent, et revient automatiquement (jeton mémorisé dans le navigateur, reconnexion au réveil du téléphone). L'écran hôte aussi.
- **Joueur absent à son tour** : le chef ou l'hôte passe son tour.
- **Joueur qui quitte** (bouton « Quitter ») : il est retiré avec sa frise ; si c'était son tour, le titre est défaussé et la main passe.
- **Hôte qui quitte** : la salle est supprimée et les téléphones reviennent à l'accueil.
- **Double clic** sur « Continuer » : ignoré par le serveur.
- **Salles abandonnées** : supprimées après 30 min sans connexion (100 salles au plus).

## Le catalogue

Environ 100 titres aujourd'hui (objectif : environ 1000), en deux catégories : Chanson française et International. Extraits et pochettes viennent d'iTunes, mais sont téléchargés à l'avance et servis par le serveur : aucune requête vers iTunes pendant une partie. L'année d'iTunes est souvent fausse (rééditions, compilations), d'où un travail de vérification titre par titre (voir [01-catalogue.md](01-catalogue.md)).

## Paramètres (par navigateur)

Volume des extraits, musique de menu (activée, volume), animations réduites, écran de démarrage, nom proposé par défaut pour rejoindre, oubli de la partie mémorisée.

## État d'avancement

| Domaine | État | Reste à faire (principal) |
|---------|------|---------------------------|
| Moteur de jeu | Terminé | — |
| Salles et temps réel | Terminé | Limite de débit (non prioritaire) |
| Groove | Terminé | Décider si les points groove comptent pour la victoire |
| Mode local (hôte + manettes) | Jouable de bout en bout | Essais sur vrais téléphones et vraie télé, Wake Lock, avancement automatique, mise en évidence des cartes gagnées |
| Interface | Terminé | Sons d'interface, icône et manifeste web, validation sur appareils |
| Catalogue | 94 titres en jeu | Vérifier les années restantes, passer à environ 1000 titres |
| Catégories | 2 catégories | Décennies, genres, message quand la sélection est trop petite |
| Déploiement | Préparé dans le dépôt | Première image, secrets, domaine, médias sur le VPS |
| Mode en ligne | V2 | Tout (lecture synchronisée chez chaque joueur, parties publiques) |
