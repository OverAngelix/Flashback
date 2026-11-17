import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import type { LinkWatchState } from "../catalog/links.js";
import type { Catalog } from "../catalog/store.js";
import { attachWebSocket } from "../net/ws.js";
import type { RoomManager } from "../rooms/manager.js";

export interface AppOptions {
  catalog: Catalog;
  rooms: RoomManager;
  /** État de la vérification quotidienne des liens Apple, affiché par /api/health. */
  links?: LinkWatchState;
  logger?: boolean;
  /** Dossier du client compilé (client/dist). S'il existe, il est servi sur / avec repli vers index.html. */
  clientDir?: string;
  /** Intervalle du ping WebSocket (20 s par défaut) ; réduit dans les tests. */
  heartbeatMs?: number;
}

/**
 * Serveur HTTP. N'expose volontairement aucune route qui renvoie les titres, artistes ou années :
 * pendant une partie, ils ne sont révélés qu'après le placement (voir le moteur de jeu).
 */
export function buildApp({ catalog, rooms, links, clientDir, logger = false, heartbeatMs }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/api/health", async () => ({
    status: "ok",
    tracks: catalog.available.length,
    unavailable: catalog.tracks.length - catalog.available.length,
    linksCheckedAt: links?.lastCheckAt ?? null,
  }));

  app.get("/api/categories", async () => catalog.categories());

  // Pour le formulaire d'entrée d'un joueur : la salle existe-t-elle, quels avatars sont pris ?
  // Aucun nom de joueur n'est divulgué.
  app.get<{ Params: { code: string } }>("/api/rooms/:code", async (request, reply) => {
    const info = rooms.info(request.params.code);
    if (!info) return reply.code(404).send({ error: "Salle introuvable." });
    return info;
  });

  // Adresses à taper sur un téléphone pour joindre cet écran : l'hôte ouvre souvent localhost,
  // inutilisable depuis un autre appareil.
  app.get("/api/network", async (request) => {
    const port = request.socket.localPort ?? request.headers.host?.split(":")[1] ?? 80;
    const urls = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i && i.family === "IPv4" && !i.internal)
      .map((i) => `http://${i!.address}:${port}`);
    return { urls };
  });

  attachWebSocket(app, rooms, heartbeatMs);

  if (clientDir && existsSync(resolve(clientDir, "index.html"))) {
    app.register(fastifyStatic, { root: clientDir, prefix: "/", maxAge: "1h" });
    // Routes du client (/host, /play, /join/CODE…) : on renvoie la page, le routeur fait le reste.
    app.setNotFoundHandler((request, reply) => {
      const { pathname } = new URL(request.url, "http://localhost");
      const isApi = pathname.startsWith("/api/") || pathname === "/ws";
      if (request.method === "GET" && !isApi && !/\.[a-z0-9]+$/i.test(pathname)) {
        return reply.sendFile("index.html", clientDir);
      }
      return reply.code(404).send({ error: "Introuvable." });
    });
  }

  return app;
}
