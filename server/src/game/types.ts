/** Un titre tel que le moteur le manipule : l'année ne doit jamais fuiter avant le placement. */
export interface GameTrack {
  id: number;
  title: string;
  artist: string;
  year: number;
  audioFile: string;
  imageFile: string;
}

export interface Player {
  id: string;
  name: string;
  /** Index de l'avatar, de 0 à AVATAR_COUNT - 1. */
  avatar: number;
  /** Cartes posées, toujours triées par année croissante. */
  timeline: GameTrack[];
  /** Points groove : titres bien placés dans la frise d'un autre joueur, pendant son tour. */
  groove: number;
}

export type Phase =
  | "lobby"
  | "awaiting-placement"
  | "reveal"
  | "round-recap"
  | "finished";

/** Un placement groove : un autre joueur a placé le titre dans la frise du joueur actif. */
export interface GrooveGuess {
  playerId: string;
  /** Position dans la frise du joueur actif, telle qu'elle était avant son placement. */
  position: number;
  correct: boolean;
}

export interface PlacementResult {
  playerId: string;
  /** Position demandée dans la frise (0 = avant la première carte), -1 si le tour a été passé. */
  position: number;
  correct: boolean;
  track: GameTrack;
  /** Placements groove des autres joueurs, dans l'ordre des joueurs. */
  groove: GrooveGuess[];
}

export const AVATAR_COUNT = 10;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const DEFAULT_CARDS_TO_WIN = 10;
/** Bornes du nombre de cartes pour gagner, réglable dans le salon. */
export const MIN_CARDS_TO_WIN = 3;
export const MAX_CARDS_TO_WIN = 10;
export const MAX_NAME_LENGTH = 16;

/**
 * La règle de placement, partagée avec le client (qui montre les bonnes réponses à la révélation) :
 * l'année doit être comprise, bornes incluses, entre celles des voisins dans la frise.
 */
export function isCorrectPlacement(timeline: readonly { year: number }[], position: number, year: number): boolean {
  const before = timeline[position - 1];
  const after = timeline[position];
  return (before === undefined || before.year <= year) && (after === undefined || year <= after.year);
}

/** Toutes les positions justes pour cette année (plusieurs quand des années sont égales). */
export function correctPositions(timeline: readonly { year: number }[], year: number): number[] {
  return Array.from({ length: timeline.length + 1 }, (_, i) => i).filter((i) => isCorrectPlacement(timeline, i, year));
}

/** Erreur de règle (action invalide) : le message est lisible par un joueur. */
export class GameError extends Error {}
