import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameTrack } from "../game/types.js";
import {
  CATEGORIES,
  type CatalogTrack,
  type CategorySummary,
  type GenreId,
  type OriginId,
  categoriesOf,
  matchesSelection,
} from "./types.js";

/** server/data, que le code tourne depuis src/ (tsx) ou dist/ (tsc). */
export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export interface CatalogEntry extends GameTrack {
  origin: OriginId;
  genres: GenreId[];
  /** Extrait ou pochette introuvable chez Apple à la dernière vérification : le titre n'est plus tiré. */
  unavailable?: boolean;
}

export class Catalog {
  constructor(readonly tracks: CatalogEntry[]) {}

  /** Titres jouables : ceux dont les liens Apple répondaient à la dernière vérification. */
  get available(): CatalogEntry[] {
    return this.tracks.filter((t) => !t.unavailable);
  }

  /** Toutes les catégories avec leur nombre de titres jouables (un titre compte dans plusieurs). */
  categories(): CategorySummary[] {
    const counts = new Map<string, number>();
    for (const t of this.available) for (const id of categoriesOf(t)) counts.set(id, (counts.get(id) ?? 0) + 1);
    return CATEGORIES.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  }

  /**
   * Titres de la sélection (voir matchesSelection : OU dans un axe, ET entre axes, rien de choisi =
   * tout le catalogue), pour le moteur de jeu. Ce sont les entrées du catalogue
   * elles-mêmes, pas des copies : une adresse renouvelée par la vérification quotidienne profite
   * aussi aux parties en cours. Les vues n'en recopient que les champs publics (net/view.ts).
   */
  select(categoryIds: readonly string[]): GameTrack[] {
    return this.available.filter((t) => matchesSelection(t, categoryIds));
  }
}

/** Charge catalog.json. Un titre sans adresse d'extrait ou de pochette est écarté. */
export async function loadCatalog(dataDir = DEFAULT_DATA_DIR): Promise<{ catalog: Catalog; skipped: string[] }> {
  const raw = JSON.parse(await readFile(resolve(dataDir, "catalog.json"), "utf8")) as CatalogTrack[];
  const entries: CatalogEntry[] = [];
  const skipped: string[] = [];

  for (const t of raw) {
    if (!t.previewUrl || !t.artworkUrl) {
      skipped.push(t.query);
      continue;
    }
    entries.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      year: t.year,
      previewUrl: t.previewUrl,
      artworkUrl: t.artworkUrl,
      origin: t.origin,
      genres: t.genres ?? [],
    });
  }
  return { catalog: new Catalog(entries), skipped };
}
