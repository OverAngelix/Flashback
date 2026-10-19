import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { resolve } from "node:path";
import type { Catalog } from "../catalog/store.js";

export interface AppOptions {
  catalog: Catalog;
  /** Dossier server/data. Les extraits et pochettes sont servis depuis <dataDir>/media. */
  dataDir: string;
  logger?: boolean;
}

/**
 * Serveur HTTP. N'expose volontairement aucune route qui renvoie les titres, artistes ou années :
 * pendant une partie, ils ne sont révélés qu'après le placement (voir le moteur de jeu).
 */
export function buildApp({ catalog, dataDir, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/api/health", async () => ({ status: "ok", tracks: catalog.tracks.length }));

  app.get("/api/categories", async () => catalog.categories());

  // Fichiers nommés d'après l'identifiant du titre : rien n'y trahit l'année. @fastify/static gère
  // les requêtes Range, indispensables à la lecture audio sur Safari et iOS.
  app.register(fastifyStatic, {
    root: resolve(dataDir, "media"),
    prefix: "/media/",
    index: false,
    list: false,
    maxAge: "1d",
  });

  return app;
}
