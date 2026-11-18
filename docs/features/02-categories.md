# 02 · Catégories et sélection

Statut : En cours

Les joueurs choisissent les catégories avant de lancer la partie. Un titre appartient à plusieurs catégories, réparties sur trois axes :

- **Origine** (une par titre, elle donne aussi la boutique iTunes interrogée en premier) : Français, International, Europe & Latino ;
- **Époque**, déduite de l'année : Avant 1970, Années 70, 80, 90, 2000, 2010, 2020 ;
- **Genre** (1 à 3 par titre) : Pop, Rock, Metal & hard rock, Rap & hip-hop, Rap français, R&B soul & funk, Disco, Électro & dance, Reggae, Chanson à texte, Country & folk, Jazz swing & blues.

Règle de sélection (`matchesSelection`, `server/src/catalog/types.ts`) : dans un axe, un titre doit avoir l'une des catégories cochées (OU) ; il doit satisfaire chaque axe où quelque chose est coché (ET). Rien de coché dans un axe : toutes ses catégories. Rien de coché du tout : tout le catalogue.

- [x] Catégories de départ : `fr`, `international`
- [x] Origines, époques et genres (`ORIGINS`, `ERAS`, `GENRES`), plusieurs catégories par titre
- [x] Époques calculées à partir de l'année (`eraOf`), donc à jour après une correction manuelle
- [x] Genres saisis dans la liste source (`"Titre - Artiste | genre, genre"`), relus à chaque `catalog:build` sans relancer la recherche
- [x] API serveur : `GET /api/categories` renvoie les catégories avec leur axe et le nombre de titres de chacune
- [x] Sélection par l'hôte (`host:setCategories`), validée côté serveur ; aucune catégorie = tout le catalogue
- [x] Règle : le moteur refuse de démarrer sans assez de titres dans la sélection
- [x] Message clair quand la sélection est trop petite (« Pas assez de titres pour cette sélection »), nombre de titres du paquet affiché sur l'écran hôte et le téléphone du chef
- [x] Sélecteur en trois groupes de pastilles (origine, époque, genre), catégories vides grisées, bouton « Tout effacer »
- [x] Remplir chaque genre (de 50 pour le jazz à 612 pour la pop) et chaque époque (de 112 pour les années 2020 à 243 pour les années 80)
- [ ] Idée : afficher sur chaque pastille le nombre de titres compte tenu des autres axes cochés (aujourd'hui, c'est le total du catalogue ; le total exact de la sélection est sous le bouton de lancement)
