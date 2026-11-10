# Flashback

Un jeu de société musical dans l'esprit de **Hitster**, à jouer entre amis sur une télé (ou un PC) et des téléphones. On écoute un extrait de 30 secondes et on le place au bon endroit dans sa frise chronologique, d'après son année de sortie. Le premier à remplir sa frise gagne.

Le fonctionnement est celui des jeux **Jackbox** : un écran (télé ou PC) héberge la partie, joue le son et affiche le plateau. Il n'est pas un joueur. Les joueurs rejoignent depuis leur téléphone en scannant un QR code.

## Comment jouer

1. Sur la télé ou le PC, ouvrir le jeu et choisir **Créer une partie**. Un code à 6 caractères et un QR code s'affichent.
2. Chaque joueur scanne le QR code avec son téléphone (même réseau Wi-Fi), choisit un **nom** et un **avatar** parmi 10, puis rejoint la partie. Le premier arrivé devient **chef de partie** : il peut choisir les catégories et lancer la partie depuis son téléphone, sans toucher à l'écran.
3. Chacun reçoit une carte de départ. À son tour, le joueur actif appuie sur **Écouter** : l'extrait se joue sur l'écran principal, **une seule fois**. Il place ensuite le titre à l'endroit qu'il pense juste dans **sa frise** (téléphone tenu en **paysage**), puis valide.
4. L'écran révèle le titre, l'artiste et l'année. Bien placé, la carte rejoint la frise ; mal placé, elle est perdue.
5. Après chaque tour de plateau, l'écran affiche la frise de chaque joueur.
6. La partie se termine à la fin d'un tour de plateau (tous les joueurs ont joué autant) quand un seul joueur a le plus de cartes avec au moins 10. En cas d'égalité en tête, on rejoue un tour.

## Installation et lancement

Prérequis : **Node.js 24** (testé avec 24.11) et npm. Le serveur et les téléphones doivent être sur le même réseau.

```bash
# 1. Serveur : dépendances, compilation, extraits audio et pochettes (une seule fois, environ 100 Mo)
cd server
npm install
npm run build
npm run catalog:download

# 2. Client
cd ../client
npm install
npm run build

# 3. Lancer (le serveur sert aussi le client)
cd ../server
npm start
```

Le serveur écoute sur le port 3000 (variable `PORT`) et affiche son adresse sur le réseau local. Ouvrez-la sur la télé ou le PC.

Sans `npm run catalog:download`, le serveur démarre mais ignore tous les titres dont les fichiers sont absents.

## Développement

```bash
cd server && npm run dev       # serveur avec rechargement
cd client && npm run dev       # client Vite (relaie /api, /media et /ws vers le serveur sur le port 3000)
```

| Où | Commande | Ce que ça fait |
| --- | --- | --- |
| `server/` | `npm test` | tests du moteur de jeu, des salles et du WebSocket |
| `server/` | `npm run type-check` | vérification des types |
| `client/` | `npm test` | tests de la connexion, des avatars, du QR code |
| `client/` | `npm run build` | vérification des types puis compilation dans `client/dist` |
| `e2e/` | `npm test` | joue deux tours avec un écran hôte et deux téléphones dans un vrai Chrome |

Le test de bout en bout (`e2e/`) exige Chrome et que `server/` et `client/` soient compilés (`npm run build`). Il écrit des captures d'écran dans `e2e/shots/`. Les tests unitaires et le build ne voient pas les problèmes d'affichage : il faut le relancer après une modification de l'interface.

## Fonctionnement

- **`server/`** : Node, TypeScript, Fastify et WebSocket. Le moteur de règles (`src/game/`) est pur et sans réseau. Les salles (`src/rooms/`) gèrent l'hôte, les joueurs, le chef de partie et les reconnexions. Le serveur ne révèle jamais le titre, l'artiste ni l'année d'un extrait avant son placement, et il ne rappelle jamais iTunes pendant une partie : il sert ses propres fichiers.
- **`client/`** : Vite, Vue 3, Vuetify 4 et TypeScript. Un seul client pour l'écran hôte et la manette des joueurs.
- **`e2e/`** : le test de bout en bout.
- **`docs/features/`** : le suivi des fonctionnalités, avec leurs sous-tâches et les décisions prises.
- **`CLAUDE.md`** : l'architecture en détail et les pièges rencontrés, utile pour qui reprend le code.

## Le catalogue musical

Le catalogue (`server/data/catalog.json`) compte 94 titres, en chanson française et en musique internationale. Les extraits de 30 secondes et les pochettes viennent de l'API de recherche d'iTunes, puis sont stockés sur le serveur.

Pour ajouter des titres : ajouter une ligne `"Titre - Artiste"` dans `server/src/catalog/source-tracks.ts`, puis lancer `npm run catalog:build` et `npm run catalog:download` dans `server/`.

La date renvoyée par iTunes est celle du fichier trouvé (réédition, compilation, remaster) et pas toujours celle de la sortie originale. **Vérifiez les années.** Pour en corriger une, modifiez `year` dans `catalog.json` et passez `yearSource` à `"manual"` : les scripts n'y touchent plus. `npm run catalog:verify` recoupe les années avec MusicBrainz et signale les doutes.

## Limites à connaître

- **Usage privé, entre amis.** Il n'y a ni compte, ni limite de débit, et le jeu est servi en HTTP sur le réseau local. Une mise en ligne publique demanderait de revoir cela.
- **Droits musicaux.** Les extraits sont ceux que propose publiquement iTunes. Les conditions d'Apple et les droits des œuvres sont à vérifier avant toute diffusion au-delà d'un cercle privé.
- **Appareils.** L'interface a été vérifiée dans Chrome, y compris en émulation de téléphone en paysage. Elle n'a pas encore été essayée sur de vrais iPhone, Android ou télé.
- **Mode en ligne** (chaque joueur sur son propre appareil, sans écran commun) : prévu pour la V2.
