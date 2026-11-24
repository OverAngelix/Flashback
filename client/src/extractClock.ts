/** Durée d'un extrait Apple, tant que le navigateur ne connaît pas encore la vraie. */
export const DEFAULT_EXTRACT_SECONDS = 30;

export interface ExtractClock {
  /** Part écoulée, de 0 à 1. */
  progress: number;
  /** Secondes restantes, arrondies au-dessus (30, 29… 1, puis 0 à la fin). */
  remaining: number;
}

/** Où en est l'extrait, d'après la position et la durée de l'élément audio (durée inconnue : 30 s). */
export function extractClock(position: number, duration: number): ExtractClock {
  const total = Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_EXTRACT_SECONDS;
  const at = Math.min(total, Math.max(0, Number.isFinite(position) ? position : 0));
  return { progress: at / total, remaining: Math.max(0, Math.ceil(total - at - 1e-6)) };
}

/** « 0:30 », « 0:07 ». */
export function formatSeconds(s: number): string {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
