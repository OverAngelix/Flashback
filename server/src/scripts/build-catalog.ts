/**
 * Construit server/data/catalog.json à partir de SOURCE_TRACKS via l'API de recherche iTunes.
 *
 * Usage : npm run catalog:build [-- --refresh]
 *  - incrémental : les titres déjà présents (clé = requête) ne sont pas redemandés ;
 *  - --refresh : retélécharge tout (les années marquées yearSource "manual" sont conservées) ;
 *  - pour corriger une année : éditer year dans catalog.json et mettre yearSource à "manual" ;
 *  - les titres introuvables ou douteux vont dans server/data/catalog-misses.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE_TRACKS } from "../catalog/source-tracks.js";
import {
  CATEGORIES,
  type CatalogMiss,
  type CatalogTrack,
  type CategoryId,
} from "../catalog/types.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const CATALOG_PATH = resolve(DATA_DIR, "catalog.json");
const MISSES_PATH = resolve(DATA_DIR, "catalog-misses.json");

/** iTunes limite à environ 20 requêtes par minute et par IP. */
const DELAY_MS = 3200;
const SEARCH_LIMIT = 15;

interface ItunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl: string;
  releaseDate: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripParens = (s: string) => s.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");

/** Mots qui signalent une version qui n'est pas l'originale (appliqué au texte normalisé). */
const ALT_VERSION =
  /\b(live|remix(es)?|(?<!radio )mix|karaoke|tribute|instrumental|acoustic|demo|cover|piano|lullaby|made famous|track by track|commentary|interview)\b/;
/** Albums enregistrés hors studio : écartés d'après le nom de l'album seulement. */
const ALT_COLLECTION = /\b(radio|olympia|bobino|concert|hasselt)\b/;
/** "The Sound of Silence" doit correspondre à "Sound of Silence". */
const dropArticle = (s: string) => s.replace(/^the /, "");

function parseSource(line: string): { title: string; artist: string } {
  const i = line.indexOf(" - ");
  if (i < 0) throw new Error(`Format invalide (attendu "Titre - Artiste") : ${line}`);
  return { title: line.slice(0, i).trim(), artist: line.slice(i + 3).trim() };
}

function artistParts(artist: string): string[] {
  return artist
    .split(/,|&|\bft\.?\b|\bfeat\.?\b/i)
    .map(norm)
    .filter(Boolean);
}

function pickBest(
  results: ItunesResult[],
  title: string,
  artist: string,
): { best?: ItunesResult; reason?: string } {
  const wantTitle = dropArticle(norm(stripParens(title)));
  const wantFull = norm(title);
  const wantArtists = artistParts(artist);
  const wantsAlt = ALT_VERSION.test(wantFull);

  const accepted = results.filter((r) => {
    if (!r.previewUrl) return false;
    const gotTitle = dropArticle(norm(stripParens(r.trackName)));
    const gotArtist = norm(r.artistName);
    const titleOk = gotTitle === wantTitle || gotTitle.startsWith(`${wantTitle} `);
    const artistOk = wantArtists.some((a) => gotArtist.includes(a) || a.includes(gotArtist));
    if (!titleOk || !artistOk) return false;
    if (!wantsAlt && ALT_VERSION.test(norm(`${r.trackName} ${r.collectionName ?? ""}`))) return false;
    if (!wantsAlt && ALT_COLLECTION.test(norm(r.collectionName ?? ""))) return false;
    return true;
  });

  if (accepted.length === 0) {
    return { reason: results.length === 0 ? "aucun résultat" : "aucun résultat ne correspond au titre et à l'artiste" };
  }
  // L'original est presque toujours la plus ancienne sortie ; les compilations sont plus récentes.
  accepted.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return { best: accepted[0] };
}

async function search(term: string, store: string): Promise<ItunesResult[]> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&entity=song&limit=${SEARCH_LIMIT}&country=${store}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as { results: ItunesResult[] };
      return json.results;
    }
    if (res.status !== 403 && res.status !== 429 && res.status < 500) {
      throw new Error(`iTunes ${res.status} pour "${term}"`);
    }
    console.warn(`  ↻ ${res.status}, nouvel essai dans ${attempt * 30}s`);
    await sleep(attempt * 30_000);
  }
  throw new Error(`iTunes injoignable pour "${term}"`);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  await mkdir(DATA_DIR, { recursive: true });

  const previous = await readJson<CatalogTrack[]>(CATALOG_PATH, []);
  const manual = new Map(previous.filter((t) => t.yearSource === "manual").map((t) => [t.query, t]));
  const done = new Map((refresh ? [] : previous).map((t) => [t.query, t]));
  const misses: CatalogMiss[] = [];
  const seen = new Set<string>();
  const queue: { category: CategoryId; line: string }[] = [];

  for (const category of Object.keys(SOURCE_TRACKS) as CategoryId[]) {
    for (const line of SOURCE_TRACKS[category]) {
      const key = norm(line);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ category, line });
    }
  }

  const todo = queue.filter((q) => !done.has(q.line));
  console.log(`${queue.length} titres uniques, ${queue.length - todo.length} déjà en cache, ${todo.length} à chercher.`);

  const save = async () => {
    const order = new Map(queue.map((q, i) => [q.line, i]));
    const tracks = [...done.values()]
      .filter((t) => order.has(t.query))
      .sort((a, b) => order.get(a.query)! - order.get(b.query)!);
    await writeFile(CATALOG_PATH, `${JSON.stringify(tracks, null, 2)}\n`);
    await writeFile(MISSES_PATH, `${JSON.stringify(misses, null, 2)}\n`);
  };

  for (const [i, { category, line }] of todo.entries()) {
    const { title, artist } = parseSource(line);
    process.stdout.write(`[${i + 1}/${todo.length}] ${line} … `);
    // Boutique de la catégorie d'abord, puis les autres si rien ne correspond.
    const stores = [...new Set([CATEGORIES[category].store, "US", "FR"])];
    let best: ItunesResult | undefined;
    let reason: string | undefined;
    for (const [n, store] of stores.entries()) {
      if (n > 0) await sleep(DELAY_MS);
      const picked = pickBest(await search(`${title} ${artist}`, store), title, artist);
      best = picked.best;
      reason = picked.reason;
      if (best) break;
    }
    if (!best) {
      console.log(`✗ ${reason}`);
      misses.push({ query: line, category, reason: reason ?? "inconnu" });
    } else {
      const itunesYear = Number(best.releaseDate.slice(0, 4));
      const kept = manual.get(line);
      const year = kept?.year ?? itunesYear;
      done.set(line, {
        id: best.trackId,
        title,
        artist,
        year,
        yearSource: kept ? "manual" : "itunes",
        ...(kept?.yearNote ? { yearNote: kept.yearNote } : {}),
        releaseDate: best.releaseDate,
        category,
        previewUrl: best.previewUrl!,
        artworkUrl: (best.artworkUrl100 ?? "").replace("100x100bb", "600x600bb"),
        appleUrl: best.trackViewUrl,
        query: line,
        match: {
          trackName: best.trackName,
          artistName: best.artistName,
          collectionName: best.collectionName ?? "",
        },
      });
      console.log(`✓ ${year}`);
    }
    await save();
    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  await save();
  console.log(`\nTerminé : ${done.size} titres dans le catalogue, ${misses.length} échecs (voir catalog-misses.json).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
