import { effectScope } from "vue";
import { describe, expect, it } from "vitest";
import { createProgress, isUnlocked, parseProgress, recordScore, recordStars, selectionKey, starsFor } from "./soloProgress";

const levels = [
  { id: "a", title: "A", description: "", categories: [], goal: 5 },
  { id: "b", title: "B", description: "", categories: [], goal: 5 },
  { id: "c", title: "C", description: "", categories: [], goal: 6 },
];

describe("progression solo", () => {
  it("relit une progression en ignorant les entrées invalides", () => {
    const empty = { stars: {}, records: {}, lastScore: null };
    expect(parseProgress(null)).toEqual(empty);
    expect(parseProgress("pas du json")).toEqual(empty);
    expect(parseProgress(JSON.stringify({ stars: { a: 2, b: 4, c: 0, d: "3", e: 1.5 }, records: { all: 12, fr: -1 }, lastScore: 5 }))).toEqual({
      stars: { a: 2 },
      records: { all: 12 },
      lastScore: 5,
    });
    expect(parseProgress(JSON.stringify({ stars: [3], records: "x", lastScore: "4" }))).toEqual(empty);
  });

  it("donne une étoile par vie restante, aucune pour un niveau raté", () => {
    expect(starsFor(true, 3)).toBe(3);
    expect(starsFor(true, 1)).toBe(1);
    expect(starsFor(false, 2)).toBe(0);
  });

  it("ouvre chaque niveau quand le précédent est réussi", () => {
    expect(isUnlocked(0, {}, levels)).toBe(true);
    expect(isUnlocked(1, {}, levels)).toBe(false);
    expect(isUnlocked(1, { a: 1 }, levels)).toBe(true);
    expect(isUnlocked(2, { a: 3 }, levels)).toBe(false);
  });

  it("ne garde que la meilleure note et le meilleur record", () => {
    const p = parseProgress(null);
    expect(recordStars(p, "a", 2)).toBe(true);
    expect(recordStars(p, "a", 1)).toBe(false);
    expect(recordStars(p, "a", 0)).toBe(false);
    expect(p.stars).toEqual({ a: 2 });
    expect(recordScore(p, "all", 7)).toBeUndefined();
    expect(recordScore(p, "all", 5)).toBe(7);
    expect(recordScore(p, "all", 9)).toBe(7);
    expect(p.records.all).toBe(9);
    recordScore(p, "all", 3);
    expect(p.lastScore).toBe(3);
    expect(p.records.all).toBe(9);
  });

  it("range les records par sélection, sans dépendre de l'ordre des catégories", () => {
    expect(selectionKey([])).toBe("all");
    expect(selectionKey(["rock", "fr"])).toBe(selectionKey(["fr", "rock"]));
  });

  it("continue d'enregistrer après la disparition de l'écran qui l'a créée", () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
    // Comme un composant : la progression est créée dans sa portée, puis le composant disparaît.
    const screen = effectScope();
    const p = screen.run(() => createProgress(storage))!;
    screen.stop();
    recordStars(p, "a", 2);
    recordScore(p, "all", 6);
    expect(createProgress(storage)).toMatchObject({ stars: { a: 2 }, records: { all: 6 }, lastScore: 6 });
  });

  it("enregistre chaque modification et survit à un stockage indisponible", () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
    const p = createProgress(storage);
    recordStars(p, "a", 3);
    expect(parseProgress(saved.get("flashback.solo") ?? null).stars).toEqual({ a: 3 });
    expect(createProgress(storage).stars).toEqual({ a: 3 });

    const broken = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    const q = createProgress(broken);
    expect(() => recordScore(q, "all", 4)).not.toThrow();
    expect(q.records.all).toBe(4);
  });
});
