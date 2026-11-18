/**
 * Construit server/data/catalog.json à partir de SOURCE_TRACKS via l'API de recherche iTunes.
 *
 * Usage : npm run catalog:build [-- --refresh]
 *  - incrémental : les titres déjà présents (clé = requête) ne sont pas redemandés ;
 *  - --refresh : retélécharge tout (les années marquées yearSource "manual" sont conservées) ;
 *  - pour corriger une année : éditer year dans catalog.json et mettre yearSource à "manual" ;
 *  - les titres introuvables ou douteux vont dans server/data/catalog-misses.json ;
 *  - une ligne qui tombe sur une mauvaise version peut imposer son titre : `| itunes:<trackId>` ;
 *  - origine et genres sont relus à chaque passage, même pour les titres en cache : changer les
 *    genres d'une ligne ne relance pas la recherche (la clé est « Titre - Artiste », sans les genres).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { largeArtwork } from "../catalog/links.js";
import { SOURCE_TRACKS } from "../catalog/source-tracks.js";
import {
  type CatalogMiss,
  type CatalogTrack,
  type GenreId,
  isGenre,
  ORIGINS,
  type OriginId,
} from "../catalog/types.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const CATALOG_PATH = resolve(DATA_DIR, "catalog.json");
const MISSES_PATH = resolve(DATA_DIR, "catalog-misses.json");

/** iTunes limite à environ 20 requêtes par minute et par IP. */
const DELAY_MS = 3200;
const SEARCH_LIMIT = 50;

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
const ALT_VERSION = new RegExp(
  [
    String.raw`\b(live|remix(es)?|(?<!radio )mix|karaoke|tribute|demo|cover|piano|lullaby|made famous|track by track|commentary|interview)\b`,
    // Sans paroles, ou au contraire sans musique (anglais et français).
    String.raw`\b(instrumental|instrumentale?s?|instrumentaux|a ?capp?ella|acoustic|acoustique|accoustique)\b`,
    // Réenregistrements et variantes : "2024 Version", "Re-Recorded", "Sped Up", "Take 4"…
    String.raw`\b(re ?record(ed)?|version revisited|rehearsal|outtake|sessions?|work tape|reloaded|rmx|dub|hippy|sound effects|sped up|slowed|alternative|alt|take \d+|(19|20)\d\d version|extended|dance version|hymnen|vocal version)\b`,
    // Autre langue que l'originale.
    String.raw`\b(spanglish|english version|spanish version|italian version|german version)\b`,
  ].join("|"),
);
/**
 * Mentions entre parenthèses qui désignent bien l'enregistrement original. Toute autre parenthèse
 * qui parle de "version", de "mix" ou d'"edit" ("MSG Version", "On Vacation Version", "Nick Raider Radio-Mix")
 * est une variante.
 */
const BENIGN_VERSION =
  /^((19|20)\d\d )?((digitally )?remaster(ed)?( \d{4})? )?(original )?((single|album|mono|stereo|radio|us|uk|45t|lp|bonus track|clean|explicit|video) )*(version|mix|edit)( (single|album|originale?|francaise|45t|\d{4}))*( remaster(ed)?)?$|^version (single|album|originale?|francaise|45t)( \d{4})?$/;

function altParenthetical(trackName: string): boolean {
  return [...trackName.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)].some((m) => {
    const inner = norm(m[1] ?? m[2] ?? "");
    return /\b(version|mix|edit)\b/.test(inner) && !BENIGN_VERSION.test(inner);
  });
}

/** Albums enregistrés hors studio : écartés d'après le nom de l'album seulement. */
const ALT_COLLECTION = /\b(radio|olympia|bobino|concert|hasselt)\b/;
/** "The Sound of Silence" doit correspondre à "Sound of Silence". */
const dropArticle = (s: string) => s.replace(/^the /, "");

/**
 * "Titre - Artiste | genre, genre [| itunes:123]" -> la requête (clé de cache), le titre, l'artiste, les
 * genres et, si la recherche tombe sur une mauvaise version, l'identifiant iTunes imposé.
 */
