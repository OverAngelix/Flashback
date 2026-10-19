import type { CategorySummary } from "../catalog/types.js";
import type { Phase } from "../game/types.js";

/**
 * Ce fichier est aussi importé par le client (alias @server) : il ne doit dépendre que de
 * game/types.ts et catalog/types.ts, jamais d'un module Node (voir shared-purity.test.ts).
 */

export const ROOM_CODE_LENGTH = 6;

/** Messages envoyés par un client (écran hôte ou téléphone) au serveur. */
export type ClientMessage =
  | { type: "host:create" }
  | { type: "host:rejoin"; code: string; token: string }
  | { type: "player:join"; code: string; name: string; avatar: number }
  | { type: "player:rejoin"; code: string; token: string }
  | { type: "host:setCategories"; categories: string[] }
  | { type: "host:start" }
  | { type: "host:advance" }
  | { type: "host:skipTurn" }
  | { type: "host:kick"; playerId: string }
  | { type: "player:place"; position: number }
  | { type: "player:play" }
  | { type: "player:leave" };

export type ErrorCode =
  | "bad-message" // message illisible ou mal formé
  | "room-not-found" // code de salle inconnu ou jeton invalide
  | "not-allowed" // action interdite pour ce rôle
  | "rule" // règle du jeu : le message est destiné à être affiché au joueur
  | "internal";

/** Messages envoyés par le serveur. */
export type ServerMessage =
  /** Envoyé après host:create, host:rejoin, player:join, player:rejoin. À conserver pour se reconnecter. */
  | { type: "session"; role: "host" | "player"; code: string; token: string; playerId?: string }
  /** État complet de la partie, renvoyé à chaque changement. `you` = identifiant du joueur, null pour l'hôte. */
  | { type: "state"; view: GameView; you: string | null }
  /** À l'hôte uniquement : un joueur demande à jouer l'extrait du titre courant. */
  | { type: "audio:play"; audioUrl: string }
  | { type: "kicked" }
  | { type: "error"; code: ErrorCode; message: string };

/** Une carte déjà posée dans une frise : les informations sont publiques. */
export interface PublicCard {
  id: number;
  title: string;
  artist: string;
  year: number;
  imageUrl: string;
}

export interface PlayerView {
  id: string;
  name: string;
  avatar: number;
  connected: boolean;
  timeline: PublicCard[];
}

/**
 * Vue de la partie, identique pour tous. Elle ne contient JAMAIS le titre, l'artiste, l'année ni la
 * pochette du titre courant avant la révélation : `current` ne porte que l'URL de l'extrait.
 */
export interface GameView {
  code: string;
  phase: Phase;
  round: number;
  cardsToWin: number;
  /** Catégories choisies par l'hôte. */
  categories: string[];
  /** Toutes les catégories avec leur nombre de titres (pour l'écran de sélection). */
  availableCategories: CategorySummary[];
  /** Nombre de titres du paquet choisi (avant le départ) ou restant (en partie). */
  trackCount: number;
  players: PlayerView[];
  activePlayerId: string | null;
  current: { audioUrl: string } | null;
  /** Résultat du dernier placement, uniquement pendant la phase "reveal". */
  lastResult: { playerId: string; position: number; correct: boolean; track: PublicCard } | null;
  winnerIds: string[];
}

const isString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/** Valide un message brut. Renvoie null s'il est illisible ou mal formé. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const m = data as Record<string, unknown>;

  switch (m.type) {
    case "host:create":
    case "host:start":
    case "host:advance":
    case "host:skipTurn":
    case "player:play":
    case "player:leave":
      return { type: m.type };
    case "host:rejoin":
    case "player:rejoin":
      return isString(m.code, 16) && isString(m.token, 64)
        ? { type: m.type, code: m.code, token: m.token }
        : null;
    case "player:join":
      return isString(m.code, 16) && isString(m.name, 64) && Number.isInteger(m.avatar)
        ? { type: "player:join", code: m.code, name: m.name, avatar: m.avatar as number }
        : null;
    case "host:setCategories":
      return Array.isArray(m.categories) && m.categories.length <= 20 && m.categories.every((c) => isString(c, 32))
        ? { type: "host:setCategories", categories: m.categories as string[] }
        : null;
    case "host:kick":
      return isString(m.playerId, 16) ? { type: "host:kick", playerId: m.playerId } : null;
    case "player:place":
      return Number.isInteger(m.position) ? { type: "player:place", position: m.position as number } : null;
    default:
      return null;
  }
}
