import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameTrack } from "../game/types.js";
import { CATEGORIES, type CatalogTrack, type CategoryId, type CategorySummary } from "./types.js";

/** server/data, que le code tourne depuis src/ (tsx) ou dist/ (tsc). */
export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export interface CatalogEntry extends GameTrack {
  category: CategoryId;
  /** Extrait ou pochette introuvable chez Apple à la dernière vérification : le titre n'est plus tiré. */
  unavailable?: boolean;
}

export class Catalog {
  constructor(readonly tracks: CatalogEntry[]) {}

  /** Titres jouables : ceux dont les liens Apple répondaient à la dernière vérification. */
  get available(): CatalogEntry[] {
    return this.tracks.filter((t) => !t.unavailable);
  }

  categories(): CategorySummary[] {
    const available = this.available;
    return (Object.keys(CATEGORIES) as CategoryId[]).map((id) => ({
      id,
      label: CATEGORIES[id].label,
      count: available.filter((t) => t.category === id).length,
    }));
  }

  /**
   * Titres des catégories choisies, pour le moteur de jeu. Ce sont les entrées du catalogue
   * elles-mêmes, pas des copies : une adresse renouvelée par la vérification quotidienne profite
   * aussi aux parties en cours. Les vues n'en recopient que les champs publics (net/view.ts).
   */
  select(categoryIds: readonly string[]): GameTrack[] {
    const wanted = new Set(categoryIds);
    return this.available.filter((t) => wanted.has(t.category));
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
      category: t.category,
    });
  }
  return { catalog: new Catalog(entries), skipped };
}
