/**
 * Recoupe les années de server/data/catalog.json avec MusicBrainz (première sortie connue
 * d'un enregistrement) et écrit server/data/year-report.json.
 *
 * Usage : npm run catalog:verify
 * Seuls les statuts "earlier" demandent une vérification ; pour corriger une année, éditer
 * year dans catalog.json et mettre yearSource à "manual".
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogTrack } from "../catalog/types.js";

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const CATALOG_PATH = resolve(DATA_DIR, "catalog.json");
const REPORT_PATH = resolve(DATA_DIR, "year-report.json");

/** MusicBrainz tolère 1 requête par seconde. */
const DELAY_MS = 1100;
const USER_AGENT = "FlashbackGame/0.1 (projet personnel)";

interface MbRecording {
  title: string;
  score: number;
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
}

export interface YearReportEntry {
  query: string;
  year: number;
  yearSource: CatalogTrack["yearSource"];
  itunesYear: number;
  mbYear: number | null;
  /**
   * ok : MusicBrainz confirme. earlier : MusicBrainz connaît une sortie plus ancienne, à vérifier.
   * later : MusicBrainz ne connaît que des enregistrements plus récents (remaster, autre version),
   * sans valeur de preuve. no-data : introuvable ou service indisponible.
   */
  status: "ok" | "earlier" | "later" | "no-data";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const baseTitle = (s: string) => norm(s.replace(/\([^)]*\)|\[[^\]]*\]/g, " ")).replace(/^the /, "");

async function firstReleaseYear(track: CatalogTrack): Promise<number | null> {
  const firstArtist = track.artist.split(/,|&|\bft\.?\b|\bfeat\.?\b/i)[0]!.trim();
  const title = track.title.replace(/\([^)]*\)/g, "").trim();
  const query = `recording:"${title.replace(/"/g, "")}" AND artist:"${firstArtist.replace(/"/g, "")}"`;
  const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=25`;

  let res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  for (let attempt = 1; attempt <= 4 && (res.status === 503 || res.status === 429); attempt++) {
    await sleep(attempt * 4000);
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  }
  if (!res.ok) throw new Error(`MusicBrainz ${res.status} pour "${track.query}"`);
  const { recordings } = (await res.json()) as { recordings: MbRecording[] };

  const wantTitle = baseTitle(track.title);
  const wantArtist = norm(firstArtist);
  const years = recordings
    .filter((r) => r.score >= 85 && baseTitle(r.title) === wantTitle)
    .filter((r) => (r["artist-credit"] ?? []).some((a) => norm(a.name).includes(wantArtist) || wantArtist.includes(norm(a.name))))
    .map((r) => Number(r["first-release-date"]?.slice(0, 4)))
    .filter((y) => Number.isFinite(y) && y > 1900);
  return years.length ? Math.min(...years) : null;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as CatalogTrack[];
  const report: YearReportEntry[] = [];

  for (const [i, t] of catalog.entries()) {
    process.stdout.write(`[${i + 1}/${catalog.length}] ${t.query} … `);
    let mbYear: number | null = null;
    try {
      mbYear = await firstReleaseYear(t);
    } catch (err) {
      console.log(`erreur (${(err as Error).message})`);
      await sleep(DELAY_MS * 5);
      continue;
    }
    const status =
      mbYear === null ? "no-data" : mbYear === t.year ? "ok" : mbYear < t.year ? "earlier" : "later";
    report.push({
      query: t.query,
      year: t.year,
      yearSource: t.yearSource,
      itunesYear: Number(t.releaseDate.slice(0, 4)),
      mbYear,
      status,
    });
    console.log(status === "earlier" ? `À VÉRIFIER : retenu ${t.year}, MusicBrainz ${mbYear}` : status);
    await sleep(DELAY_MS);
  }

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  const count = (s: YearReportEntry["status"]) => report.filter((r) => r.status === s).length;
  console.log(
    `\n${count("ok")} confirmées, ${count("earlier")} à vérifier, ${count("later")} non concluantes, ${count("no-data")} sans donnée (voir year-report.json).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