function parseSource(line: string): { query: string; title: string; artist: string; genres: GenreId[]; itunesId?: number } {
  const [query = "", tags = "", ...extra] = line.split(" | ").map((s) => s.trim());
  const pin = extra.find((e) => e.startsWith("itunes:"));
  const itunesId = pin ? Number(pin.slice("itunes:".length)) : undefined;
  if (pin && !Number.isInteger(itunesId)) throw new Error(`Identifiant iTunes invalide : ${line}`);
  const i = query.indexOf(" - ");
  if (i < 0) throw new Error(`Format invalide (attendu "Titre - Artiste | genres") : ${line}`);
  const genres = tags
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
  const unknown = genres.filter((g) => !isGenre(g));
  if (unknown.length > 0) throw new Error(`Genre inconnu (${unknown.join(", ")}) : ${line}`);
  if (genres.length === 0) throw new Error(`Aucun genre : ${line}`);
  return {
    query,
    title: query.slice(0, i).trim(),
    artist: query.slice(i + 3).trim(),
    genres: genres as GenreId[],
    ...(itunesId ? { itunesId } : {}),
  };
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
  // Une variante demandée explicitement ("(CYRIL Remix)") doit figurer dans le titre trouvé, sinon
  // l'original, plus ancien, l'emporterait.
  const wantedVariant = wantsAlt ? norm(title.match(/\(([^)]*)\)|\[([^\]]*)\]/)?.slice(1).find(Boolean) ?? "") : "";

  const accepted = results.filter((r) => {
    if (!r.previewUrl) return false;
    const gotTitle = dropArticle(norm(stripParens(r.trackName)));
    const gotArtist = norm(r.artistName);
    const titleOk = gotTitle === wantTitle || gotTitle.startsWith(`${wantTitle} `);
    const artistOk = wantArtists.some((a) => gotArtist.includes(a) || a.includes(gotArtist));
    if (!titleOk || !artistOk) return false;
    if (wantedVariant && !norm(r.trackName).includes(wantedVariant)) return false;
    if (!wantsAlt && ALT_VERSION.test(norm(`${r.trackName} ${r.collectionName ?? ""}`))) return false;
    if (!wantsAlt && ALT_COLLECTION.test(norm(r.collectionName ?? ""))) return false;
    if (!wantsAlt && altParenthetical(r.trackName)) return false;
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
  return fetchItunes(url, term);
}

/** Un titre précis, pour les lignes qui imposent leur identifiant (`| itunes:123`). */
async function lookup(id: number, store: string): Promise<ItunesResult | undefined> {
  const results = await fetchItunes(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=${store}`, `id ${id}`);
  return results.find((r) => r.trackId === id && r.previewUrl);
}

async function fetchItunes(url: string, term: string): Promise<ItunesResult[]> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      // Coupure réseau (ECONNRESET…) : on retente comme pour un 5xx.
      console.warn(`  ↻ ${(err as Error).message}, nouvel essai dans ${attempt * 30}s`);
      await sleep(attempt * 30_000);
      continue;
    }
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

/** Remplace origine et genres d'une entrée existante (et retire l'ancien champ `category`). */
function retag(track: CatalogTrack, origin: OriginId, genres: GenreId[]): CatalogTrack {
  const { category: _old, ...rest } = track as CatalogTrack & { category?: unknown };
  return { ...rest, origin, genres };
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  await mkdir(DATA_DIR, { recursive: true });

  const previous = await readJson<CatalogTrack[]>(CATALOG_PATH, []);
  const manual = new Map(previous.filter((t) => t.yearSource === "manual").map((t) => [t.query, t]));
  const done = new Map((refresh ? [] : previous).map((t) => [t.query, t]));
  const misses: CatalogMiss[] = [];
  const seen = new Set<string>();
  const queue: ({ origin: OriginId } & ReturnType<typeof parseSource>)[] = [];

  for (const origin of Object.keys(SOURCE_TRACKS) as OriginId[]) {
    for (const line of SOURCE_TRACKS[origin]) {
      const source = parseSource(line);
      const key = norm(source.query);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ origin, ...source });
    }
  }

  // Origine et genres viennent toujours de la liste source, y compris pour les titres en cache.
  for (const q of queue) {
    const cached = done.get(q.query);
    if (cached) done.set(q.query, retag(cached, q.origin, q.genres));
  }

  // Un identifiant imposé qui ne correspond pas au cache relance la recherche.
  const todo = queue.filter((q) => !done.has(q.query) || (q.itunesId && done.get(q.query)!.id !== q.itunesId));
  console.log(`${queue.length} titres uniques, ${queue.length - todo.length} déjà en cache, ${todo.length} à chercher.`);

  const save = async () => {
    const order = new Map(queue.map((q, i) => [q.query, i]));
    const tracks = [...done.values()]
      .filter((t) => order.has(t.query))
      .sort((a, b) => order.get(a.query)! - order.get(b.query)!);
    await writeFile(CATALOG_PATH, `${JSON.stringify(tracks, null, 2)}\n`);
    await writeFile(MISSES_PATH, `${JSON.stringify(misses, null, 2)}\n`);
  };

  for (const [i, { origin, genres, query: line, title, artist, itunesId }] of todo.entries()) {
    process.stdout.write(`[${i + 1}/${todo.length}] ${line} … `);
    // Boutique de l'origine d'abord, puis les autres si rien ne correspond.
    const stores = [...new Set([ORIGINS[origin].store, "US", "FR"])];
    let best: ItunesResult | undefined;
    let reason: string | undefined;
    for (const [n, store] of stores.entries()) {
      if (n > 0) await sleep(DELAY_MS);
      if (itunesId) {
        best = await lookup(itunesId, store);
        reason = best ? undefined : `identifiant iTunes ${itunesId} introuvable ou sans extrait`;
      } else {
        const picked = pickBest(await search(`${title} ${artist}`, store), title, artist);
        best = picked.best;
        reason = picked.reason;
      }
      if (best) break;
    }
    if (!best) {
      console.log(`✗ ${reason}`);
      misses.push({ query: line, origin, reason: reason ?? "inconnu" });
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
        origin,
        genres,
        previewUrl: best.previewUrl!,
        artworkUrl: largeArtwork(best.artworkUrl100 ?? ""),
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
