import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH } from "@server/game/types";
import { createSettings, DEFAULT_SETTINGS, parseSettings } from "./settings";

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [["flashback.settings", initial]] : []);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    raw: () => data.get("flashback.settings"),
  };
}

describe("parseSettings", () => {
  it("renvoie les valeurs par défaut sans rien de mémorisé ou avec un contenu illisible", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{pas du json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1,2]")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
  });
  it("garde les valeurs valides", () => {
    expect(parseSettings('{"volume":0.4,"music":false,"musicVolume":0.2,"reducedMotion":true,"splash":false,"playerName":"Zoé"}')).toEqual({
      volume: 0.4,
      music: false,
      musicVolume: 0.2,
      reducedMotion: true,
      splash: false,
      playerName: "Zoé",
    });
  });
  it("borne le volume et écarte les types invalides champ par champ", () => {
    expect(parseSettings('{"volume":7}').volume).toBe(1);
    expect(parseSettings('{"volume":-3}').volume).toBe(0);
    expect(parseSettings('{"musicVolume":9}').musicVolume).toBe(1);
    expect(parseSettings('{"volume":"fort","music":"oui","musicVolume":null,"reducedMotion":"oui","splash":1,"playerName":42}')).toEqual(DEFAULT_SETTINGS);
  });
  it("tronque et nettoie le nom", () => {
    expect(parseSettings(`{"playerName":"  ${"x".repeat(40)}  "}`).playerName).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("createSettings", () => {
  it("relit ce qui est mémorisé et enregistre chaque modification", () => {
    const storage = memoryStorage('{"volume":0.5}');
    const settings = createSettings(storage);
    expect(settings.volume).toBe(0.5);
    settings.playerName = "Zoé";
    settings.reducedMotion = true;
    expect(JSON.parse(storage.raw()!)).toEqual({ ...DEFAULT_SETTINGS, volume: 0.5, reducedMotion: true, playerName: "Zoé" });
    expect(createSettings(storage).playerName).toBe("Zoé");
  });
  it("fonctionne sans stockage et quand il refuse d'écrire", () => {
    const sans = createSettings(null);
    sans.volume = 0.2;
    expect(sans.volume).toBe(0.2);
    const casse = createSettings({
      getItem: () => {
        throw new Error("interdit");
      },
      setItem: () => {
        throw new Error("plein");
      },
    });
    expect(casse).toEqual(DEFAULT_SETTINGS);
    expect(() => (casse.volume = 0.1)).not.toThrow();
  });
});
