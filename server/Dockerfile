FROM node:24-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build

FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# Le catalogue (titres, années, corrections manuelles) vient du dépôt. Les extraits et pochettes
# (data/media/) n'y sont pas : ils sont montés depuis le VPS (voir DEPLOY.md).
COPY data/catalog.json ./data/catalog.json

USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
