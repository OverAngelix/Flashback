import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameTrack } from "../game/types.js";
import { CATEGORIES, type CatalogTrack, type CategoryId, type CategorySummary } from "./types.js";

/** server/data, que le code tourne depuis src/ (tsx) ou dist/ (tsc). */
export const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export interface CatalogEntry extends GameTrack {
  category: CategoryId;
}

export class Catalog {
  constructor(readonly tracks: CatalogEntry[]) {}

  categories(): CategorySummary[] {
    return (Object.keys(CATEGORIES) as CategoryId[]).map((id) => ({
      id,
      label: CATEGORIES[id].label,
      count: this.tracks.filter((t) => t.category === id).length,
    }));
  }

  /** Titres des catégories choisies, sous la forme que le moteur de jeu attend. */
  select(categoryIds: readonly string[]): GameTrack[] {
    const wanted = new Set(categoryIds);
    return this.tracks
      .filter((t) => wanted.has(t.category))
      .map(({ category: _category, ...track }) => track);
  }
}

/**
 * Charge catalog.json et ne garde que les titres dont l'extrait et la pochette sont bien
 * présents sur disque : le jeu ne dépend jamais d'iTunes.
 */
export async function loadCatalog(dataDir = DEFAULT_DATA_DIR): Promise<{ catalog: Catalog; skipped: string[] }> {
  const raw = JSON.parse(await readFile(resolve(dataDir, "catalog.json"), "utf8")) as CatalogTrack[];
  const entries: CatalogEntry[] = [];
  const skipped: string[] = [];

  for (const t of raw) {
    if (!t.audioFile || !t.imageFile || !(await exists(resolve(dataDir, "media", t.audioFile))) || !(await exists(resolve(dataDir, "media", t.imageFile)))) {
      skipped.push(t.query);
      continue;
    }
    entries.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      year: t.year,
      audioFile: t.audioFile,
      imageFile: t.imageFile,
      category: t.category,
    });
  }
  return { catalog: new Catalog(entries), skipped };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
