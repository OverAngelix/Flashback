import type { CategorySummary } from "../catalog/types.js";
import type { Game } from "../game/game.js";
import type { GameTrack } from "../game/types.js";
import type { GameView, PublicCard } from "./protocol.js";

export function publicCard(track: GameTrack): PublicCard {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    year: track.year,
    imageUrl: track.artworkUrl,
  };
}

export interface ViewContext {
  code: string;
  categories: string[];
  availableCategories: CategorySummary[];
  connectedPlayerIds: ReadonlySet<string>;
  leaderId: string | null;
  commentator: boolean;
  /** Niveau de campagne d'une partie solo. */
  level?: string | null;
}

/**
 * Construit la vue publique. Le titre courant n'y apparaît que sous forme d'adresse d'extrait chez
 * Apple, opaque : ni l'identifiant iTunes ni l'année ne s'y lisent.
 */
export function buildView(game: Game, ctx: ViewContext): GameView {
  return {
    code: ctx.code,
    phase: game.phase,
    round: game.round,
    cardsToWin: game.cardsToWin,
    commentator: ctx.commentator,
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
      groove: p.groove,
    })),
    activePlayerId: game.activePlayer?.id ?? null,
    current: game.current ? { audioUrl: game.current.previewUrl } : null,
    listened: game.listened,
    grooveGuessIds: game.phase === "awaiting-placement" ? [...game.grooveGuesses.keys()] : [],
    solo: game.solo ? { ...game.solo, level: ctx.level ?? null } : null,
    lastResult:
      game.phase === "reveal" && game.lastResult
        ? {
            playerId: game.lastResult.playerId,
            position: game.lastResult.position,
            correct: game.lastResult.correct,
            track: publicCard(game.lastResult.track),
            groove: game.lastResult.groove.map((g) => ({ ...g })),
          }
        : null,
    winnerIds: game.winnerIds,
  };
}
