import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameView, ServerMessage } from "@server/net/protocol";
import { createConnection, type SocketLike } from "./connection";

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }
  // Côté serveur
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const view = { code: "ABC234", phase: "lobby" } as GameView;
const last = () => FakeSocket.all.at(-1)!;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

let storage: ReturnType<typeof memoryStorage>;
const make = () => createConnection({ url: () => "ws://test/ws", createSocket: (u) => new FakeSocket(u), storage });

beforeEach(() => {
  FakeSocket.all = [];
  storage = memoryStorage();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("connexion", () => {
  it("met les messages en file d'attente jusqu'à l'ouverture", () => {
    const c = make();
    c.createRoom();
    expect(c.state.status).toBe("connecting");
    expect(last().sent).toEqual([]);
    last().open();
    expect(last().sent).toEqual([{ type: "host:create" }]);
    expect(c.state.status).toBe("open");
  });

  it("mémorise la session et l'état reçus", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    expect(last().sent).toEqual([{ type: "player:join", code: "ABC234", name: "Ana", avatar: 3 }]);
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().receive({ type: "state", view, you: "p1" });
    expect(c.state.session).toMatchObject({ role: "player", code: "ABC234", playerId: "p1" });
    expect(c.state.view).toEqual(view);
    expect(c.state.you).toBe("p1");
    expect(JSON.parse(storage.getItem("flashback.session")!)).toEqual({ role: "player", code: "ABC234", token: "t1" });
  });

  it("se reconnecte après une coupure et reprend sa place avant tout autre message", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().drop();
    expect(c.state.status).toBe("reconnecting");

    c.send({ type: "player:place", position: 1 }); // envoyé pendant la coupure
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(2);
    last().open();
    expect(last().sent).toEqual([
      { type: "player:rejoin", code: "ABC234", token: "t1" },
      { type: "player:place", position: 1 },
    ]);
  });

  it("espace les tentatives de reconnexion, avec un plafond", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().drop();
    const delays = [1000, 2000, 4000, 8000, 8000];
    for (const [i, d] of delays.entries()) {
      vi.advanceTimersByTime(d - 1);
      expect(FakeSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.all).toHaveLength(i + 2);
      last().drop(); // l'ouverture échoue à chaque fois
    }
  });

  it("reprend immédiatement au réveil de l'appareil", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().drop();
    c.wake();
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("reprend la session mémorisée après un rechargement de la page", () => {
    storage.setItem("flashback.session", JSON.stringify({ role: "host", code: "ABC234", token: "h1" }));
    const c = make();
    expect(c.resume()).toBe(true);
    last().open();
    expect(last().sent).toEqual([{ type: "host:rejoin", code: "ABC234", token: "h1" }]);
    expect(make().resume()).toBe(true);
    storage.removeItem("flashback.session");
    expect(make().resume()).toBe(false);
  });

  it("ignore une session mémorisée illisible", () => {
    storage.setItem("flashback.session", "{pas du json");
    expect(make().resume()).toBe(false);
    storage.setItem("flashback.session", JSON.stringify({ role: "admin", code: "A", token: "b" }));
    expect(make().resume()).toBe(false);
  });

  it("abandonne la session quand la salle n'existe plus", () => {
    storage.setItem("flashback.session", JSON.stringify({ role: "player", code: "ABC234", token: "t1" }));
    const c = make();
    c.resume();
    last().open();
    last().receive({ type: "error", code: "room-not-found", message: "Salle introuvable." });
    expect(c.state.session).toBeNull();
    expect(c.state.sessionLost).toBe(true);
    expect(c.state.error).toBeNull();
    expect(storage.getItem("flashback.session")).toBeNull();
    expect(last().closed).toBe(true);
    vi.advanceTimersByTime(20000);
    expect(FakeSocket.all).toHaveLength(1); // plus de reconnexion
  });

  it("affiche les erreurs du serveur, puis les efface à l'état suivant", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "error", code: "rule", message: "Ce nom est déjà pris." });
    expect(c.state.error).toEqual({ code: "rule", message: "Ce nom est déjà pris." });
    last().receive({ type: "state", view, you: null });
    expect(c.state.error).toBeNull();
  });

  it("n'efface pas la session pour une erreur room-not-found hors reprise", () => {
    const c = make();
    c.join("ZZZZZZ", "Ana", 3);
    last().open();
    last().receive({ type: "error", code: "room-not-found", message: "Salle introuvable." });
    expect(c.state.sessionLost).toBe(false);
    expect(c.state.error?.code).toBe("room-not-found");
  });

  it("quitte volontairement sans se reconnecter, et gère l'exclusion", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().receive({ type: "kicked" });
    expect(c.state.kicked).toBe(true);
    expect(c.state.session).toBeNull();
    expect(storage.getItem("flashback.session")).toBeNull();
    vi.advanceTimersByTime(20000);
    expect(FakeSocket.all).toHaveLength(1);

    const d = make();
    d.createRoom();
    last().open();
    last().receive({ type: "session", role: "host", code: "ABC234", token: "h1" });
    d.leave();
    expect(d.state.session).toBeNull();
    expect(d.state.status).toBe("idle");
  });

  it("prévient le serveur en quittant : player:leave pour un joueur, host:close pour l'hôte", () => {
    const p = make();
    p.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    const playerSocket = last();
    p.leave();
    expect(playerSocket.sent.at(-1)).toEqual({ type: "player:leave" });
    expect(playerSocket.closed).toBe(true);

    const h = make();
    h.createRoom();
    last().open();
    last().receive({ type: "session", role: "host", code: "ABC234", token: "h1" });
    const hostSocket = last();
    h.leave();
    expect(hostSocket.sent.at(-1)).toEqual({ type: "host:close" });
  });

  it("n'envoie rien en quittant si la connexion n'est pas ouverte", () => {
    storage.setItem("flashback.session", JSON.stringify({ role: "player", code: "ABC234", token: "t1" }));
    const c = make();
    c.resume();
    c.leave();
    expect(last().sent).toEqual([]);
    expect(c.state.session).toBeNull();
  });

  it("revient à l'accueil quand l'hôte met fin à la partie", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    last().open();
    last().receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    last().receive({ type: "closed" });
    expect(c.state.closed).toBe(true);
    expect(c.state.session).toBeNull();
    expect(storage.getItem("flashback.session")).toBeNull();
    vi.advanceTimersByTime(20000);
    expect(FakeSocket.all).toHaveLength(1);
    c.join("XYZ234", "Ana", 3);
    expect(c.state.closed).toBe(false);
  });

  it("transmet l'ordre de jouer un extrait aux abonnés", () => {
    const c = make();
    const heard: string[] = [];
    const off = c.onAudioPlay((u) => heard.push(u));
    c.createRoom();
    last().open();
    last().receive({ type: "audio:play", audioUrl: "/media/audio/1.m4a" });
    off();
    last().receive({ type: "audio:play", audioUrl: "/media/audio/2.m4a" });
    expect(heard).toEqual(["/media/audio/1.m4a"]);
  });

  it("ignore les messages d'une ancienne socket", () => {
    const c = make();
    c.join("ABC234", "Ana", 3);
    const old = last();
    old.open();
    old.receive({ type: "session", role: "player", code: "ABC234", token: "t1", playerId: "p1" });
    old.drop();
    vi.advanceTimersByTime(1000);
    last().open();
    old.receive({ type: "state", view: { ...view, code: "VIEUX00" } as GameView, you: "p1" });
    expect(c.state.view).toBeNull();
  });
});
