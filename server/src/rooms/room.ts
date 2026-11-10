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
  /** Chef de partie, voir updateLeader. */
  private leaderId: string | null = null;
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

  // --- Chef de partie -------------------------------------------------------------------------

  isLeader(playerId: string): boolean {
    this.updateLeader();
    return this.leaderId === playerId;
  }

  /**
   * Le chef est le premier joueur arrivé. S'il se déconnecte ou s'en va, le premier joueur encore
   * connecté (dans l'ordre d'arrivée) le remplace et le reste, même si l'ancien chef revient :
   * cela évite de changer de chef à chaque mise en veille d'un téléphone.
   */
  private updateLeader(): void {
    const exists = (id: string) => this.game.players.some((p) => p.id === id);
    if (this.leaderId && exists(this.leaderId) && this.playerConns.has(this.leaderId)) return;
    const next = this.game.players.find((p) => this.playerConns.has(p.id));
    if (next) this.leaderId = next.id;
    else if (this.leaderId && !exists(this.leaderId)) this.leaderId = null;
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

  /** `actorId` : joueur qui envoie le message (chef de partie), absent s'il vient de l'écran hôte. */
  handleHost(message: HostMessage, actorId?: string): void {
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
        // Message obsolète (double clic, ou état déjà passé à la suite) : on l'ignore sans erreur.
        if (message.from !== this.game.phase) return;
        this.game.advance();
        break;
      case "host:skipTurn":
        this.game.skipTurn();
        break;
      case "host:kick":
        if (message.playerId === actorId) throw new GameError("Vous ne pouvez pas vous exclure vous-même.");
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
        // L'écoute n'est consommée que si l'écran peut réellement jouer le son.
        this.game.assertCanListen(playerId);
        if (!this.hostConn) throw new GameError("L'écran n'est pas connecté.");
        const track = this.game.listen(playerId);
        this.hostConn.send({ type: "audio:play", audioUrl: mediaUrl(track.audioFile) });
        break;
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
    this.updateLeader();
    const view = buildView(this.game, {
      code: this.code,
      categories: this.categories,
      availableCategories: this.catalog.categories(),
      connectedPlayerIds: new Set(this.playerConns.keys()),
      leaderId: this.leaderId,
    });
    this.hostConn?.send({ type: "state", view, you: null });
    for (const [playerId, conn] of this.playerConns) conn.send({ type: "state", view, you: playerId });
  }
}
