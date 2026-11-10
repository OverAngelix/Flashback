import { randomInt, timingSafeEqual } from "node:crypto";
import type { Catalog } from "../catalog/store.js";
import { AVATAR_COUNT, GameError, MAX_PLAYERS } from "../game/types.js";
import { CONTROL_MESSAGE_TYPES, parseClientMessage, ROOM_CODE_LENGTH, type ErrorCode } from "../net/protocol.js";
import { Room, type Connection } from "./room.js";

/** Sans I, O, 0 et 1 : un code lu sur une télé ne doit pas prêter à confusion. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Erreur de protocole (et non de règle de jeu) : renvoyée au client avec son code. */
class ProtocolError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface RoomManagerOptions {
  catalog: Catalog;
  now?: () => number;
  rng?: () => number;
  /** Durée sans aucune connexion avant suppression d'une salle (30 min par défaut). */
  ttlMs?: number;
  maxRooms?: number;
  onError?: (error: unknown) => void;
}

export interface RoomInfo {
  phase: string;
  playerCount: number;
  takenAvatars: number[];
  joinable: boolean;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxRooms: number;

  constructor(private readonly options: RoomManagerOptions) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 30 * 60_000;
    this.maxRooms = options.maxRooms ?? 100;
  }

  get size(): number {
    return this.rooms.size;
  }

  createRoom(): Room {
    if (this.rooms.size >= this.maxRooms) throw new GameError("Le serveur est plein, réessayez plus tard.");
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    } while (this.rooms.has(code));
    const room = new Room(code, this.options.catalog, this.now, this.options.rng);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Ce que le formulaire d'entrée a le droit de savoir : pas de noms, juste les avatars pris. */
  info(code: string): RoomInfo | undefined {
    const room = this.get(code);
    if (!room) return undefined;
    const { phase, players } = room.game;
    return {
      phase,
      playerCount: players.length,
      takenAvatars: players.map((p) => p.avatar).sort((a, b) => a - b),
      joinable: phase === "lobby" && players.length < MAX_PLAYERS && players.length < AVATAR_COUNT,
    };
  }

  /** Supprime les salles abandonnées. À appeler régulièrement. */
  sweep(): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.isIdle(this.ttlMs)) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  connect(conn: Connection): Session {
    return new Session(this, conn, this.options.onError ?? ((e) => console.error(e)));
  }
}

/** Une connexion : d'abord anonyme, puis liée à une salle comme hôte ou comme joueur. */
export class Session {
  private binding?: { room: Room; playerId?: string };

  constructor(
    private readonly manager: RoomManager,
    private readonly conn: Connection,
    private readonly onError: (error: unknown) => void,
  ) {}

  handle(raw: string): void {
    const message = parseClientMessage(raw);
    if (!message) return this.fail("bad-message", "Message invalide.");
    try {
      this.dispatch(message);
    } catch (error) {
      if (error instanceof ProtocolError) this.fail(error.code, error.message);
      else if (error instanceof GameError) this.fail("rule", error.message);
      else {
        this.onError(error);
        this.fail("internal", "Erreur interne du serveur.");
      }
    }
  }

  disconnect(): void {
    const b = this.binding;
    this.binding = undefined;
    if (!b) return;
    if (b.playerId) b.room.detachPlayer(b.playerId, this.conn);
    else b.room.detachHost(this.conn);
    b.room.broadcast();
  }

  private dispatch(message: NonNullable<ReturnType<typeof parseClientMessage>>): void {
    switch (message.type) {
      case "host:create": {
        this.requireUnbound();
        const room = this.manager.createRoom();
        this.bindHost(room);
        return;
      }
      case "host:rejoin": {
        this.requireUnbound();
        const room = this.manager.get(message.code);
        if (!room || !sameSecret(room.hostToken, message.token)) {
          throw new ProtocolError("room-not-found", "Salle introuvable ou jeton invalide.");
        }
        this.bindHost(room);
        return;
      }
      case "player:join": {
        this.requireUnbound();
        const room = this.manager.get(message.code);
        if (!room) throw new ProtocolError("room-not-found", "Salle introuvable.");
        const { playerId, token } = room.join(this.conn, message.name, message.avatar);
        this.binding = { room, playerId };
        this.conn.send({ type: "session", role: "player", code: room.code, token, playerId });
        room.broadcast();
        return;
      }
      case "player:rejoin": {
        this.requireUnbound();
        const room = this.manager.get(message.code);
        const playerId = room?.rejoin(this.conn, message.token);
        if (!room || !playerId) throw new ProtocolError("room-not-found", "Salle introuvable ou jeton invalide.");
        this.binding = { room, playerId };
        this.conn.send({ type: "session", role: "player", code: room.code, token: message.token, playerId });
        room.broadcast();
        return;
      }
      default: {
        const b = this.binding;
        if (!b) throw new ProtocolError("not-allowed", "Rejoignez d'abord une salle.");
        b.room.touch();
        if (message.type.startsWith("host:")) {
          // L'écran hôte, ou le chef de partie pour les messages de contrôle (pas host:create/rejoin).
          const control = (CONTROL_MESSAGE_TYPES as readonly string[]).includes(message.type);
          if (b.playerId && !(control && b.room.isLeader(b.playerId))) {
            throw new ProtocolError("not-allowed", "Réservé à l'écran hôte ou au chef de partie.");
          }
          b.room.handleHost(message as Parameters<Room["handleHost"]>[0], b.playerId);
        } else {
          if (!b.playerId) throw new ProtocolError("not-allowed", "Réservé aux joueurs.");
          b.room.handlePlayer(b.playerId, message as Parameters<Room["handlePlayer"]>[1]);
        }
      }
    }
  }

  private bindHost(room: Room): void {
    room.attachHost(this.conn);
    this.binding = { room };
    this.conn.send({ type: "session", role: "host", code: room.code, token: room.hostToken });
    room.broadcast();
  }

  private requireUnbound(): void {
    if (this.binding) throw new ProtocolError("not-allowed", "Vous êtes déjà dans une salle.");
  }

  private fail(code: ErrorCode, message: string): void {
    this.conn.send({ type: "error", code, message });
  }
}

function sameSecret(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
