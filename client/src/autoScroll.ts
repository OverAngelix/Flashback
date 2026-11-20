/**
 * Défilement automatique d'une liste trop haute pour l'écran (récapitulatif de l'écran hôte, que
 * personne ne fait défiler à la main) : pause en haut, descente lente, pause en bas, remontée rapide,
 * et ainsi de suite. Fonction pure, avancée image par image par `useAutoScroll`.
 */

export type AutoScrollPhase = "hold-top" | "down" | "hold-bottom" | "up";

export interface AutoScrollState {
  phase: AutoScrollPhase;
  /** Position de défilement, en pixels depuis le haut. */
  pos: number;
  /** Temps de pause restant (ms), pendant les phases hold-*. */
  wait: number;
}

export interface AutoScrollOptions {
  /** Vitesse de descente, en pixels par seconde. */
  speed: number;
  /** Vitesse de remontée, en pixels par seconde. */
  returnSpeed: number;
  /** Pause en haut et en bas, en millisecondes. */
  hold: number;
}

export const AUTO_SCROLL: Readonly<AutoScrollOptions> = { speed: 50, returnSpeed: 400, hold: 3000 };

export const autoScrollStart = (opts: AutoScrollOptions = AUTO_SCROLL): AutoScrollState => ({ phase: "hold-top", pos: 0, wait: opts.hold });

/** Avance de `dt` ms ; `max` = hauteur qui dépasse (0 ou moins : rien à faire défiler). */
export function stepAutoScroll(state: AutoScrollState, dt: number, max: number, opts: AutoScrollOptions = AUTO_SCROLL): AutoScrollState {
  if (max <= 0) return state.pos === 0 && state.phase === "hold-top" ? state : autoScrollStart(opts);
  const pos = Math.min(Math.max(state.pos, 0), max);
  switch (state.phase) {
    case "hold-top":
    case "hold-bottom": {
      const wait = state.wait - dt;
      if (wait > 0) return { ...state, pos, wait };
      return { phase: state.phase === "hold-top" ? "down" : "up", pos, wait: 0 };
    }
    case "down": {
      const next = pos + (opts.speed * dt) / 1000;
      return next >= max ? { phase: "hold-bottom", pos: max, wait: opts.hold } : { phase: "down", pos: next, wait: 0 };
    }
    case "up": {
      const next = pos - (opts.returnSpeed * dt) / 1000;
      return next <= 0 ? { phase: "hold-top", pos: 0, wait: opts.hold } : { phase: "up", pos: next, wait: 0 };
    }
  }
}
