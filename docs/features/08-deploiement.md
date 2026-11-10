# 08 — Déploiement sur le VPS

Statut : En cours

Déployer le mode local sur le VPS, de la même façon que SDPC : deux images Docker poussées par GitHub Actions dans le registre privé, K3s et Keel sur le VPS, Traefik en HTTPS. Le détail est dans [DEPLOY.md](../../DEPLOY.md).

## Sous-tâches

### Dans le dépôt

- [x] `server/Dockerfile` et `.dockerignore` : build TypeScript, dépendances de production, `catalog.json` embarqué, port 3000, utilisateur `node`
- [x] `client/docker/Dockerfile`, `Dockerfile.dockerignore` et `nginx.conf` : contexte à la racine (alias `@server`), 502 sur `/api`, `/media` et `/ws`, `index.html` sans cache
- [x] `.github/workflows/deploy-server.yml` et `deploy-client.yml` : type-check, tests, build, push (le client se reconstruit aussi quand `server/src/**` change)
- [x] Modèles des manifests K3s dans `docs/deploy/`
- [x] Étapes des workflows simulées hors Docker dans une copie propre (tests, build, démarrage, `/api/health`)
- [ ] Première construction des images par GitHub Actions (Docker absent du poste de dev)

### Sur le VPS et GitHub

- [ ] Secrets du dépôt : `REGISTRY_URL`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`
- [ ] Domaine choisi, DNS vers le VPS
- [ ] Dossiers `flashback-client/` et `flashback-server/` dans `/home/deploy/apps-k3s/`, `kubectl apply -f .`
- [ ] Médias envoyés par rsync, `/api/health` renvoie le bon nombre de titres
- [ ] Partie complète en HTTPS : écran hôte sur un PC, deux téléphones en 4G (son, WebSocket, reconnexion)

## Décisions

- **Calqué sur SDPC** : deux images, tag unique `latest`, Keel, manifests hors dépôt (modèles dans `docs/deploy/`).
- **Le client est servi par nginx**, pas par le serveur Fastify, pour garder la même forme que SDPC.
- **Les médias ne sont pas dans l'image** : ils sont copiés sur le VPS et montés en lecture seule. L'image ne change pas quand on ajoute des extraits, et le registre ne stocke pas 100 Mo de plus à chaque push.
- **Une seule réplique** : les salles sont en mémoire.
