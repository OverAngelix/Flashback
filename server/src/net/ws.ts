import type { FastifyInstance } from "fastify";
import { WebSocketServer, type WebSocket } from "ws";
import type { RoomManager } from "../rooms/manager.js";

export const WS_PATH = "/ws";
/** Un message légitime tient en quelques dizaines d'octets. */
const MAX_PAYLOAD_BYTES = 4096;
const HEARTBEAT_MS = 20_000;

/**
 * Branche le WebSocket sur le serveur HTTP (même port). Un ping toutes les 20 s coupe les
 * connexions fantômes, par exemple un téléphone mis en veille sans fermeture propre : le joueur
 * apparaît alors comme déconnecté et peut revenir avec son jeton.
 */
export function attachWebSocket(app: FastifyInstance, manager: RoomManager, heartbeatMs = HEARTBEAT_MS): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  const alive = new WeakSet<WebSocket>();

  app.server.on("upgrade", (req, socket, head) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== WS_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws) => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));

    const session = manager.connect({
      send: (message) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
      },
      close: () => ws.close(),
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) return ws.close(1003, "Texte uniquement");
      session.handle(data.toString());
    });
    ws.on("close", () => session.disconnect());
    ws.on("error", () => ws.terminate());
  });

  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, heartbeatMs);
  timer.unref();

  app.addHook("onClose", async () => {
    clearInterval(timer);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
}
