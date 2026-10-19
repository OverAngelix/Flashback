import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { resolve } from "node:path";
import type { Catalog } from "../catalog/store.js";
import { attachWebSocket } from "../net/ws.js";
import type { RoomManager } from "../rooms/manager.js";

export interface AppOptions {
  catalog: Catalog;
  rooms: RoomManager;
  /** Dossier server/data. Les extraits et pochettes sont servis depuis <dataDir>/media. */
  dataDir: string;
  logger?: boolean;
  /** Intervalle du ping WebSocket (20 s par défaut) ; réduit dans les tests. */
  heartbeatMs?: number;
}

/**
 * Serveur HTTP. N'expose volontairement aucune route qui renvoie les titres, artistes ou années :
 * pendant une partie, ils ne sont révélés qu'après le placement (voir le moteur de jeu).
 */
export function buildApp({ catalog, rooms, dataDir, logger = false, heartbeatMs }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/api/health", async () => ({ status: "ok", tracks: catalog.tracks.length }));

  app.get("/api/categories", async () => catalog.categories());

  // Pour le formulaire d'entrée d'un joueur : la salle existe-t-elle, quels avatars sont pris ?
  // Aucun nom de joueur n'est divulgué.
  app.get<{ Params: { code: string } }>("/api/rooms/:code", async (request, reply) => {
    const info = rooms.info(request.params.code);
    if (!info) return reply.code(404).send({ error: "Salle introuvable." });
    return info;
  });

  attachWebSocket(app, rooms, heartbeatMs);

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
