/**
 * Vérification des liens Apple du catalogue. Les extraits et pochettes sont lus directement chez
 * Apple, qui change parfois leurs adresses : chaque titre est contrôlé (requête HEAD), et un lien
 * mort est renouvelé via l'API lookup d'iTunes à partir de l'identifiant du titre. Si Apple ne
 * fournit plus rien, le titre est mis de côté (`unavailable`) jusqu'à la vérification suivante.
 */
import type { Catalog, CatalogEntry } from "./store.js";
import { CATEGORIES } from "./types.js";

export const LINK_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Pochette en 600x600 à partir de celle en 100x100 renvoyée par l'API iTunes. */
export const largeArtwork = (artworkUrl100: string) => artworkUrl100.replace("100x100bb", "600x600bb");

export interface LinkCheckOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Pause entre deux titres (CDN d'Apple, sans limite connue). */
  checkDelayMs?: number;
  /** Pause avant chaque requête lookup : l'API iTunes tolère environ 20 requêtes par minute. */
  lookupDelayMs?: number;
  timeoutMs?: number;
}

export interface LinkReport {
  checked: number;
  /** Liens morts remplacés par ceux que donne l'API lookup. */
  refreshed: string[];
  /** Titres devenus injouables : plus d'extrait ni de pochette valides chez Apple. */
  removed: string[];
  /** Titres de nouveau jouables. */
  restored: string[];
  /** Titres pour lesquels Apple n'a pas répondu clairement (panne, limite) : laissés en l'état. */
  inconclusive: string[];
}

type LinkStatus = "ok" | "dead" | "unknown";

const label = (t: CatalogEntry) => `${t.title} - ${t.artist}`;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function checkLink(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<LinkStatus> {
  try {
    const res = await fetcher(url, { method: "HEAD", signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) return "ok";
    // 429 et 5xx : Apple est en difficulté, cela ne dit rien du lien.
    return res.status === 429 || res.status >= 500 ? "unknown" : "dead";
  } catch {
    return "unknown";
  }
}

/**
 * Adresses actuelles d'un titre d'après l'API lookup, en essayant la boutique de sa catégorie puis
 * les autres. `null` : Apple ne connaît plus le titre ou n'en donne plus d'extrait. `undefined` :
 * pas de réponse exploitable.
 */
async function lookupLinks(
  entry: CatalogEntry,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<{ previewUrl: string; artworkUrl: string } | null | undefined> {
  const stores = [...new Set([CATEGORIES[entry.category].store, "US", "FR"])];
  for (const store of stores) {
    try {
      const res = await fetcher(`https://itunes.apple.com/lookup?id=${entry.id}&country=${store}&entity=song`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return undefined;
      const { results } = (await res.json()) as { results?: { trackId?: number; previewUrl?: string; artworkUrl100?: string }[] };
      const hit = results?.find((r) => r.trackId === entry.id && r.previewUrl && r.artworkUrl100);
      if (hit) return { previewUrl: hit.previewUrl!, artworkUrl: largeArtwork(hit.artworkUrl100!) };
    } catch {
      return undefined;
    }
  }
  return null;
}

/** Vérifie les liens de chaque titre et met les entrées à jour en place. */
export async function verifyLinks(entries: CatalogEntry[], options: LinkCheckOptions = {}): Promise<LinkReport> {
  const fetcher = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const checkDelayMs = options.checkDelayMs ?? 100;
  const lookupDelayMs = options.lookupDelayMs ?? 3200;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const report: LinkReport = { checked: 0, refreshed: [], removed: [], restored: [], inconclusive: [] };

  const markUnavailable = (t: CatalogEntry) => {
    if (!t.unavailable) report.removed.push(label(t));
    t.unavailable = true;
  };
  const markAvailable = (t: CatalogEntry) => {
    if (t.unavailable) report.restored.push(label(t));
    delete t.unavailable;
  };

  for (const [i, t] of entries.entries()) {
    if (i > 0) await sleep(checkDelayMs);
    report.checked++;
    const statuses = [await checkLink(t.previewUrl, fetcher, timeoutMs), await checkLink(t.artworkUrl, fetcher, timeoutMs)];
    if (statuses.every((s) => s === "ok")) {
      markAvailable(t);
      continue;
    }
    if (!statuses.includes("dead")) {
      report.inconclusive.push(label(t));
      continue;
    }

    await sleep(lookupDelayMs);
    const fresh = await lookupLinks(t, fetcher, timeoutMs);
    if (fresh === undefined) {
      report.inconclusive.push(label(t));
      continue;
    }
    if (fresh === null) {
      markUnavailable(t);
      continue;
    }
    const freshStatuses = [await checkLink(fresh.previewUrl, fetcher, timeoutMs), await checkLink(fresh.artworkUrl, fetcher, timeoutMs)];
    if (freshStatuses.every((s) => s === "ok")) {
      t.previewUrl = fresh.previewUrl;
      t.artworkUrl = fresh.artworkUrl;
      report.refreshed.push(label(t));
      markAvailable(t);
    } else if (freshStatuses.includes("dead")) {
      markUnavailable(t);
    } else {
      report.inconclusive.push(label(t));
    }
  }
  return report;
}

export interface LinkWatchState {
  /** Fin de la dernière vérification complète (ISO 8601). */
  lastCheckAt: string | null;
  running: boolean;
}

/**
 * Lance une vérification tout de suite, puis toutes les 24 heures. Les corrections restent en
 * mémoire : catalog.json est dans l'image et n'est pas réécrit (voir `npm run catalog:check`).
 */
export function watchLinks(
  catalog: Catalog,
  { intervalMs = LINK_CHECK_INTERVAL_MS, log = console.log, ...options }: LinkCheckOptions & { intervalMs?: number; log?: (msg: string) => void } = {},
): { state: LinkWatchState; run: () => Promise<void>; stop: () => void } {
  const state: LinkWatchState = { lastCheckAt: null, running: false };

  const run = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const r = await verifyLinks(catalog.tracks, options);
      state.lastCheckAt = new Date().toISOString();
      log(
        `Liens Apple vérifiés : ${r.checked} titres, ${r.refreshed.length} renouvelés, ${r.removed.length} retirés, ` +
          `${r.restored.length} rétablis, ${r.inconclusive.length} sans réponse claire. ${catalog.available.length} titres jouables.`,
      );
      for (const [what, list] of [["renouvelé", r.refreshed], ["retiré", r.removed], ["rétabli", r.restored]] as const) {
        for (const t of list) log(`  ${what} : ${t}`);
      }
    } catch (err) {
      log(`Vérification des liens Apple interrompue : ${(err as Error).message}`);
    } finally {
      state.running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return { state, run, stop: () => clearInterval(timer) };
}
