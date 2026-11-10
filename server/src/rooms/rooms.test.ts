import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Catalog, type CatalogEntry } from "../catalog/store.js";
import { parseClientMessage, type ClientMessage, type GameView, type ServerMessage } from "../net/protocol.js";
import { RoomManager, type Session } from "./manager.js";
import type { Connection } from "./room.js";

class FakeConn implements Connection {
  sent: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage) {
    this.sent.push(message);
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }> {
    const found = [...this.sent].reverse().find((m) => m.type === type);
    assert.ok(found, `aucun message ${type}`);
    return found as Extract<ServerMessage, { type: T }>;
  }
  view(): GameView {
    return this.last("state").view;
  }
}

const entry = (id: number, category: "fr" | "international", year: number): CatalogEntry => ({
  id,
  title: `TITRE-SECRET-${id}`,
  artist: `ARTISTE-SECRET-${id}`,
  year,
  audioFile: `audio/${id}.m4a`,
  imageFile: `images/${id}.jpg`,
  category,
});

const catalog = new Catalog([
  ...Array.from({ length: 12 }, (_, i) => entry(i + 1, "fr", 1950 + i * 5)),
  ...Array.from({ length: 6 }, (_, i) => entry(100 + i, "international", 1960 + i * 7)),
]);

let clock = 0;
let manager: RoomManager;
beforeEach(() => {
  clock = 0;
  manager = new RoomManager({ catalog, now: () => clock, rng: () => 0.999999, ttlMs: 1000, maxRooms: 3, onError: (e) => { throw e; } });
});

function client(): { conn: FakeConn; session: Session; send: (m: ClientMessage | string) => void } {
  const conn = new FakeConn();
  const session = manager.connect(conn);
  return { conn, session, send: (m) => session.handle(typeof m === "string" ? m : JSON.stringify(m)) };
}

/** Un hôte et deux joueurs (Ana, Ben) dans une même salle, partie non démarrée. */
function lobby() {
  const host = client();
  host.send({ type: "host:create" });
  const code = host.conn.last("session").code;
  const ana = client();
  ana.send({ type: "player:join", code, name: "Ana", avatar: 0 });
  const ben = client();
  ben.send({ type: "player:join", code, name: "Ben", avatar: 1 });
  return { host, ana, ben, code };
}

function started(categories: string[] = ["fr"]) {
  const l = lobby();
  l.host.send({ type: "host:setCategories", categories });
  l.host.send({ type: "host:start" });
  return l;
}

