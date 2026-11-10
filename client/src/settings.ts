import { reactive, watch } from "vue";
import { MAX_NAME_LENGTH } from "@server/game/types";

export interface Settings {
  /** Volume des extraits joués par l'écran hôte, de 0 à 1. */
  volume: number;
  /** Musique d'ambiance du menu. */
  music: boolean;
  /** Volume de la musique du menu, de 0 à 1. */
  musicVolume: number;
  /** Coupe les animations (confettis, fond, transitions), en plus du réglage du système. */
  reducedMotion: boolean;
  /** Affiche l'écran de démarrage au chargement. */
  splash: boolean;
  /** Nom proposé par défaut au formulaire pour rejoindre une partie. */
  playerName: string;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = { volume: 1, music: true, musicVolume: 0.45, reducedMotion: false, splash: true, playerName: "" };

const clamp01 = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

const KEY = "flashback.settings";

type Store = Pick<Storage, "getItem" | "setItem">;

/** Relit des réglages mémorisés en ignorant tout ce qui est invalide (jamais d'exception). */
export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    // Contenu illisible : on repart des valeurs par défaut.
  }
  return {
    volume: clamp01(data.volume, DEFAULT_SETTINGS.volume),
    music: typeof data.music === "boolean" ? data.music : DEFAULT_SETTINGS.music,
    musicVolume: clamp01(data.musicVolume, DEFAULT_SETTINGS.musicVolume),
    reducedMotion: typeof data.reducedMotion === "boolean" ? data.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    splash: typeof data.splash === "boolean" ? data.splash : DEFAULT_SETTINGS.splash,
    playerName: typeof data.playerName === "string" ? data.playerName.trim().slice(0, MAX_NAME_LENGTH) : DEFAULT_SETTINGS.playerName,
  };
}

/** Réglages réactifs, enregistrés à chaque modification. `storage` est null si le navigateur le refuse. */
export function createSettings(storage: Store | null) {
  let initial: string | null = null;
  try {
    initial = storage?.getItem(KEY) ?? null;
  } catch {
    initial = null;
  }
  const state = reactive<Settings>(parseSettings(initial));
  watch(
    state,
    () => {
      try {
        storage?.setItem(KEY, JSON.stringify({ ...state }));
      } catch {
        // Stockage plein ou interdit : les réglages valent pour cette visite seulement.
      }
    },
    { deep: true, flush: "sync" },
  );
  return state;
}

let instance: Settings | undefined;
/** Réglages uniques de l'application, relus au premier appel. */
export function useSettings(): Settings {
  if (!instance) {
    let storage: Store | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    instance = createSettings(storage);
  }
  return instance;
}
