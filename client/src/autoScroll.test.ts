import { describe, expect, it } from "vitest";
import { autoScrollStart, stepAutoScroll, type AutoScrollOptions } from "./autoScroll";

const opts: AutoScrollOptions = { speed: 100, returnSpeed: 1000, hold: 2000 };

/** Avance par images de 100 ms et note chaque position. */
function run(ms: number, max: number) {
  let s = autoScrollStart(opts);
  const trace = [s];
  for (let t = 0; t < ms; t += 100) trace.push((s = stepAutoScroll(s, 100, max, opts)));
  return trace;
}

describe("stepAutoScroll", () => {
  it("attend en haut, descend à vitesse constante, attend en bas puis remonte vite", () => {
    const trace = run(10_000, 300);
    // 2 s de pause en haut.
    expect(trace[20]!.pos).toBe(0);
    // 100 px/s : 300 px en 3 s, puis 2 s de pause en bas.
    expect(trace[30]!.pos).toBeCloseTo(100);
    expect(trace[51]).toMatchObject({ phase: "hold-bottom", pos: 300 });
    expect(trace[70]!.pos).toBe(300);
    // Remontée à 1000 px/s : en haut 0,3 s plus tard, nouvelle pause.
    expect(trace[75]).toMatchObject({ phase: "hold-top", pos: 0 });
    expect(trace.every((s) => s.pos >= 0 && s.pos <= 300)).toBe(true);
  });

  it("ne bouge pas quand tout tient à l'écran", () => {
    expect(run(10_000, 0).every((s) => s.pos === 0 && s.phase === "hold-top")).toBe(true);
  });

  it("reprend depuis la position donnée (défilement à la main) et suit une liste qui rétrécit", () => {
    expect(stepAutoScroll({ phase: "down", pos: 120, wait: 0 }, 100, 300, opts).pos).toBeCloseTo(130);
    expect(stepAutoScroll({ phase: "down", pos: 500, wait: 0 }, 100, 300, opts)).toMatchObject({ phase: "hold-bottom", pos: 300 });
  });
});
