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
- **Trois chemins vont au serveur** : `/api`, `/media` (extraits, pochettes) et `/ws` (WebSocket). Traefik relaie le WebSocket sans réglage ; le client passe en `wss://` de lui-même en HTTPS. nginx répond 502 sur ces chemins si la route manque.
- **Pas de base de données, mais des médias** : `data/media/` (environ 100 Mo, ignoré par git) est copié à la main sur le VPS et monté en lecture seule sur `/app/data/media`. `catalog.json` est dans l'image.
- **Pas de sous-domaine d'API** : seule l'`IngressRoute` du client existe.

## Sur le VPS

Modèles dans [`docs/deploy/`](docs/deploy/), à copier en remplaçant `<REGISTRE>` et `<DOMAINE>` :

```
/home/deploy/apps-k3s/
├── flashback-client/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingressroute.yaml      ← /api, /media, /ws vers le serveur ; le reste vers nginx
└── flashback-server/
    ├── deployment.yaml
    ├── service.yaml
    └── media/                 ← audio/ et images/, copiés depuis server/data/media/
```

Le middleware `https-redirect` du namespace `dev` existe déjà (créé pour SDPC) : ne pas le recréer.

```bash
cd /home/deploy/apps-k3s/flashback-server && kubectl apply -f .
cd /home/deploy/apps-k3s/flashback-client && kubectl apply -f .
```

## Médias

Le catalogue est lu **au démarrage** : un titre sans son audio ou sa pochette est ignoré. Après chaque envoi de médias, redémarrer le serveur.

```bash
# depuis le Mac, dans le dépôt
rsync -av --delete server/data/media/ deploy@<vps>:/home/deploy/apps-k3s/flashback-server/media/
# sur le VPS
kubectl -n dev rollout restart deployment/flashback-server
curl https://<DOMAINE>/api/health      # {"status":"ok","tracks":<nombre de titres>}
```

Ordre à respecter quand on ajoute des titres : `catalog:build` puis `catalog:download` en local, rsync des médias, puis push de `catalog.json`. Dans l'autre ordre, les nouveaux titres sont simplement ignorés jusqu'au redémarrage suivant.

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