describe("création et entrée dans une salle", () => {
  it("donne à l'hôte un code de 6 caractères sans caractères ambigus", () => {
    const host = client();
    host.send({ type: "host:create" });
    const s = host.conn.last("session");
    assert.match(s.code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(s.role, "host");
    assert.equal(host.conn.last("state").you, null);
    assert.equal(host.conn.view().phase, "lobby");
  });

  it("fait entrer les joueurs et diffuse l'état à tous", () => {
    const { host, ana, ben } = lobby();
    assert.deepEqual(host.conn.view().players.map((p) => p.name), ["Ana", "Ben"]);
    assert.equal(ana.conn.last("state").you, ana.conn.last("session").playerId);
    assert.equal(ben.conn.view().players.length, 2);
    assert.equal(ana.conn.last("session").role, "player");
  });

  it("accepte un code en minuscules", () => {
    const host = client();
    host.send({ type: "host:create" });
    const p = client();
    p.send({ type: "player:join", code: ` ${host.conn.last("session").code.toLowerCase()} `, name: "Ana", avatar: 0 });
    assert.equal(p.conn.last("session").role, "player");
  });

  it("refuse un code inconnu, un nom ou un avatar déjà pris", () => {
    const { code } = lobby();
    const p = client();
    p.send({ type: "player:join", code: "ZZZZZZ", name: "Cléo", avatar: 2 });
    assert.equal(p.conn.last("error").code, "room-not-found");
    p.send({ type: "player:join", code, name: "ana", avatar: 2 });
    assert.match(p.conn.last("error").message, /nom est déjà pris/);
    p.send({ type: "player:join", code, name: "Cléo", avatar: 0 });
    assert.match(p.conn.last("error").message, /avatar est déjà pris/);
    p.send({ type: "player:join", code, name: "Cléo", avatar: 2 });
    assert.equal(p.conn.last("session").role, "player");
  });

  it("refuse l'entrée après le départ de la partie", () => {
    const { code } = started();
    const p = client();
    p.send({ type: "player:join", code, name: "Cléo", avatar: 2 });
    assert.match(p.conn.last("error").message, /déjà commencé/);
  });

  it("limite le nombre de salles", () => {
    for (let i = 0; i < 3; i++) client().send({ type: "host:create" });
    const h = client();
    h.send({ type: "host:create" });
    assert.match(h.conn.last("error").message, /serveur est plein/);
  });

  it("renseigne le formulaire d'entrée sans révéler les noms", () => {
    const { code } = lobby();
    assert.deepEqual(manager.info(code), { phase: "lobby", playerCount: 2, takenAvatars: [0, 1], joinable: true });
    assert.equal(manager.info("ZZZZZZ"), undefined);
  });
});

describe("partie complète", () => {
  it("déroule un tour : écoute, placement, révélation, passage au suivant", () => {
    const { host, ana, ben } = started();
    const view = host.conn.view();
    assert.equal(view.phase, "awaiting-placement");
    assert.equal(view.activePlayerId, ana.conn.last("session").playerId);
    assert.equal(view.players.every((p) => p.timeline.length === 1), true);

    ana.send({ type: "player:play" });
    assert.equal(host.conn.last("audio:play").audioUrl, view.current!.audioUrl);
    assert.equal(ben.conn.sent.some((m) => m.type === "audio:play"), false);

    ana.send({ type: "player:place", position: 0 });
    const revealed = host.conn.view();
    assert.equal(revealed.phase, "reveal");
    assert.ok(revealed.lastResult);
    assert.equal(revealed.current, null);

    host.send({ type: "host:advance", from: "reveal" });
    assert.equal(host.conn.view().activePlayerId, ben.conn.last("session").playerId);
    assert.equal(host.conn.view().lastResult, null);
  });

  it("n'autorise qu'une écoute par tour et l'indique dans l'état", () => {
    const { host, ana, ben } = started();
    assert.equal(host.conn.view().listened, false);
    ana.send({ type: "player:play" });
    assert.equal(host.conn.view().listened, true);
    assert.equal(ana.conn.view().listened, true);
    ana.send({ type: "player:play" });
    assert.match(ana.conn.last("error").message, /déjà écouté/);
    assert.equal(host.conn.sent.filter((m) => m.type === "audio:play").length, 1);

    ana.send({ type: "player:place", position: 0 });
    host.send({ type: "host:advance", from: "reveal" });
    assert.equal(host.conn.view().listened, false); // nouveau tour, nouvelle écoute
    ben.send({ type: "player:play" });
    assert.equal(host.conn.sent.filter((m) => m.type === "audio:play").length, 2);
  });

  it("ne consomme pas l'écoute quand l'écran est absent", () => {
    const { host, ana, code } = started();
    const { token } = host.conn.last("session");
    host.session.disconnect();
    ana.send({ type: "player:play" });
    assert.match(ana.conn.last("error").message, /écran n'est pas connecté/);
    const back = client();
    back.send({ type: "host:rejoin", code, token });
    assert.equal(back.conn.view().listened, false);
    ana.send({ type: "player:play" });
    assert.equal(back.conn.last("audio:play").type, "audio:play");
    assert.equal(back.conn.view().listened, true);
  });

  it("ne révèle jamais le titre courant avant le placement, à aucun client", () => {
    const { host, ana, ben, code } = started();
    const secret = manager.get(code)!.game.current!;
    for (const c of [host.conn, ana.conn, ben.conn]) {
      const json = JSON.stringify(c.sent.filter((m) => m.type === "state").at(-1));
      assert.equal(json.includes(secret.title), false);
      assert.equal(json.includes(secret.artist), false);
      assert.equal(json.includes(secret.imageFile), false);
      assert.deepEqual(Object.keys(c.view().current!), ["audioUrl"]);
    }
  });

  it("récapitule après un tour de plateau complet et termine la partie", () => {
    const { host, ana, ben } = started();
    ana.send({ type: "player:place", position: 0 });
    host.send({ type: "host:advance", from: "reveal" });
    ben.send({ type: "player:place", position: 0 });
    host.send({ type: "host:advance", from: "reveal" });
    assert.equal(host.conn.view().phase, "round-recap");
    assert.equal(host.conn.view().round, 2);
    host.send({ type: "host:advance", from: "round-recap" });
    assert.equal(host.conn.view().phase, "awaiting-placement");
  });

  it("ignore un avancement en double ou obsolète (double clic sur Continuer)", () => {
    const { host, ana } = started();
    ana.send({ type: "player:place", position: 0 });
    host.send({ type: "host:advance", from: "reveal" });
    host.send({ type: "host:advance", from: "reveal" }); // double clic : sans effet, sans erreur
    assert.equal(host.conn.view().phase, "awaiting-placement");
    assert.equal(host.conn.sent.some((m) => m.type === "error"), false);
    host.send({ type: "host:advance", from: "round-recap" }); // phase déjà passée : ignoré aussi
    assert.equal(host.conn.view().activePlayerId, host.conn.view().players[1]!.id);
  });

  it("n'accepte la sélection de catégories qu'avant le départ, et exige un choix valide", () => {
    const { host } = lobby();
    host.send({ type: "host:setCategories", categories: ["rock"] });
    assert.match(host.conn.last("error").message, /Catégorie inconnue/);
    host.send({ type: "host:start" });
    assert.match(host.conn.last("error").message, /au moins une catégorie/);
    host.send({ type: "host:setCategories", categories: ["fr", "fr", "international"] });
    assert.deepEqual(host.conn.view().categories, ["fr", "international"]);
    assert.equal(host.conn.view().trackCount, 18);
    host.send({ type: "host:start" });
    host.send({ type: "host:setCategories", categories: ["fr"] });
    assert.match(host.conn.last("error").message, /déjà commencé/);
  });

  it("refuse de démarrer avec trop peu de titres, sans bloquer la salle", () => {
    // 2 titres français pour 2 joueurs : il en faut au moins 3 (une carte de départ chacun + 1 à placer).
    manager = new RoomManager({ catalog: new Catalog([entry(1, "fr", 1950), entry(2, "fr", 1960), entry(3, "international", 1970), entry(4, "international", 1980)]) });
    const { host } = lobby();
    host.send({ type: "host:setCategories", categories: ["fr"] });
    host.send({ type: "host:start" });
    assert.match(host.conn.last("error").message, /Pas assez de titres/);
    assert.equal(host.conn.view().phase, "lobby");
    host.send({ type: "host:setCategories", categories: ["fr", "international"] });
    host.send({ type: "host:start" });
    assert.equal(host.conn.view().phase, "awaiting-placement");
  });
});

describe("droits", () => {
  it("refuse de jouer hors de son tour", () => {
    const { ben } = started();
    ben.send({ type: "player:place", position: 0 });
    assert.match(ben.conn.last("error").message, /pas votre tour/);
    ben.send({ type: "player:play" });
    assert.match(ben.conn.last("error").message, /pas votre tour/);
  });

  it("sépare les messages de l'hôte et des joueurs", () => {
    const { host, ben } = started(); // Ana est le chef de partie, pas Ben
    ben.send({ type: "host:advance", from: "reveal" });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    ben.send({ type: "host:skipTurn" });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    ben.send({ type: "host:start" });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    host.send({ type: "player:place", position: 0 });
    assert.equal(host.conn.last("error").code, "not-allowed");
  });

  it("interdit à un joueur, même chef, de créer ou reprendre une salle", () => {
    const { ana, code } = lobby();
    ana.send({ type: "host:create" });
    assert.equal(ana.conn.last("error").code, "not-allowed");
    ana.send({ type: "host:rejoin", code, token: "x" });
    assert.equal(ana.conn.last("error").code, "not-allowed");
  });

  it("refuse tout avant d'avoir rejoint une salle, et un second rôle", () => {
    const c = client();
    c.send({ type: "host:start" });
    assert.equal(c.conn.last("error").code, "not-allowed");
    c.send({ type: "host:create" });
    c.send({ type: "host:create" });
    assert.equal(c.conn.last("error").code, "not-allowed");
  });

  it("rejette les messages illisibles ou mal formés", () => {
    const c = client();
    for (const raw of ["pas du json", "[]", "null", '{"type":"inconnu"}', '{"type":"player:place","position":"2"}', '{"type":"player:join","code":"A","name":"x"}']) {
      c.send(raw);
      assert.equal(c.conn.last("error").code, "bad-message", raw);
    }
  });
});

describe("déconnexions", () => {
  it("marque le joueur absent, puis le rétablit avec son jeton", () => {
    const { host, ana, code } = started();
    const { token, playerId } = ana.conn.last("session");
    ana.session.disconnect();
    assert.equal(host.conn.view().players.find((p) => p.id === playerId)!.connected, false);

    const back = client();
    back.send({ type: "player:rejoin", code, token });
    assert.equal(back.conn.last("session").playerId, playerId);
    assert.equal(host.conn.view().players.find((p) => p.id === playerId)!.connected, true);
    back.send({ type: "player:place", position: 0 });
    assert.equal(host.conn.view().phase, "reveal");
  });

  it("refuse un jeton invalide", () => {
    const { code } = started();
    const c = client();
    c.send({ type: "player:rejoin", code, token: "faux" });
    assert.equal(c.conn.last("error").code, "room-not-found");
    c.send({ type: "host:rejoin", code, token: "faux" });
    assert.equal(c.conn.last("error").code, "room-not-found");
  });

  it("remplace l'ancienne connexion quand le joueur revient", () => {
    const { ana, code } = started();
    const { token } = ana.conn.last("session");
    const second = client();
    second.send({ type: "player:rejoin", code, token });
    assert.equal(ana.conn.closed, true);
    ana.session.disconnect(); // la fermeture de l'ancienne connexion ne doit pas déconnecter la nouvelle
    assert.equal(second.conn.view().players[0]!.connected, true);
  });

  it("permet à l'hôte de reprendre la salle avec son jeton", () => {
    const { host, code } = started();
    const { token } = host.conn.last("session");
    host.session.disconnect();
    const again = client();
    again.send({ type: "host:rejoin", code, token });
    assert.equal(again.conn.last("session").role, "host");
    assert.equal(again.conn.view().phase, "awaiting-placement");
    again.send({ type: "host:skipTurn" });
    assert.equal(again.conn.view().phase, "reveal");
    assert.equal(again.conn.view().lastResult!.position, -1);
  });

  it("signale à un joueur que l'écran n'est pas connecté", () => {
    const { host, ana } = started();
    host.session.disconnect();
    ana.send({ type: "player:play" });
    assert.match(ana.conn.last("error").message, /écran n'est pas connecté/);
  });
});

describe("salon", () => {
  it("exclut un joueur avant le départ, pas après", () => {
    const { host, ben } = lobby();
    const benId = ben.conn.last("session").playerId!;
    host.send({ type: "host:kick", playerId: benId });
    assert.equal(ben.conn.sent.at(-1)?.type, "kicked");
    assert.equal(ben.conn.closed, true);
    assert.deepEqual(host.conn.view().players.map((p) => p.name), ["Ana"]);
    host.send({ type: "host:kick", playerId: "p99" });
    assert.match(host.conn.last("error").message, /Joueur inconnu/);
  });

  it("libère le nom et l'avatar quand un joueur quitte", () => {
    const { host, ben, code } = lobby();
    ben.send({ type: "player:leave" });
    assert.equal(host.conn.view().players.length, 1);
    const again = client();
    again.send({ type: "player:join", code, name: "Ben", avatar: 1 });
    assert.equal(again.conn.last("session").role, "player");
  });

  it("interdit de quitter ou d'exclure en cours de partie", () => {
    const { host, ben } = started();
    ben.send({ type: "player:leave" });
    assert.match(ben.conn.last("error").message, /en cours de partie/);
    host.send({ type: "host:kick", playerId: ben.conn.last("session").playerId! });
    assert.match(host.conn.last("error").message, /avant le départ/);
  });
});

describe("chef de partie", () => {
  const leaderOf = (c: FakeConn) => c.view().leaderId;
  const id = (c: { conn: FakeConn }) => c.conn.last("session").playerId!;

  it("est le premier joueur arrivé", () => {
    const { host, ana, ben } = lobby();
    assert.equal(leaderOf(host.conn), id(ana));
    assert.equal(leaderOf(ben.conn), id(ana));
  });

  it("règle les catégories et lance la partie depuis son téléphone", () => {
    const { host, ana, ben } = lobby();
    ben.send({ type: "host:setCategories", categories: ["fr"] });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    ana.send({ type: "host:setCategories", categories: ["fr"] });
    assert.deepEqual(host.conn.view().categories, ["fr"]);
    ana.send({ type: "host:start" });
    assert.equal(host.conn.view().phase, "awaiting-placement");
  });

  it("fait avancer la partie et passe un tour", () => {
    const { host, ana, ben } = started();
    ana.send({ type: "player:place", position: 0 });
    ana.send({ type: "host:advance", from: "reveal" });
    assert.equal(host.conn.view().activePlayerId, id(ben));
    ana.send({ type: "host:skipTurn" }); // le chef passe le tour de Ben
    assert.equal(host.conn.view().phase, "reveal");
    assert.equal(host.conn.view().lastResult!.position, -1);
  });

  it("passe au joueur suivant quand il se déconnecte, et le reste si l'ancien revient", () => {
    const { host, ana, ben, code } = lobby();
    const { token } = ana.conn.last("session");
    ana.session.disconnect();
    assert.equal(leaderOf(host.conn), id(ben));

    const back = client();
    back.send({ type: "player:rejoin", code, token });
    assert.equal(leaderOf(host.conn), id(ben)); // Ben reste chef
    back.send({ type: "host:start" });
    assert.equal(back.conn.last("error").code, "not-allowed");
    ben.send({ type: "host:setCategories", categories: ["fr"] });
    assert.deepEqual(host.conn.view().categories, ["fr"]);
  });

  it("passe au suivant quand le chef quitte le salon", () => {
    const { host, ana, ben } = lobby();
    ana.send({ type: "player:leave" });
    assert.equal(leaderOf(host.conn), id(ben));
  });

  it("reste désigné quand personne n'est connecté, puis revient au premier présent", () => {
    const { host, ana, ben, code } = lobby();
    const anaId = id(ana);
    const benToken = ben.conn.last("session").token;
    ben.session.disconnect();
    ana.session.disconnect();
    assert.equal(leaderOf(host.conn), anaId); // chef déconnecté, personne pour le remplacer

    const back = client();
    back.send({ type: "player:rejoin", code, token: benToken });
    assert.equal(leaderOf(host.conn), id(ben)); // Ben est le premier présent
  });

  it("ne peut pas s'exclure lui-même, mais exclut un autre joueur dans le salon", () => {
    const { host, ana, ben } = lobby();
    ana.send({ type: "host:kick", playerId: id(ana) });
    assert.match(ana.conn.last("error").message, /vous exclure vous-même/);
    ana.send({ type: "host:kick", playerId: id(ben) });
    assert.equal(ben.conn.closed, true);
    assert.deepEqual(host.conn.view().players.map((p) => p.name), ["Ana"]);
  });

  it("n'enlève rien à l'écran hôte, qui garde ses commandes", () => {
    const { host } = lobby();
    host.send({ type: "host:setCategories", categories: ["international"] });
    assert.deepEqual(host.conn.view().categories, ["international"]);
  });
});

describe("nettoyage des salles", () => {
  it("supprime les salles sans connexion après le délai, jamais celles qui sont occupées", () => {
    const { host, ana, ben, code } = lobby();
    clock = 5000;
    assert.equal(manager.sweep(), 0); // tout le monde est connecté
    for (const c of [host, ana, ben]) c.session.disconnect();
    clock = 5500;
    assert.equal(manager.sweep(), 0); // déconnectés depuis moins de 1 s
    clock = 6600;
    assert.equal(manager.sweep(), 1);
    assert.equal(manager.get(code), undefined);
    assert.equal(manager.size, 0);
  });
});

describe("parseClientMessage", () => {
  it("accepte les messages bien formés", () => {
    assert.deepEqual(parseClientMessage('{"type":"host:create"}'), { type: "host:create" });
    assert.deepEqual(parseClientMessage('{"type":"host:advance","from":"reveal"}'), { type: "host:advance", from: "reveal" });
    assert.deepEqual(parseClientMessage('{"type":"player:place","position":2,"extra":1}'), { type: "player:place", position: 2 });
    assert.deepEqual(parseClientMessage('{"type":"host:setCategories","categories":["fr"]}'), { type: "host:setCategories", categories: ["fr"] });
  });
  it("refuse les types et formes invalides", () => {
    assert.equal(parseClientMessage('{"type":"player:place","position":1.5}'), null);
    assert.equal(parseClientMessage('{"type":"host:advance"}'), null);
    assert.equal(parseClientMessage('{"type":"host:advance","from":"nimporte"}'), null);
    assert.equal(parseClientMessage('{"type":"host:setCategories","categories":[1]}'), null);
    assert.equal(parseClientMessage('{"type":"player:join","code":"A","name":"x".repeat(100),"avatar":0}'), null);
    assert.equal(parseClientMessage(`{"type":"player:join","code":"ABCDEF","name":"${"x".repeat(65)}","avatar":0}`), null);
  });
});
