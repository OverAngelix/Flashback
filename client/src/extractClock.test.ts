import { describe, expect, it } from "vitest";
import { DEFAULT_EXTRACT_SECONDS, extractClock, formatSeconds } from "./extractClock";

describe("extractClock", () => {
  it("compte les secondes restantes, arrondies au-dessus", () => {
    expect(extractClock(0, 30)).toEqual({ progress: 0, remaining: 30 });
    expect(extractClock(0.2, 30).remaining).toBe(30);
    expect(extractClock(1, 30).remaining).toBe(29);
    expect(extractClock(29.5, 30).remaining).toBe(1);
    expect(extractClock(30, 30)).toEqual({ progress: 1, remaining: 0 });
  });

  it("suppose 30 s tant que la durée est inconnue", () => {
    for (const d of [NaN, Infinity, 0]) expect(extractClock(15, d)).toEqual({ progress: 15 / DEFAULT_EXTRACT_SECONDS, remaining: 15 });
  });

  it("borne la position", () => {
    expect(extractClock(-3, 29.9).progress).toBe(0);
    expect(extractClock(40, 29.9)).toEqual({ progress: 1, remaining: 0 });
    expect(extractClock(NaN, 30).remaining).toBe(30);
  });
});

describe("formatSeconds", () => {
  it("écrit minutes et secondes", () => {
    expect(formatSeconds(30)).toBe("0:30");
    expect(formatSeconds(7)).toBe("0:07");
    expect(formatSeconds(75)).toBe("1:15");
    expect(formatSeconds(-2)).toBe("0:00");
  });
});
