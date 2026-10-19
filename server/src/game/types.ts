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
}

export type Phase =
  | "lobby"
  | "awaiting-placement"
  | "reveal"
  | "round-recap"
  | "finished";

export interface PlacementResult {
  playerId: string;
  /** Position demandée dans la frise (0 = avant la première carte). */
  position: number;
  correct: boolean;
  track: GameTrack;
}

export const AVATAR_COUNT = 10;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const DEFAULT_CARDS_TO_WIN = 10;
export const MAX_NAME_LENGTH = 16;

/** Erreur de règle (action invalide) : le message est lisible par un joueur. */
export class GameError extends Error {}
