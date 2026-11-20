import { describe, expect, it } from "vitest";
import { copyText } from "./clipboard";

describe("copyText", () => {
  it("utilise le presse-papiers du navigateur quand il existe", async () => {
    let copied = "";
    const ok = await copyText("lien", { clipboard: { writeText: async (t) => void (copied = t) }, legacyCopy: () => false });
    expect(ok).toBe(true);
    expect(copied).toBe("lien");
  });
  it("passe par la copie à l'ancienne sans presse-papiers (page en http) ou s'il refuse", async () => {
    let legacy = "";
    const legacyCopy = (t: string) => ((legacy = t), true);
    expect(await copyText("a", { legacyCopy })).toBe(true);
    expect(legacy).toBe("a");
    const refused = { writeText: async () => Promise.reject(new Error("refusé")) };
    expect(await copyText("b", { clipboard: refused, legacyCopy })).toBe(true);
    expect(legacy).toBe("b");
  });
  it("renvoie false quand rien ne marche", async () => {
    expect(await copyText("x", {})).toBe(false);
    expect(await copyText("x", { legacyCopy: () => { throw new Error("non"); } })).toBe(false);
  });
});
