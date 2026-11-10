# Contexte de build : la racine du dépôt, car le client importe les types du protocole
# depuis ../server/src (alias @server). Exclusions dans Dockerfile.dockerignore, à côté.
FROM node:24-alpine AS builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY server/src/ /app/server/src/
COPY client/ ./
# Le type-check est fait par le workflow avant le build de l'image.
RUN npx vite build

FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
