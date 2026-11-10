import type { CategorySummary } from "../catalog/types.js";
import type { Game } from "../game/game.js";
import type { GameTrack } from "../game/types.js";
import type { GameView, PublicCard } from "./protocol.js";

export const mediaUrl = (file: string) => `/media/${file}`;

export function publicCard(track: GameTrack): PublicCard {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    year: track.year,
    imageUrl: mediaUrl(track.imageFile),
  };
}

export interface ViewContext {
  code: string;
  categories: string[];
  availableCategories: CategorySummary[];
  connectedPlayerIds: ReadonlySet<string>;
  leaderId: string | null;
}

/** Construit la vue publique. Le titre courant n'y apparaît que sous forme d'URL d'extrait. */
export function buildView(game: Game, ctx: ViewContext): GameView {
  return {
    code: ctx.code,
    phase: game.phase,
    round: game.round,
    cardsToWin: game.cardsToWin,
    categories: ctx.categories,
    availableCategories: ctx.availableCategories,
    trackCount: game.remainingTracks,
    leaderId: ctx.leaderId,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: ctx.connectedPlayerIds.has(p.id),
      timeline: p.timeline.map(publicCard),
    })),
    activePlayerId: game.activePlayer?.id ?? null,
    current: game.current ? { audioUrl: mediaUrl(game.current.audioFile) } : null,
    listened: game.listened,
    lastResult:
      game.phase === "reveal" && game.lastResult
        ? {
            playerId: game.lastResult.playerId,
            position: game.lastResult.position,
            correct: game.lastResult.correct,
            track: publicCard(game.lastResult.track),
          }
        : null,
    winnerIds: game.winnerIds,
  };
}
