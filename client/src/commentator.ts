import type { GameView } from "@server/net/protocol";
import lines from "./commentatorLines.json";

/**
 * Commentateur de l'écran hôte : à certains moments de la partie, une phrase enregistrée tirée au
 * hasard dans une banque (commentatorLines.json, fichiers audio dans public/commentator/, produits
 * par `npm run commentator:build`). Les phrases ne citent personne : un enregistrement ne connaît
 * pas les prénoms.
 */
export type Situation = keyof typeof lines;

export interface Line {
  id: string;
  text: string;
}

export const LINES: Readonly<Record<Situation, readonly Line[]>> = lines;

/** Écart à partir duquel un raté est « de peu » (au plus) ou « énorme » (au moins), en années. */
export const CLOSE_YEARS = 2;
export const FAR_YEARS = 20;

/** Adresse du fichier audio d'une phrase. */
export const lineUrl = (line: Line): string => `/commentator/${line.id}.m4a`;

/**
 * De combien d'années le titre est mal placé : écart avec le voisin qui contredit le placement.
 * 0 pour un placement juste ou un tour passé.
 */
export function yearsOff(view: GameView): number {
  const r = view.lastResult;
  if (!r || r.correct || r.position < 0) return 0;
  const timeline = view.players.find((p) => p.id === r.playerId)?.timeline ?? [];
  const year = r.track.year;
  const left = timeline[r.position - 1];
  const right = timeline[r.position];
  return Math.max(0, left ? left.year - year : 0, right ? year - right.year : 0);
}

/** Récapitulatif alors que plusieurs joueurs sont en tête à l'objectif : on rejoue un tour. */
function isTie(view: GameView): boolean {
  const lengths = view.players.map((p) => p.timeline.length);
  const best = Math.max(0, ...lengths);
  return best >= view.cardsToWin && lengths.filter((n) => n === best).length > 1;
}

/**
 * Ce que le commentateur a à dire en passant de `prev` à `view`. Rien au premier état reçu
 * (chargement, reconnexion) ni tant que la phase et le tour n'ont pas changé.
 */
export function situationFor(prev: GameView | null, view: GameView): Situation | null {
  if (!prev || view.solo) return null;
  const same = prev.phase === view.phase && prev.round === view.round && prev.activePlayerId === view.activePlayerId;
  if (same) return null;

  switch (view.phase) {
    case "awaiting-placement":
      return prev.phase === "lobby" ? "start" : null;
    case "reveal": {
      const r = view.lastResult;
      if (!r || r.position < 0) return null; // tour passé (joueur absent) : rien à commenter
      if (r.correct) return "correct";
      const off = yearsOff(view);
      if (off <= CLOSE_YEARS) return "close";
      if (r.groove.some((g) => g.correct)) return "stolen";
      return off >= FAR_YEARS ? "far" : "wrong";
    }
    case "round-recap":
      return isTie(view) ? "tie" : "recap";
    case "finished":
      return prev.phase !== "finished" && view.winnerIds.length > 0 ? "victory" : null;
    default:
      return null;
  }
}

/** Une phrase de la situation au hasard, jamais la même que `lastId` quand il y a le choix. */
export function pickLine(situation: Situation, lastId: string | null, rng: () => number = Math.random): Line | null {
  const bank = LINES[situation];
  const choices = bank.length > 1 ? bank.filter((l) => l.id !== lastId) : bank;
  return choices[Math.floor(rng() * choices.length)] ?? null;
}
