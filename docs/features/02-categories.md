# 02 · Catégories et sélection

Statut : En cours

Les joueurs choisissent les catégories avant de lancer la partie.

- [x] Catégories de départ : `fr`, `international`
- [ ] Catégories dérivées des données : décennies (calculées à partir de l'année vérifiée)
- [ ] Autres catégories à définir avec le catalogue final (genres, langues…)
- [x] API serveur : `GET /api/categories` renvoie les catégories avec le nombre de titres de chacune
- [x] Sélection par l'hôte (`host:setCategories`), validée côté serveur, une ou plusieurs catégories
- [x] Règle : le moteur refuse de démarrer sans assez de titres dans les catégories choisies
- [ ] Message clair côté écran de sélection quand la sélection est trop petite
- [ ] Écran de sélection (une fois le client créé)
