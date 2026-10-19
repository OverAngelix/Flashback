/**
 * Télécharge les extraits audio et les pochettes du catalogue dans server/data/media/
 * et renseigne audioFile / imageFile dans catalog.json. Le jeu ne dépend plus d'Apple.
 *
 * Usage : npm run catalog:download [-- --refresh]
 *  - incrémental : un fichier déjà présent n'est pas retéléchargé ;
 *  - --refresh : retélécharge tout (à faire si les URL d'extraits ont changé).
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogTrack } from "../catalog/types.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const CATALOG_PATH = resolve(DATA_DIR, "catalog.json");
const MEDIA_DIR = resolve(DATA_DIR, "media");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Un fichier plus petit est forcément une erreur (page HTML, réponse vide). */
const MIN_BYTES = 5_000;

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size >= MIN_BYTES;
  } catch {
    return false;
  }
}

async function download(url: string, dest: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error(`fichier trop petit (${buf.length} o) : ${url}`);
      await writeFile(dest, buf);
      return;
    }
    if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} pour ${url}`);
    await sleep(attempt * 3000);
  }
  throw new Error(`échec du téléchargement : ${url}`);
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as CatalogTrack[];
  await mkdir(resolve(MEDIA_DIR, "audio"), { recursive: true });
  await mkdir(resolve(MEDIA_DIR, "images"), { recursive: true });

  const failures: string[] = [];
  let downloaded = 0;

  for (const [i, t] of catalog.entries()) {
    const audioFile = `audio/${t.id}${extname(new URL(t.previewUrl).pathname) || ".m4a"}`;
    const imageFile = `images/${t.id}.jpg`;
    try {
      for (const [file, url] of [
        [audioFile, t.previewUrl],
        [imageFile, t.artworkUrl],
      ] as const) {
        const dest = resolve(MEDIA_DIR, file);
        if (refresh || !(await exists(dest))) {
          await download(url, dest);
          downloaded++;
          await sleep(150);
        }
      }
      t.audioFile = audioFile;
      t.imageFile = imageFile;
    } catch (err) {
      delete t.audioFile;
      delete t.imageFile;
      failures.push(`${t.query} : ${(err as Error).message}`);
      console.log(`[${i + 1}/${catalog.length}] ✗ ${t.query}`);
    }
  }

  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`${downloaded} fichiers téléchargés, ${catalog.length - failures.length}/${catalog.length} titres complets.`);
  for (const f of failures) console.log(`  ✗ ${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
