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

const entry = (id: number, origin: "fr" | "international", year: number): CatalogEntry => ({
  id,
  title: `TITRE-SECRET-${id}`,
  artist: `ARTISTE-SECRET-${id}`,
  year,
  previewUrl: `https://audio.test/${id}.m4a`,
  artworkUrl: `https://img.test/${id}.jpg`,
  origin,
  genres: ["pop"],
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
      assert.equal(json.includes(secret.artworkUrl), false);
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
    // Rien de choisi : tout le catalogue.
    assert.deepEqual(host.conn.view().categories, []);
    assert.equal(host.conn.view().trackCount, 18);
    host.send({ type: "host:setCategories", categories: ["opera"] });
    assert.match(host.conn.last("error").message, /Catégorie inconnue/);
    host.send({ type: "host:setCategories", categories: ["international", "era-1960"] });
    assert.equal(host.conn.view().trackCount, 2); // 1960 et 1967
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

  it("interdit d'exclure en cours de partie", () => {
    const { host, ben } = started();
    host.send({ type: "host:kick", playerId: ben.conn.last("session").playerId! });
    assert.match(host.conn.last("error").message, /avant le départ/);
  });
});

describe("groove", () => {
  it("accepte le placement d'un autre joueur après l'écoute, garde sa position secrète, puis le révèle", () => {
    const { host, ana, ben } = started();
    const benId = ben.conn.last("session").playerId!;
    ben.send({ type: "player:groove", position: 0 });
    assert.match(ben.conn.last("error").message, /extrait soit lancé/);

    ana.send({ type: "player:play" });
    ana.send({ type: "player:groove", position: 0 });
    assert.match(ana.conn.last("error").message, /C'est ton tour/);
    ben.send({ type: "player:groove", position: 0 });
    const view = host.conn.view();
    assert.deepEqual(view.grooveGuessIds, [benId]);
    assert.equal(JSON.stringify(view).includes('"position"'), false);

    ana.send({ type: "player:place", position: 0 });
    const revealed = host.conn.view();
    assert.deepEqual(revealed.grooveGuessIds, []);
    const [guess] = revealed.lastResult!.groove;
    assert.equal(revealed.lastResult!.groove.length, 1);
    assert.deepEqual({ playerId: guess!.playerId, position: guess!.position }, { playerId: benId, position: 0 });
    assert.equal(revealed.players.find((p) => p.id === benId)!.groove, guess!.correct ? 1 : 0);

    ben.send({ type: "player:groove", position: 0 });
    assert.match(ben.conn.last("error").message, /Trop tard/);
  });
});

describe("quitter une partie en cours", () => {
  it("retire le joueur, ferme sa connexion et invalide son jeton", () => {
    const l = lobby();
    const cleo = client();
    cleo.send({ type: "player:join", code: l.code, name: "Cléo", avatar: 2 });
    l.host.send({ type: "host:setCategories", categories: ["fr"] });
    l.host.send({ type: "host:start" });
    const { token } = cleo.conn.last("session");
    cleo.send({ type: "player:leave" });
    assert.equal(cleo.conn.closed, true);
    assert.deepEqual(l.host.conn.view().players.map((p) => p.name), ["Ana", "Ben"]);
    assert.equal(l.host.conn.view().phase, "awaiting-placement");
    const back = client();
    back.send({ type: "player:rejoin", code: l.code, token });
    assert.equal(back.conn.last("error").code, "room-not-found");
  });

  it("termine la partie quand il ne reste qu'un joueur", () => {
    const { host, ana, ben } = started();
    ben.send({ type: "player:leave" });
    assert.equal(host.conn.view().phase, "finished");
    assert.deepEqual(ana.conn.view().winnerIds, [ana.conn.last("session").playerId]);
  });
});

describe("fin de partie par l'hôte", () => {
  it("prévient les joueurs, ferme les connexions et supprime la salle", () => {
    const { host, ana, ben, code } = started();
    const hostToken = host.conn.last("session").token;
    host.send({ type: "host:close" });
    for (const p of [ana, ben]) {
      assert.equal(p.conn.sent.at(-1)?.type, "closed");
      assert.equal(p.conn.closed, true);
    }
    assert.equal(host.conn.closed, true);
    assert.equal(manager.get(code), undefined);
    const again = client();
    again.send({ type: "host:rejoin", code, token: hostToken });
    assert.equal(again.conn.last("error").code, "room-not-found");
  });

  it("est réservée à l'écran hôte, pas au chef de partie", () => {
    const { ana, code } = lobby();
    ana.send({ type: "host:close" });
    assert.equal(ana.conn.last("error").code, "not-allowed");
    assert.ok(manager.get(code));
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

  it("règle le nombre de cartes pour gagner, comme l'écran hôte, seulement dans le salon", () => {
    const { host, ana, ben } = lobby();
    assert.equal(host.conn.view().cardsToWin, 10);
    ben.send({ type: "host:setCardsToWin", cardsToWin: 5 });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    ana.send({ type: "host:setCardsToWin", cardsToWin: 5 });
    assert.equal(ben.conn.view().cardsToWin, 5);
    host.send({ type: "host:setCardsToWin", cardsToWin: 11 });
    assert.equal(host.conn.last("error").code, "rule");
    host.send({ type: "host:setCardsToWin", cardsToWin: 3 });
    assert.equal(host.conn.view().cardsToWin, 3);
    ana.send({ type: "host:setCategories", categories: ["fr"] });
    ana.send({ type: "host:start" });
    ana.send({ type: "host:setCardsToWin", cardsToWin: 7 });
    assert.match(ana.conn.last("error").message, /déjà commencé/);
    assert.equal(host.conn.view().cardsToWin, 3);
  });

  it("active ou coupe le commentateur, comme l'écran hôte, seulement dans le salon", () => {
    const { host, ana, ben } = lobby();
    assert.equal(host.conn.view().commentator, false, "coupé par défaut (bêta)");
    ben.send({ type: "host:setCommentator", enabled: true });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    ana.send({ type: "host:setCommentator", enabled: true });
    assert.equal(host.conn.view().commentator, true);
    host.send({ type: "host:setCommentator", enabled: false });
    assert.equal(ben.conn.view().commentator, false);
    host.send({ type: "host:setCommentator", enabled: true });
    ana.send({ type: "host:setCategories", categories: ["fr"] });
    ana.send({ type: "host:start" });
    host.send({ type: "host:setCommentator", enabled: false });
    assert.match(host.conn.last("error").message, /déjà commencé/);
    assert.equal(host.conn.view().commentator, true);
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

describe("rejouer avec les mêmes joueurs", () => {
  /** Joue jusqu'à la fin : chaque joueur place en tête de frise, l'hôte fait avancer. */
  function playToEnd(host: ReturnType<typeof client>, players: ReturnType<typeof client>[]) {
    for (let i = 0; i < 100 && host.conn.view().phase !== "finished"; i++) {
      const v = host.conn.view();
      if (v.phase === "awaiting-placement") {
        players.find((p) => p.conn.last("session").playerId === v.activePlayerId)!.send({ type: "player:place", position: 0 });
      } else host.send({ type: "host:advance", from: v.phase });
    }
    assert.equal(host.conn.view().phase, "finished");
  }

  it("ramène tout le monde au salon de la même salle, réglages gardés, frises vidées", () => {
    const { host, ana, ben, code } = lobby();
    host.send({ type: "host:setCategories", categories: ["fr"] });
    host.send({ type: "host:setCardsToWin", cardsToWin: 3 });
    host.send({ type: "host:setCommentator", enabled: true });
    host.send({ type: "host:start" });
    playToEnd(host, [ana, ben]);

    ana.send({ type: "host:replay" }); // depuis le téléphone du chef
    const view = ben.conn.view();
    assert.equal(view.phase, "lobby");
    assert.equal(view.code, code);
    assert.deepEqual(view.players.map((p) => [p.name, p.timeline.length, p.groove]), [["Ana", 0, 0], ["Ben", 0, 0]]);
    assert.deepEqual(view.categories, ["fr"]);
    assert.equal(view.cardsToWin, 3);
    assert.equal(view.commentator, true);
    assert.equal(view.trackCount, 12);
    assert.deepEqual(view.winnerIds, []);
    assert.equal(view.leaderId, ana.conn.last("session").playerId);
    assert.equal(manager.info(code)?.joinable, true, "d'autres peuvent rejoindre le nouveau salon");

    host.send({ type: "host:replay" }); // double clic : ignoré sans erreur
    assert.equal(host.conn.sent.some((m) => m.type === "error"), false);
    host.send({ type: "host:start" });
    assert.equal(host.conn.view().phase, "awaiting-placement");
  });

  it("est ignoré avant la fin, interdit aux joueurs qui ne sont pas chef", () => {
    const { host, ana, ben } = started();
    host.send({ type: "host:replay" });
    assert.equal(host.conn.view().phase, "awaiting-placement");
    assert.equal(host.conn.sent.some((m) => m.type === "error"), false);
    playToEnd(host, [ana, ben]);
    ben.send({ type: "host:replay" });
    assert.equal(ben.conn.last("error").code, "not-allowed");
    assert.equal(host.conn.view().phase, "finished");
  });

  it("ne reprend pas les joueurs partis après la fin, mais garde les déconnectés", () => {
    const l = lobby();
    const cleo = client();
    cleo.send({ type: "player:join", code: l.code, name: "Cléo", avatar: 2 });
    l.host.send({ type: "host:setCategories", categories: ["fr"] });
    l.host.send({ type: "host:setCardsToWin", cardsToWin: 3 });
    l.host.send({ type: "host:start" });
    playToEnd(l.host, [l.ana, l.ben, cleo]);
    cleo.send({ type: "player:leave" }); // retour à l'accueil depuis l'écran de fin
    assert.equal(l.host.conn.view().players.length, 3, "le classement final garde Cléo");
    l.ben.session.disconnect(); // téléphone en veille

    l.host.send({ type: "host:replay" });
    const view = l.host.conn.view();
    assert.deepEqual(view.players.map((p) => [p.name, p.connected]), [["Ana", true], ["Ben", false]]);
    assert.deepEqual(manager.info(l.code)?.takenAvatars, [0, 1], "l'avatar de Cléo est libéré");
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

describe("solo", () => {
  function solo(level: string | null) {
    const me = client();
    me.send({ type: "solo:create", name: "Ana", avatar: 3, level });
    return me;
  }

  it("crée une partie libre à un joueur, sans écran hôte, que personne ne peut rejoindre", () => {
    const me = solo(null);
    const s = me.conn.last("session");
    assert.equal(s.role, "player");
    const view = me.conn.view();
    assert.equal(view.phase, "lobby");
    assert.deepEqual(view.solo, { maxLives: 3, lives: 3, goal: null, level: null });
    assert.equal(view.leaderId, s.playerId, "le joueur seul pilote sa partie");
    assert.equal(manager.info(s.code)?.joinable, false);
    const other = client();
    other.send({ type: "player:join", code: s.code, name: "Ben", avatar: 1 });
    assert.equal(other.conn.last("error").code, "rule");
  });

  it("choisit ses catégories puis joue, l'écoute ne demandant pas d'écran hôte", () => {
    const me = solo(null);
    me.send({ type: "host:setCategories", categories: ["international"] });
    assert.equal(me.conn.view().trackCount, 6);
    me.send({ type: "host:start" });
    assert.equal(me.conn.view().phase, "awaiting-placement");
    me.send({ type: "player:play" });
    const view = me.conn.view();
    assert.equal(view.listened, true);
    assert.ok(!me.conn.sent.some((m) => m.type === "audio:play"), "l'appareil joue l'extrait lui-même");
    assert.ok(!me.conn.sent.some((m) => m.type === "error"));
  });

  it("lance un niveau de campagne tout de suite, avec ses catégories et son objectif", () => {
    const me = solo("premiers-pas");
    const view = me.conn.view();
    assert.equal(view.phase, "awaiting-placement");
    assert.deepEqual(view.categories, ["fr"]);
    assert.deepEqual(view.solo, { maxLives: 3, lives: 3, goal: 5, level: "premiers-pas" });
    me.send({ type: "host:setCategories", categories: [] });
    assert.equal(me.conn.last("error").code, "rule");
  });

  it("refuse un niveau inconnu sans créer de salle", () => {
    const me = solo("inconnu");
    assert.equal(me.conn.last("error").code, "bad-message");
    assert.equal(manager.size, 0);
  });

  it("supprime la salle quand le joueur s'en va, et la garde le temps d'une reconnexion", () => {
    const me = solo("premiers-pas");
    const { code, token } = me.conn.last("session");
    me.session.disconnect();
    const back = client();
    back.send({ type: "player:rejoin", code, token });
    assert.equal(back.conn.view().solo?.level, "premiers-pas");
    back.send({ type: "player:leave" });
    assert.equal(manager.size, 0);
    assert.equal(back.conn.closed, true);
  });
});

describe("parseClientMessage", () => {
  it("accepte les messages bien formés", () => {
    assert.deepEqual(parseClientMessage('{"type":"host:create"}'), { type: "host:create" });
    assert.deepEqual(parseClientMessage('{"type":"host:replay"}'), { type: "host:replay" });
    assert.deepEqual(parseClientMessage('{"type":"host:advance","from":"reveal"}'), { type: "host:advance", from: "reveal" });
    assert.deepEqual(parseClientMessage('{"type":"player:place","position":2,"extra":1}'), { type: "player:place", position: 2 });
    assert.deepEqual(parseClientMessage('{"type":"player:groove","position":0}'), { type: "player:groove", position: 0 });
    assert.deepEqual(parseClientMessage('{"type":"host:setCategories","categories":["fr"]}'), { type: "host:setCategories", categories: ["fr"] });
    assert.deepEqual(parseClientMessage('{"type":"host:setCardsToWin","cardsToWin":5}'), { type: "host:setCardsToWin", cardsToWin: 5 });
    assert.deepEqual(parseClientMessage('{"type":"host:setCommentator","enabled":false}'), { type: "host:setCommentator", enabled: false });
    assert.deepEqual(parseClientMessage('{"type":"solo:create","name":"Ana","avatar":2,"level":null}'), { type: "solo:create", name: "Ana", avatar: 2, level: null });
    assert.deepEqual(parseClientMessage('{"type":"solo:create","name":"Ana","avatar":2,"level":"pop"}'), { type: "solo:create", name: "Ana", avatar: 2, level: "pop" });
  });
  it("refuse les types et formes invalides", () => {
    assert.equal(parseClientMessage('{"type":"player:place","position":1.5}'), null);
    assert.equal(parseClientMessage('{"type":"player:groove","position":"0"}'), null);
    assert.equal(parseClientMessage('{"type":"host:advance"}'), null);
    assert.equal(parseClientMessage('{"type":"host:advance","from":"nimporte"}'), null);
    assert.equal(parseClientMessage('{"type":"host:setCategories","categories":[1]}'), null);
    assert.equal(parseClientMessage('{"type":"host:setCardsToWin","cardsToWin":"5"}'), null);
    assert.equal(parseClientMessage('{"type":"solo:create","name":"Ana","avatar":2}'), null);
    assert.equal(parseClientMessage('{"type":"solo:create","name":"Ana","avatar":2,"level":3}'), null);
    assert.equal(parseClientMessage('{"type":"host:setCardsToWin","cardsToWin":4.5}'), null);
    assert.equal(parseClientMessage('{"type":"host:setCommentator","enabled":"non"}'), null);
    assert.equal(parseClientMessage('{"type":"player:join","code":"A","name":"x".repeat(100),"avatar":0}'), null);
    assert.equal(parseClientMessage(`{"type":"player:join","code":"ABCDEF","name":"${"x".repeat(65)}","avatar":0}`), null);
  });
});
