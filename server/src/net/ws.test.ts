import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { Catalog, type CatalogEntry } from "../catalog/store.js";
import { buildApp } from "../http/app.js";
import { RoomManager } from "../rooms/manager.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

const entry = (id: number, year: number): CatalogEntry => ({
  id,
  title: `Titre ${id}`,
  artist: "Artiste",
  year,
  audioFile: `audio/${id}.m4a`,
  imageFile: `images/${id}.jpg`,
  category: "fr",
});

let app: FastifyInstance;
let dir: string;
let base: string;
let wsUrl: string;
const sockets: TestSocket[] = [];

/** Socket de test : file d'attente de messages et attente d'un message précis. */
class TestSocket {
  readonly messages: ServerMessage[] = [];
  private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  closeCode?: number;

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(message);
      this.waiters = this.waiters.filter((w) => {
        if (!w.match(message)) return true;
        w.resolve(message);
        return false;
      });
    });
    ws.on("close", (code) => (this.closeCode = code));
  }

  static async open(): Promise<TestSocket> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const socket = new TestSocket(ws);
    sockets.push(socket);
    return socket;
  }

  send(message: ClientMessage) {
    this.ws.send(JSON.stringify(message));
  }

  next<T extends ServerMessage["type"]>(type: T, where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (m: ServerMessage) => m.type === type && where(m as Extract<ServerMessage, { type: T }>);
    const past = this.messages.find(match);
    if (past) return Promise.resolve(past as Extract<ServerMessage, { type: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Délai dépassé en attendant ${type}`)), 3000);
      this.waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  closed(): Promise<number> {
    if (this.closeCode !== undefined) return Promise.resolve(this.closeCode);
    return new Promise((resolve) => this.ws.once("close", resolve));
  }
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "flashback-ws-"));
  const catalog = new Catalog(Array.from({ length: 10 }, (_, i) => entry(i + 1, 1950 + i * 5)));
  app = buildApp({ catalog, rooms: new RoomManager({ catalog }), dataDir: dir, heartbeatMs: 150 });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as { port: number };
  base = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws`;
});

after(async () => {
  for (const s of sockets) s.ws.terminate();
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe("WebSocket de bout en bout", () => {
  it("fait jouer un tour entre un écran et deux téléphones", async () => {
    const host = await TestSocket.open();
    host.send({ type: "host:create" });
    const { code } = await host.next("session");
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);

    const info = await fetch(`${base}/api/rooms/${code}`);
    assert.deepEqual(await info.json(), { phase: "lobby", playerCount: 0, takenAvatars: [], joinable: true });

    const ana = await TestSocket.open();
    ana.send({ type: "player:join", code, name: "Ana", avatar: 3 });
    const anaSession = await ana.next("session");
    const ben = await TestSocket.open();
    ben.send({ type: "player:join", code, name: "Ben", avatar: 4 });
    await ben.next("session");
    await host.next("state", (m) => m.view.players.length === 2);

    host.send({ type: "host:setCategories", categories: ["fr"] });
    host.send({ type: "host:start" });
    const started = await ana.next("state", (m) => m.view.phase === "awaiting-placement");
    assert.equal(started.you, anaSession.playerId);
    assert.equal(started.view.activePlayerId, anaSession.playerId);

    ana.send({ type: "player:play" });
    const audio = await host.next("audio:play");
    assert.equal(audio.audioUrl, started.view.current!.audioUrl);

    ana.send({ type: "player:place", position: 0 });
    const revealed = await host.next("state", (m) => m.view.phase === "reveal");
    assert.ok(revealed.view.lastResult);
    assert.equal(revealed.you, null);
  });

  it("signale un joueur déconnecté et le laisse revenir avec son jeton", async () => {
    const host = await TestSocket.open();
    host.send({ type: "host:create" });
    const { code } = await host.next("session");
    const ana = await TestSocket.open();
    ana.send({ type: "player:join", code, name: "Ana", avatar: 0 });
    const { token, playerId } = await ana.next("session");

    ana.ws.close();
    await host.next("state", (m) => m.view.players.some((p) => p.id === playerId && !p.connected));

    const back = await TestSocket.open();
    back.send({ type: "player:rejoin", code, token });
    assert.equal((await back.next("session")).playerId, playerId);
    await host.next("state", (m) => m.view.players.every((p) => p.connected));
  });

  it("renvoie une erreur lisible plutôt que de couper sur un message invalide", async () => {
    const s = await TestSocket.open();
    s.ws.send("pas du json");
    assert.equal((await s.next("error")).code, "bad-message");
    s.send({ type: "player:join", code: "ZZZZZZ", name: "Ana", avatar: 0 });
    assert.equal((await s.next("error", (m) => m.code === "room-not-found")).code, "room-not-found");
  });

  it("coupe les messages trop gros et les messages binaires", async () => {
    const big = await TestSocket.open();
    big.ws.send("x".repeat(10_000));
    assert.equal(await big.closed(), 1009);

    const bin = await TestSocket.open();
    bin.ws.send(Buffer.from([1, 2, 3]));
    assert.equal(await bin.closed(), 1003);
  });

  it("refuse les mises à niveau WebSocket sur un autre chemin", async () => {
    const ws = new WebSocket(wsUrl.replace("/ws", "/autre"));
    const outcome = await new Promise<string>((resolve) => {
      ws.once("open", () => resolve("open"));
      ws.once("error", () => resolve("error"));
    });
    assert.equal(outcome, "error");
  });

  it("coupe un client qui ne répond plus aux pings (téléphone en veille) et le marque absent", async () => {
    const host = await TestSocket.open();
    host.send({ type: "host:create" });
    const { code } = await host.next("session");

    const ghost = new WebSocket(wsUrl, { autoPong: false });
    await new Promise<void>((resolve) => ghost.once("open", () => resolve()));
    ghost.send(JSON.stringify({ type: "player:join", code, name: "Fantôme", avatar: 7 }));
    await host.next("state", (m) => m.view.players.some((p) => p.name === "Fantôme" && p.connected));

    await new Promise<void>((resolve) => ghost.once("close", () => resolve()));
    await host.next("state", (m) => m.view.players.some((p) => p.name === "Fantôme" && !p.connected));
  });

  it("renvoie 404 pour une salle inconnue", async () => {
    const res = await fetch(`${base}/api/rooms/ZZZZZZ`);
    assert.equal(res.status, 404);
  });
});
