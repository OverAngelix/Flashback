# Déploiement sur le VPS

Même chaîne que SDPC : GitHub Actions construit deux images et les pousse dans le registre privé, Keel les voit changer et relance les pods K3s, Traefik sert le tout en HTTPS.

Domaine : **flashback.moonfeather.fr** (`<DOMAINE>` dans les modèles et les commandes ci-dessous).

```
git push main
   └─ GitHub Actions : type-check, tests, docker build, docker push (:latest)
         └─ Keel (VPS) relance le pod
               └─ K3s : Deployment → Service → IngressRoute (Traefik, Let's Encrypt)
```

## Images

| Image | Contenu | Workflow, déclenché par |
| --- | --- | --- |
| `<registre>/flashback-client:latest` | nginx + build Vite | `deploy-client.yml` : `client/**` ou `server/src/**` |
| `<registre>/flashback-server:latest` | Node, Fastify, WebSocket, `data/catalog.json` | `deploy-server.yml` : `server/**` |

Secrets du dépôt GitHub : `REGISTRY_URL`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` (les mêmes que SDPC).

Différences avec SDPC :

- **L'image client se construit depuis la racine du dépôt** (`docker build -f client/docker/Dockerfile .`) : le client importe les types du protocole depuis `server/src` (alias `@server`). Les exclusions sont dans `client/docker/Dockerfile.dockerignore`.
- **Deux chemins vont au serveur** : `/api` et `/ws` (WebSocket). Traefik relaie le WebSocket sans réglage ; le client passe en `wss://` de lui-même en HTTPS. nginx répond 502 sur ces chemins si la route manque.
- **Ni base de données, ni médias** : `catalog.json` est dans l'image. Extraits et pochettes sont lus par les navigateurs directement chez Apple ; le serveur doit pouvoir joindre `itunes.apple.com` et le CDN d'Apple pour vérifier les liens.
- **Pas de sous-domaine d'API** : seule l'`IngressRoute` du client existe.

## Sur le VPS

Modèles dans [`docs/deploy/`](docs/deploy/), à copier en remplaçant `<REGISTRE>` et `<DOMAINE>` :

```
/home/deploy/apps-k3s/
├── flashback-client/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingressroute.yaml      ← /api et /ws vers le serveur ; le reste vers nginx
└── flashback-server/
    ├── deployment.yaml
    └── service.yaml
```

Le middleware `https-redirect` du namespace `dev` existe déjà (créé pour SDPC) : ne pas le recréer.

```bash
cd /home/deploy/apps-k3s/flashback-server && kubectl apply -f .
cd /home/deploy/apps-k3s/flashback-client && kubectl apply -f .
```

## Catalogue et liens Apple

Le catalogue est lu **au démarrage**, depuis l'image : ajouter des titres, c'est `catalog:build` en local puis push de `catalog.json`.

Apple change parfois les adresses des extraits. Le serveur vérifie tous les liens au démarrage puis toutes les 24 heures : un lien mort est renouvelé via l'API `lookup` (en mémoire), un titre qu'Apple ne fournit plus est écarté jusqu'à la vérification suivante. Le journal le signale (`Liens Apple vérifiés : …`) et `/api/health` en donne l'état :

```bash
curl https://<DOMAINE>/api/health
# {"status":"ok","tracks":94,"unavailable":0,"linksCheckedAt":"2026-11-17T13:30:00.000Z"}
```

Pour enregistrer les liens renouvelés dans le dépôt : `npm run catalog:check` dans `server/`, puis push de `catalog.json`.

### Migration depuis les médias stockés

Si une version précédente a été déployée avec `data/media/` monté : appliquer le nouveau `deployment.yaml` et l'`ingressroute.yaml` (sans `/media`), puis supprimer le dossier.

```bash
cd /home/deploy/apps-k3s/flashback-server && kubectl apply -f deployment.yaml
cd /home/deploy/apps-k3s/flashback-client && kubectl apply -f ingressroute.yaml
rm -rf /home/deploy/apps-k3s/flashback-server/media
```

## Points d'attention

- **Les parties vivent en mémoire** : une seule réplique (`strategy: Recreate`), et chaque nouvelle image serveur coupe les parties en cours. Ne pas pousser sur `server/` pendant une soirée.
- **`keel.sh/match-tag: "true"`** est indispensable avec le seul tag `latest`, sinon Keel ne relance jamais le pod.
- **DNS** : le domaine doit pointer vers le VPS avant la première demande de certificat.
- **Accès public** : n'importe qui connaissant l'adresse peut créer une salle, et il n'y a pas encore de limite de débit.
- Le journal du serveur signale `client/dist absent` au démarrage : normal, c'est nginx qui sert le client.

## Contrôles

```bash
kubectl -n dev get pods | grep flashback
kubectl -n dev logs deployment/flashback-server
kubectl -n dev get svc,endpoints flashback-server flashback-client
curl -i https://<DOMAINE>/api/health
curl -I https://<DOMAINE>/host           # 200 (nginx, repli sur index.html)
curl -I http://<DOMAINE>/                # 301/308 vers https
kubectl -n dev rollout restart deployment/flashback-server   # forcer sans attendre Keel
```
