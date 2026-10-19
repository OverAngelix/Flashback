import { randomUUID } from "node:crypto";
import type { Catalog } from "../catalog/store.js";
import { Game } from "../game/game.js";
import { GameError } from "../game/types.js";
import type { ClientMessage, ServerMessage } from "../net/protocol.js";
import { buildView, mediaUrl } from "../net/view.js";

/** Un canal vers un client (WebSocket en production, faux canal dans les tests). */
export interface Connection {
  send(message: ServerMessage): void;
  close(): void;
}

type HostMessage = Extract<ClientMessage, { type: `host:${string}` }>;
type PlayerMessage = Extract<ClientMessage, { type: `player:${string}` }>;

/**
 * Une salle : un écran hôte (qui ne joue pas), des joueurs et une partie. Elle applique les
 * messages, renvoie l'état à tout le monde et ne fait aucune confiance aux clients.
 */
export class Room {
  readonly game: Game;
  /** Secret de l'hôte, nécessaire pour reprendre la salle après une coupure. */
  readonly hostToken = randomUUID();
  lastActivity: number;

  private categories: string[] = [];
  private readonly playerTokens = new Map<string, string>(); // jeton -> identifiant joueur
  private hostConn?: Connection;
  private readonly playerConns = new Map<string, Connection>();

  constructor(
    readonly code: string,
    private readonly catalog: Catalog,
    private readonly clock: () => number,
    rng?: () => number,
  ) {
    this.game = new Game({ rng });
    this.lastActivity = clock();
  }

  touch(): void {
    this.lastActivity = this.clock();
  }

  /** Aucune connexion ouverte depuis plus de `ttlMs` : la salle peut être supprimée. */
  isIdle(ttlMs: number): boolean {
    return !this.hostConn && this.playerConns.size === 0 && this.clock() - this.lastActivity > ttlMs;
  }

  // --- Connexions -----------------------------------------------------------------------------

  attachHost(conn: Connection): void {
    const previous = this.hostConn;
    this.hostConn = conn;
    if (previous && previous !== conn) previous.close();
    this.touch();
  }

  detachHost(conn: Connection): void {
    if (this.hostConn === conn) this.hostConn = undefined;
    this.touch();
  }

  join(conn: Connection, name: string, avatar: number): { playerId: string; token: string } {
    const player = this.game.addPlayer(name, avatar);
    const token = randomUUID();
    this.playerTokens.set(token, player.id);
    this.attachPlayer(player.id, conn);
    return { playerId: player.id, token };
  }

  /** Reprise d'un joueur avec son jeton. Renvoie son identifiant, ou undefined si le jeton est inconnu. */
  rejoin(conn: Connection, token: string): string | undefined {
    const playerId = this.playerTokens.get(token);
    if (!playerId) return undefined;
    this.attachPlayer(playerId, conn);
    return playerId;
  }

  detachPlayer(playerId: string, conn: Connection): void {
    if (this.playerConns.get(playerId) === conn) this.playerConns.delete(playerId);
    this.touch();
  }

  private attachPlayer(playerId: string, conn: Connection): void {
    const previous = this.playerConns.get(playerId);
    this.playerConns.set(playerId, conn);
    if (previous && previous !== conn) previous.close();
    this.touch();
  }

  // --- Messages -------------------------------------------------------------------------------

  handleHost(message: HostMessage): void {
    switch (message.type) {
      case "host:setCategories": {
        const known = new Set(this.catalog.categories().map((c) => c.id as string));
        const chosen = [...new Set(message.categories)];
        if (chosen.some((id) => !known.has(id))) throw new GameError("Catégorie inconnue.");
        this.game.setTracks(this.catalog.select(chosen));
        this.categories = chosen;
        break;
      }
      case "host:start":
        if (this.categories.length === 0) throw new GameError("Choisissez au moins une catégorie.");
        this.game.start();
        break;
      case "host:advance":
        this.game.advance();
        break;
      case "host:skipTurn":
        this.game.skipTurn();
        break;
      case "host:kick":
        this.kick(message.playerId);
        break;
      case "host:create":
      case "host:rejoin":
        return; // gérés par la session, avant l'entrée dans la salle
    }
    this.broadcast();
  }

  handlePlayer(playerId: string, message: PlayerMessage): void {
    switch (message.type) {
      case "player:place":
        this.game.placeCard(playerId, message.position);
        break;
      case "player:play": {
        const { current, activePlayer, phase } = this.game;
        if (phase !== "awaiting-placement" || !current) throw new GameError("Pas d'extrait à écouter pour le moment.");
        if (activePlayer?.id !== playerId) throw new GameError("Ce n'est pas votre tour.");
        if (!this.hostConn) throw new GameError("L'écran n'est pas connecté.");
        this.hostConn.send({ type: "audio:play", audioUrl: mediaUrl(current.audioFile) });
        return; // rien ne change dans l'état de la partie
      }
      case "player:leave": {
        if (this.game.phase !== "lobby") throw new GameError("Impossible de quitter en cours de partie.");
        const conn = this.playerConns.get(playerId);
        this.removePlayer(playerId);
        conn?.close();
        break;
      }
      case "player:join":
      case "player:rejoin":
        return; // gérés par la session
    }
    this.broadcast();
  }

  private kick(playerId: string): void {
    if (this.game.phase !== "lobby") throw new GameError("On ne peut exclure un joueur qu'avant le départ.");
    if (!this.game.players.some((p) => p.id === playerId)) throw new GameError("Joueur inconnu.");
    const conn = this.playerConns.get(playerId);
    this.removePlayer(playerId);
    conn?.send({ type: "kicked" });
    conn?.close();
  }

  private removePlayer(playerId: string): void {
    this.game.removePlayer(playerId);
    this.playerConns.delete(playerId);
    for (const [token, id] of this.playerTokens) if (id === playerId) this.playerTokens.delete(token);
  }

  // --- Diffusion ------------------------------------------------------------------------------

  /** Envoie l'état courant à l'hôte et à chaque joueur connecté. */
  broadcast(): void {
    const view = buildView(this.game, {
      code: this.code,
      categories: this.categories,
      availableCategories: this.catalog.categories(),
      connectedPlayerIds: new Set(this.playerConns.keys()),
    });
    this.hostConn?.send({ type: "state", view, you: null });
    for (const [playerId, conn] of this.playerConns) conn.send({ type: "state", view, you: playerId });
  }
}
