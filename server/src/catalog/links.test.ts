import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyLinks, watchLinks } from "./links.js";
import { Catalog, type CatalogEntry } from "./store.js";

const entry = (id: number, category: CatalogEntry["category"] = "fr"): CatalogEntry => ({
  id,
  title: `Titre ${id}`,
  artist: "Artiste",
  year: 1970 + id,
  previewUrl: `https://audio.test/${id}.m4a`,
  artworkUrl: `https://img.test/${id}/600x600bb.jpg`,
  category,
});

interface FakeApple {
  /** Statut HEAD par adresse (200 si absente). */
  head?: Record<string, number | "error">;
  /** Réponse de l'API lookup par boutique puis identifiant. */
  lookup?: Record<string, Record<number, { previewUrl: string; artworkUrl100: string } | undefined>>;
  lookupStatus?: number;
}

function fakeFetch(apple: FakeApple) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.startsWith("https://itunes.apple.com/lookup")) {
      if (apple.lookupStatus) return new Response("", { status: apple.lookupStatus });
      const { searchParams } = new URL(url);
      const id = Number(searchParams.get("id"));
      const hit = apple.lookup?.[searchParams.get("country")!]?.[id];
      return Response.json({ resultCount: hit ? 1 : 0, results: hit ? [{ trackId: id, ...hit }] : [] });
    }
    const status = apple.head?.[url] ?? 200;
    if (status === "error") throw new TypeError("fetch failed");
    return new Response(null, { status });
  }) as typeof fetch;
  return { fetcher, calls };
}

const run = (entries: CatalogEntry[], apple: FakeApple) => {
  const { fetcher, calls } = fakeFetch(apple);
  return verifyLinks(entries, { fetch: fetcher, sleep: async () => {} }).then((report) => ({ report, calls }));
};

describe("vérification des liens Apple", () => {
  it("ne change rien quand tout répond, sans appeler l'API lookup", async () => {
    const tracks = [entry(1), entry(2)];
    const { report, calls } = await run(tracks, {});
    assert.equal(report.checked, 2);
    assert.deepEqual([report.refreshed, report.removed, report.restored, report.inconclusive], [[], [], [], []]);
    assert.ok(calls.every((c) => c.startsWith("HEAD ")));
    assert.equal(tracks[0]!.previewUrl, "https://audio.test/1.m4a");
  });

  it("renouvelle un extrait mort avec l'adresse que donne l'API lookup", async () => {
    const tracks = [entry(1)];
    const { report } = await run(tracks, {
      head: { "https://audio.test/1.m4a": 403 },
      lookup: { FR: { 1: { previewUrl: "https://audio.test/1-new.m4a", artworkUrl100: "https://img.test/1/100x100bb.jpg" } } },
    });
    assert.deepEqual(report.refreshed, ["Titre 1 - Artiste"]);
    assert.equal(tracks[0]!.previewUrl, "https://audio.test/1-new.m4a");
    assert.equal(tracks[0]!.artworkUrl, "https://img.test/1/600x600bb.jpg");
    assert.equal(tracks[0]!.unavailable, undefined);
  });

  it("cherche dans les autres boutiques si celle de la catégorie ne connaît plus le titre", async () => {
    const tracks = [entry(1, "fr")];
    const { report, calls } = await run(tracks, {
      head: { "https://img.test/1/600x600bb.jpg": 404 },
      lookup: { US: { 1: { previewUrl: "https://audio.test/1.m4a", artworkUrl100: "https://img.test/1b/100x100bb.jpg" } } },
    });
    assert.deepEqual(report.refreshed, ["Titre 1 - Artiste"]);
    assert.deepEqual(
      calls.filter((c) => c.includes("lookup")).map((c) => new URL(c.slice(4)).searchParams.get("country")),
      ["FR", "US"],
    );
    assert.equal(tracks[0]!.artworkUrl, "https://img.test/1b/600x600bb.jpg");
  });

  it("retire un titre qu'Apple ne fournit plus, puis le rétablit quand il revient", async () => {
    const tracks = [entry(1), entry(2)];
    const catalog = new Catalog(tracks);
    const dead = { head: { "https://audio.test/1.m4a": 404 } };
    const first = await run(tracks, dead);
    assert.deepEqual(first.report.removed, ["Titre 1 - Artiste"]);
    assert.deepEqual(catalog.select(["fr"]).map((t) => t.id), [2]);

    // Toujours mort le lendemain : il n'est pas signalé une seconde fois.
    assert.deepEqual((await run(tracks, dead)).report.removed, []);

    const back = await run(tracks, {});
    assert.deepEqual(back.report.restored, ["Titre 1 - Artiste"]);
    assert.deepEqual(catalog.select(["fr"]).map((t) => t.id), [1, 2]);
  });

  it("retire un titre si la nouvelle adresse est morte elle aussi", async () => {
    const tracks = [entry(1)];
    const { report } = await run(tracks, {
      head: { "https://audio.test/1.m4a": 404 },
      lookup: { FR: { 1: { previewUrl: "https://audio.test/1.m4a", artworkUrl100: "https://img.test/1/100x100bb.jpg" } } },
    });
    assert.deepEqual(report.removed, ["Titre 1 - Artiste"]);
    assert.equal(tracks[0]!.unavailable, true);
  });

  it("ne conclut rien quand Apple est en panne ou injoignable", async () => {
    const tracks = [entry(1), entry(2), entry(3)];
    const { report } = await run(tracks, {
      head: { "https://audio.test/1.m4a": 503, "https://audio.test/2.m4a": "error", "https://audio.test/3.m4a": 404 },
      lookupStatus: 429,
    });
    assert.deepEqual(report.inconclusive, ["Titre 1 - Artiste", "Titre 2 - Artiste", "Titre 3 - Artiste"]);
    assert.ok(tracks.every((t) => !t.unavailable));
    assert.equal(tracks[2]!.previewUrl, "https://audio.test/3.m4a");
  });

  it("vérifie au démarrage, note l'heure et ne lance pas deux vérifications à la fois", async () => {
    const catalog = new Catalog([entry(1)]);
    const { fetcher, calls } = fakeFetch({});
    const logs: string[] = [];
    const watch = watchLinks(catalog, { fetch: fetcher, sleep: async () => {}, log: (m) => logs.push(m) });
    await watch.run(); // déjà en cours : ne relance rien
    watch.stop();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 2);
    assert.match(watch.state.lastCheckAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.match(logs[0]!, /1 titres, 0 renouvelés/);
  });
});
