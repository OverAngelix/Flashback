/**
 * Vérifie les liens Apple (extrait, pochette) de chaque titre de catalog.json et y enregistre les
 * adresses renouvelées. Le serveur fait la même vérification chaque jour, mais en mémoire
 * seulement : ce script sert à garder catalog.json à jour dans le dépôt.
 *
 * Usage : npm run catalog:check
 * Les titres dont Apple ne fournit plus d'extrait sont listés, pas supprimés : à retirer de
 * source-tracks.ts et de catalog.json, ou à remplacer par une autre version.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyLinks } from "../catalog/links.js";
import { DEFAULT_DATA_DIR, loadCatalog } from "../catalog/store.js";
import type { CatalogTrack } from "../catalog/types.js";

const CATALOG_PATH = resolve(DEFAULT_DATA_DIR, "catalog.json");

async function main() {
  const { catalog } = await loadCatalog();
  console.log(`Vérification de ${catalog.tracks.length} titres…`);
  const report = await verifyLinks(catalog.tracks);

  if (report.refreshed.length > 0) {
    const fresh = new Map(catalog.tracks.map((t) => [t.id, t]));
    const raw = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as CatalogTrack[];
    for (const t of raw) {
      const entry = fresh.get(t.id);
      if (!entry) continue;
      t.previewUrl = entry.previewUrl;
      t.artworkUrl = entry.artworkUrl;
    }
    await writeFile(CATALOG_PATH, `${JSON.stringify(raw, null, 2)}\n`);
  }

  console.log(`${report.refreshed.length} renouvelés (enregistrés dans catalog.json), ${report.removed.length} sans extrait, ${report.inconclusive.length} sans réponse claire.`);
  for (const t of report.refreshed) console.log(`  ↻ ${t}`);
  for (const t of report.removed) console.log(`  ✗ ${t}`);
  for (const t of report.inconclusive) console.log(`  ? ${t}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
