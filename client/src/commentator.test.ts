import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GameView, PlayerView, PublicCard } from "@server/net/protocol";
import { LINES, lineUrl, pickLine, situationFor, yearsOff, type Situation } from "./commentator";

const card = (year: number): PublicCard => ({ id: year, title: "T", artist: "A", year, imageUrl: "" });
const player = (id: string, years: number[]): PlayerView => ({ id, name: id, avatar: 0, connected: true, timeline: years.map(card), groove: 0 });

function view(patch: Partial<GameView>): GameView {
  return {
    code: "ABCDEF",
    phase: "lobby",
    round: 0,
    cardsToWin: 5,
    commentator: true,
    categories: [],
    availableCategories: [],
    trackCount: 100,
    players: [player("a", [1980]), player("b", [1990])],
    leaderId: "a",
    activePlayerId: null,
    current: null,
    listened: false,
    extract: null,
    grooveGuessIds: [],
    solo: null,
    lastResult: null,
    winnerIds: [],
    ...patch,
  };
}

/** Révélation d'un placement d'Ana, frise [1970, 1990] avant le placement. */
function reveal(year: number, position: number, correct: boolean, grooveOk = false): GameView {
  const timeline = correct ? [1970, year, 1990].sort((x, y) => x - y) : [1970, 1990];
  return view({
    phase: "reveal",
    round: 1,
    activePlayerId: "a",
    players: [player("a", timeline), player("b", [2000])],
    lastResult: { playerId: "a", position, correct, track: card(year), groove: [{ playerId: "b", position: 1, correct: grooveOk }] },
  });
}
const placing = view({ phase: "awaiting-placement", round: 1, activePlayerId: "a" });

describe("situationFor", () => {
  it("se tait au premier état reçu et tant que rien ne change", () => {
    expect(situationFor(null, placing)).toBeNull();
    expect(situationFor(placing, { ...placing, grooveGuessIds: ["b"] })).toBeNull();
    const r = reveal(1980, 1, true);
    expect(situationFor(r, r)).toBeNull();
  });
  it("annonce le lancement, depuis le salon seulement", () => {
    expect(situationFor(view({}), placing)).toBe("start");
    expect(situationFor(reveal(1980, 1, true), view({ phase: "awaiting-placement", round: 1, activePlayerId: "b" }))).toBeNull();
  });
  it("commente la révélation selon le placement", () => {
    expect(situationFor(placing, reveal(1980, 1, true))).toBe("correct");
    expect(situationFor(placing, reveal(1968, 1, false))).toBe("close"); // 2 ans avant 1970
    expect(situationFor(placing, reveal(1968, 1, false, true))).toBe("close");
    expect(situationFor(placing, reveal(1960, 1, false, true))).toBe("stolen");
    expect(situationFor(placing, reveal(1950, 1, false))).toBe("far"); // 20 ans
    expect(situationFor(placing, reveal(1960, 1, false))).toBe("wrong");
    expect(situationFor(placing, reveal(2015, 0, false))).toBe("far"); // avant 1970 alors que c'est 2015
  });
  it("ne dit rien d'un tour passé ni en solo", () => {
    const skipped = reveal(1960, 1, false);
    skipped.lastResult!.position = -1;
    expect(situationFor(placing, skipped)).toBeNull();
    const solo = { ...reveal(1980, 1, true), solo: { maxLives: 3, lives: 3, goal: null, level: null } };
    expect(situationFor(placing, solo)).toBeNull();
  });
  it("distingue récapitulatif, égalité en tête à l'objectif et victoire", () => {
    const r = reveal(1980, 1, true);
    expect(situationFor(r, view({ phase: "round-recap", round: 2 }))).toBe("recap");
    const five = [1, 2, 3, 4, 5].map((i) => 1990 + i);
    expect(situationFor(r, view({ phase: "round-recap", round: 2, players: [player("a", five), player("b", five)] }))).toBe("tie");
    expect(situationFor(r, view({ phase: "round-recap", round: 2, players: [player("a", [1, 2, 3, 4].map((i) => 1990 + i)), player("b", [1991, 1992, 1993, 1994])] }))).toBe("recap");
    expect(situationFor(r, view({ phase: "finished", round: 2, winnerIds: ["a"] }))).toBe("victory");
    expect(situationFor(r, view({ phase: "finished", round: 2, winnerIds: [] }))).toBeNull();
  });
});

describe("yearsOff", () => {
  it("mesure l'écart avec le voisin qui contredit le placement", () => {
    expect(yearsOff(reveal(1965, 1, false))).toBe(5);
    expect(yearsOff(reveal(1995, 1, false))).toBe(5);
    expect(yearsOff(reveal(1980, 1, true))).toBe(0);
  });
});

describe("pickLine", () => {
  it("ne répète jamais la phrase précédente", () => {
    const first = LINES.correct[0]!;
    for (const x of [0, 0.3, 0.6, 0.99]) expect(pickLine("correct", first.id, () => x)?.id).not.toBe(first.id);
  });
});

describe("banque de phrases", () => {
  it("a des identifiants uniques et un fichier audio pour chaque phrase", () => {
    const all = Object.values(LINES).flat();
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const situation of Object.keys(LINES) as Situation[]) expect(LINES[situation].length).toBeGreaterThan(0);
    const missing = all.filter((l) => !existsSync(new URL(`../public${lineUrl(l)}`, import.meta.url)));
    expect(missing.map((l) => l.id), "lancer npm run commentator:build").toEqual([]);
  });
});
