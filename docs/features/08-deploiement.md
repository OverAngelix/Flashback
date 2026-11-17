# 08 — Déploiement sur le VPS

Statut : En cours

Déployer le mode local sur le VPS, de la même façon que SDPC : deux images Docker poussées par GitHub Actions dans le registre privé, K3s et Keel sur le VPS, Traefik en HTTPS. Le détail est dans [DEPLOY.md](../../DEPLOY.md).

## Sous-tâches

### Dans le dépôt

- [x] `server/Dockerfile` et `.dockerignore` : build TypeScript, dépendances de production, `catalog.json` embarqué, port 3000, utilisateur `node`
- [x] `client/docker/Dockerfile`, `Dockerfile.dockerignore` et `nginx.conf` : contexte à la racine (alias `@server`), 502 sur `/api` et `/ws`, `index.html` sans cache
- [x] `.github/workflows/deploy-server.yml` et `deploy-client.yml` : type-check, tests, build, push (le client se reconstruit aussi quand `server/src/**` change)
- [x] Modèles des manifests K3s dans `docs/deploy/`
- [x] Étapes des workflows simulées hors Docker dans une copie propre (tests, build, démarrage, `/api/health`)
- [ ] Première construction des images par GitHub Actions (Docker absent du poste de dev)

### Sur le VPS et GitHub

- [ ] Secrets du dépôt : `REGISTRY_URL`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- [ ] Domaine choisi, DNS vers le VPS
- [ ] Dossiers `flashback-client/` et `flashback-server/` dans `/home/deploy/apps-k3s/`, `kubectl apply -f .`
- [ ] `/api/health` renvoie le bon nombre de titres et une date de vérification des liens (`linksCheckedAt`)
- [ ] Si les médias avaient déjà été déployés : retirer le montage `media` du Deployment et supprimer `/home/deploy/apps-k3s/flashback-server/media/`
- [ ] Partie complète en HTTPS : écran hôte sur un PC, deux téléphones en 4G (son, WebSocket, reconnexion)

## Décisions

- **Calqué sur SDPC** : deux images, tag unique `latest`, Keel, manifests hors dépôt (modèles dans `docs/deploy/`).
- **Le client est servi par nginx**, pas par le serveur Fastify, pour garder la même forme que SDPC.
- **Aucun média sur le VPS** : extraits et pochettes sont lus chez Apple (voir [01-catalogue.md](01-catalogue.md)). Seul `catalog.json` voyage, dans l'image du serveur.
- **Une seule réplique** : les salles sont en mémoire.
