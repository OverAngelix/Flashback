import { describe, expect, it } from "vitest";
import { BAR_BEATS, chordAt, composeBar, eighth, PROGRESSION, seeded, SWING } from "./menuScore";

describe("grille", () => {
  it("boucle toutes les 8 mesures", () => {
    expect(PROGRESSION).toHaveLength(8);
    for (let i = 0; i < 8; i++) expect(chordAt(i + 8)).toBe(chordAt(i));
    expect(chordAt(-1)).toBe(chordAt(7));
  });
  it("place les croches avec un swing", () => {
    expect(eighth(0)).toBe(0);
    expect(eighth(1)).toBe(SWING);
    expect(eighth(2)).toBe(1);
    expect(eighth(7)).toBe(3 + SWING);
  });
});

describe("composeBar", () => {
  const bars = Array.from({ length: 24 }, (_, i) => ({ i, events: composeBar(i, seeded(i + 1)) }));

  it("est reproductible avec la même graine et varie avec une autre", () => {
    expect(composeBar(3, seeded(42))).toEqual(composeBar(3, seeded(42)));
    const many = new Set(Array.from({ length: 30 }, (_, s) => JSON.stringify(composeBar(3, seeded(s)))));
    expect(many.size).toBeGreaterThan(5);
  });

  it("garde chaque note dans la mesure, triées, avec des valeurs valides", () => {
    for (const { events } of bars) {
      expect(events.map((e) => e.beat)).toEqual([...events.map((e) => e.beat)].sort((a, b) => a - b));
      for (const e of events) {
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat).toBeLessThan(BAR_BEATS);
        expect(e.dur).toBeGreaterThan(0);
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("joue l'accord de la mesure au piano et sa fondamentale à la basse", () => {
    for (const { i, events } of bars) {
      const chord = chordAt(i);
      const keys = events.filter((e) => e.voice === "keys" && e.beat < 0.1).map((e) => e.midi);
      expect(keys.sort()).toEqual([...chord.keys].sort());
      const bass = events.filter((e) => e.voice === "bass");
      expect(bass[0]!.midi).toBe(chord.root);
      expect(bass[0]!.beat).toBe(0);
    }
  });

  it("garde les notes de basse dans le grave, la note d'approche à un demi-ton sous la fondamentale suivante", () => {
    for (const { i, events } of bars) {
      for (const e of events.filter((x) => x.voice === "bass")) {
        expect(e.midi!).toBeGreaterThanOrEqual(36);
        expect(e.midi!).toBeLessThanOrEqual(62);
      }
      const approach = events.find((e) => e.voice === "bass" && e.beat > 3);
      if (approach) expect(approach.midi).toBe(chordAt(i + 1).root - 1);
    }
  });

  it("limite et borne le vibraphone, sans répéter une note d'affilée", () => {
    for (const { events } of bars) {
      const bells = events.filter((e) => e.voice === "bell");
      expect(bells.length).toBeLessThanOrEqual(4);
      for (const b of bells) {
        expect(b.midi!).toBeGreaterThanOrEqual(72);
        expect(b.midi!).toBeLessThanOrEqual(88);
      }
      for (let k = 1; k < bells.length; k++) expect(bells[k]!.midi).not.toBe(bells[k - 1]!.midi);
    }
  });

  it("garde la rythmique : 8 croches de shaker et deux coups de balais par mesure", () => {
    for (const { events } of bars) {
      expect(events.filter((e) => e.voice === "hat")).toHaveLength(8);
      expect(events.filter((e) => e.voice === "brush").map((e) => e.beat)).toEqual([1, 3]);
    }
  });

  it("laisse du silence dans les mélodies : toutes les mesures n'ont pas la même densité", () => {
    const counts = new Set(bars.map(({ events }) => events.filter((e) => e.voice === "bell").length));
    expect(counts.size).toBeGreaterThan(1);
  });
});
