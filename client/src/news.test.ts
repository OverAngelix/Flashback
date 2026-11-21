import { describe, expect, it } from "vitest";
import { compareVersions, markSeen, newsFor, RELEASES, seenVersion, type Release } from "./news";

const releases: Release[] = [
  {
    version: "1.0",
    items: [
      { id: "catalog", icon: "mdi-music", title: "Plus de 1 200 musiques", text: "Des tubes." },
      { id: "solo", icon: "mdi-account", title: "Mode solo", text: "Campagne." },
    ],
  },
  {
    version: "1.1",
    items: [
      { id: "catalog", icon: "mdi-music", title: "Plus de 1 500 musiques", text: "Des tubes.", updateTitle: "300 musiques en plus", update: "Du rap." },
      { id: "dark", icon: "mdi-moon", title: "Mode nuit", text: "Pour les yeux." },
    ],
  },
];

describe("compareVersions", () => {
  it("compare nombre par nombre", () => {
    expect(compareVersions("1.10", "1.9")).toBe(1);
    expect(compareVersions("1.0", "1")).toBe(0);
    expect(compareVersions("1.1", "2.0")).toBe(-1);
  });
});

describe("newsFor", () => {
  it("présente tout à un nouveau venu, avec la formulation la plus récente", () => {
    const news = newsFor(null, releases);
    expect(news?.welcome).toBe(true);
    expect(news?.version).toBe("1.1");
    expect(news?.sections).toHaveLength(1);
    expect(news?.sections[0]?.items.map((i) => i.title)).toEqual(["Plus de 1 500 musiques", "Mode solo", "Mode nuit"]);
  });
  it("ne montre que les nouveautés à qui a vu une version précédente", () => {
    const news = newsFor("1.0", releases);
    expect(news?.welcome).toBe(false);
    expect(news?.sections.map((s) => s.version)).toEqual(["1.1"]);
    expect(news?.sections[0]?.items).toEqual([
      { icon: "mdi-music", title: "300 musiques en plus", text: "Du rap." },
      { icon: "mdi-moon", title: "Mode nuit", text: "Pour les yeux." },
    ]);
  });
  it("liste les versions manquées, la plus récente d'abord", () => {
    const more = [...releases, { version: "1.2", items: [{ id: "x", icon: "mdi-x", title: "X", text: "x" }] }];
    expect(newsFor("1.0", more)?.sections.map((s) => s.version)).toEqual(["1.2", "1.1"]);
  });
  it("ne montre rien quand la dernière version est déjà vue", () => {
    expect(newsFor("1.1", releases)).toBeNull();
    expect(newsFor("1.1.0", releases)).toBeNull();
    expect(newsFor("9.0", releases)).toBeNull();
    expect(newsFor(null, [])).toBeNull();
  });
  it("traite une valeur illisible comme un nouveau venu", () => {
    expect(newsFor("n'importe quoi", releases)?.welcome).toBe(true);
  });
  it("les versions publiées sont valides, croissantes, et les id uniques dans une version", () => {
    for (let i = 0; i < RELEASES.length; i++) {
      const r = RELEASES[i]!;
      expect(r.version).toMatch(/^\d+(\.\d+)*$/);
      if (i > 0) expect(compareVersions(r.version, RELEASES[i - 1]!.version)).toBe(1);
      const ids = r.items.map((it) => it.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("seenVersion / markSeen", () => {
  it("mémorise la version vue", () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(seenVersion(store)).toBeNull();
    markSeen("1.0", store);
    expect(seenVersion(store)).toBe("1.0");
  });
  it("ne lève jamais d'exception si le stockage est refusé", () => {
    const store = {
      getItem: () => {
        throw new Error("refusé");
      },
      setItem: () => {
        throw new Error("refusé");
      },
    };
    expect(seenVersion(store)).toBeNull();
    expect(() => markSeen("1.0", store)).not.toThrow();
    expect(seenVersion(null)).toBeNull();
  });
});
