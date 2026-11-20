import { randomUUID } from "node:crypto";
import type { Catalog } from "../catalog/store.js";
import type { CampaignLevel } from "../game/campaign.js";
import { Game } from "../game/game.js";
import { GameError } from "../game/types.js";
import type { ClientMessage, ServerMessage } from "../net/protocol.js";
import { buildView } from "../net/view.js";

/** Un canal vers un client (WebSocket en production, faux canal dans les tests). */
export interface Connection {
  send(message: ServerMessage): void;
  close(): void;
}

type HostMessage = Extract<ClientMessage, { type: `host:${string}` }>;
type PlayerMessage = Extract<ClientMessage, { type: `player:${string}` }>;

/** Salle solo : `level` = niveau de campagne (catégories et objectif imposés), null en partie libre. */
export interface SoloRoomOptions {
  level: CampaignLevel | null;
}

/**
 * Une salle : un écran hôte (qui ne joue pas), des joueurs et une partie. Elle applique les
 * messages, renvoie l'état à tout le monde et ne fait aucune confiance aux clients.
 *
 * Salle solo : un seul joueur, dont l'appareil joue lui-même l'extrait ; pas d'écran hôte. Il est
 * chef de partie, donc pilote la partie avec les messages de contrôle habituels.
 */
export class Room {
  readonly game: Game;
  /** Secret de l'hôte, nécessaire pour reprendre la salle après une coupure. */
  readonly hostToken = randomUUID();
  lastActivity: number;

  private categories: string[];
  readonly solo: boolean;
  readonly level: CampaignLevel | null;
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
    solo?: SoloRoomOptions,
  ) {
    this.solo = !!solo;
    this.level = solo?.level ?? null;
    // Aucune catégorie choisie : tout le catalogue.
    this.categories = [...(this.level?.categories ?? [])];
    this.game = new Game({
      rng,
      tracks: catalog.select(this.categories),
      solo: solo ? { goal: this.level?.goal ?? null } : undefined,
    });
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
        if (this.level) throw new GameError("Les catégories sont fixées par le niveau.");
        const known = new Set(this.catalog.categories().map((c) => c.id as string));
        const chosen = [...new Set(message.categories)];
        if (chosen.some((id) => !known.has(id))) throw new GameError("Catégorie inconnue.");
        this.game.setTracks(this.catalog.select(chosen));
        this.categories = chosen;
        break;
      }
      case "host:setCardsToWin":
        this.game.setCardsToWin(message.cardsToWin);
        break;
      case "host:start":
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
      case "host:replay":
        // Double clic, ou partie déjà relancée depuis l'autre écran : ignoré sans erreur.
        if (this.game.phase !== "finished") return;
        this.replay();
        break;
      case "host:create":
      case "host:rejoin":
      case "host:close":
        return; // gérés par la session (la fermeture supprime la salle du gestionnaire)
    }
    this.broadcast();
  }

  handlePlayer(playerId: string, message: PlayerMessage): void {
    switch (message.type) {
      case "player:place":
        this.game.placeCard(playerId, message.position);
        break;
      case "player:groove":
        this.game.placeGroove(playerId, message.position);
        break;
      case "player:play": {
        // L'écoute n'est consommée que si l'écran peut réellement jouer le son.
        this.game.assertCanListen(playerId);
        if (this.solo) {
          // L'appareil du joueur lance l'extrait lui-même, pendant son geste (lecture autorisée).
          this.game.listen(playerId);
          break;
        }
        if (!this.hostConn) throw new GameError("L'écran n'est pas connecté.");
        const track = this.game.listen(playerId);
        this.hostConn.send({ type: "audio:play", audioUrl: track.previewUrl });
        break;
      }
      case "player:leave": {
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

  /**
   * Après la fin, retour au salon de la même salle (même code) avec les mêmes joueurs, chef compris,
   * pour choisir de nouvelles catégories et un nouvel objectif. Une partie terminée garde ses joueurs
   * pour le classement : ceux qui sont partis depuis (plus de jeton) ne sont pas repris. Les joueurs
   * déconnectés restent, comme dans tout salon.
   */
  private replay(): void {
    this.game.reset(this.catalog.select(this.categories));
    const remaining = new Set(this.playerTokens.values());
    for (const player of [...this.game.players]) if (!remaining.has(player.id)) this.game.removePlayer(player.id);
  }

  /** Fin de la salle : chaque joueur est prévenu, toutes les connexions sont fermées. */
  close(): void {
    const players = [...this.playerConns.values()];
    const host = this.hostConn;
    this.playerConns.clear();
    this.playerTokens.clear();
    this.hostConn = undefined;
    for (const conn of players) {
      conn.send({ type: "closed" });
      conn.close();
    }
    host?.close();
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
      level: this.level?.id ?? null,
    });
    this.hostConn?.send({ type: "state", view, you: null });
    for (const [playerId, conn] of this.playerConns) conn.send({ type: "state", view, you: playerId });
  }
}
