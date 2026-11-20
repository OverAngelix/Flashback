import { effectScope, reactive, watch } from "vue";
import { CAMPAIGN, type CampaignLevel } from "@server/game/campaign";

/**
 * Progression en solo, gardée dans le navigateur (pas de comptes) : les étoiles de chaque niveau de
 * campagne (la meilleure obtenue) et le record de la partie libre pour chaque sélection de catégories.
 */
export interface SoloProgress {
  /** Niveau -> étoiles, de 1 à 3 ; absent tant que le niveau n'a pas été réussi. */
  stars: Record<string, number>;
  /** Clé de sélection (voir selectionKey) -> plus longue frise. */
  records: Record<string, number>;
  /** Longueur de la frise à la fin de la dernière partie libre ; null avant la première. */
  lastScore: number | null;
}

const KEY = "flashback.solo";

type Store = Pick<Storage, "getItem" | "setItem">;

const isCount = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;

/** Relit une progression mémorisée, en ignorant toute entrée invalide (jamais d'exception). */
export function parseProgress(raw: string | null): SoloProgress {
  const progress: SoloProgress = { stars: {}, records: {}, lastScore: null };
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    return progress;
  }
  const entries = (v: unknown) => (typeof v === "object" && v !== null && !Array.isArray(v) ? Object.entries(v) : []);
  for (const [id, n] of entries(data.stars)) if (isCount(n, 3)) progress.stars[id] = n;
  for (const [key, n] of entries(data.records)) if (isCount(n, 10_000)) progress.records[key] = n;
  if (isCount(data.lastScore, 10_000)) progress.lastScore = data.lastScore;
  return progress;
}

/** Étoiles d'une fin de niveau : une par vie restante si le niveau est réussi, aucune sinon. */
export const starsFor = (won: boolean, lives: number): number => (won ? Math.max(1, Math.min(3, lives)) : 0);

/** Le premier niveau est ouvert ; chacun des suivants s'ouvre quand le précédent est réussi. */
export function isUnlocked(index: number, stars: Readonly<Record<string, number>>, levels: readonly CampaignLevel[] = CAMPAIGN): boolean {
  if (index <= 0) return true;
  const previous = levels[index - 1];
  return !!previous && (stars[previous.id] ?? 0) > 0;
}

/** Clé de record d'une sélection : les catégories triées, ou « all » pour tout le catalogue. */
export const selectionKey = (categories: readonly string[]): string => (categories.length ? [...categories].sort().join("+") : "all");

/** Garde le meilleur nombre d'étoiles du niveau. Renvoie vrai s'il s'améliore. */
export function recordStars(progress: SoloProgress, levelId: string, stars: number): boolean {
  if (stars <= (progress.stars[levelId] ?? 0)) return false;
  progress.stars[levelId] = stars;
  return true;
}

/**
 * Note le score d'une partie libre (dernier score) et garde la plus longue frise de cette sélection.
 * Renvoie l'ancien record (undefined s'il n'y en avait pas).
 */
export function recordScore(progress: SoloProgress, key: string, score: number): number | undefined {
  const previous = progress.records[key];
  progress.lastScore = score;
  if (score > (previous ?? 0)) progress.records[key] = score;
  return previous;
}

/** Progression réactive, enregistrée à chaque modification. `storage` est null si le navigateur le refuse. */
export function createProgress(storage: Store | null): SoloProgress {
  let initial: string | null = null;
  try {
    initial = storage?.getItem(KEY) ?? null;
  } catch {
    initial = null;
  }
  const state = reactive<SoloProgress>(parseProgress(initial));
  // Portée détachée : l'enregistrement ne doit pas s'arrêter avec le premier écran qui a créé la
  // progression (sinon tout ce qui est gagné après avoir quitté /solo est perdu au rechargement).
  effectScope(true).run(() =>
    watch(
      state,
      () => {
        try {
          storage?.setItem(KEY, JSON.stringify(state));
        } catch {
          // Stockage plein ou interdit : la progression vaut pour cette visite seulement.
        }
      },
      { deep: true, flush: "sync" },
    ),
  );
  return state;
}

let instance: SoloProgress | undefined;
/** Progression unique de l'application, relue au premier appel. */
export function useSoloProgress(): SoloProgress {
  if (!instance) {
    let storage: Store | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    instance = createProgress(storage);
  }
  return instance;
}
