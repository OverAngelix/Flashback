import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalog } from "../catalog/store.js";
import { CATEGORIES } from "../catalog/types.js";
import { CAMPAIGN, campaignLevel } from "./campaign.js";
import { SOLO_LIVES } from "./types.js";

describe("campagne", () => {
  it("a des niveaux aux identifiants uniques, aux catégories connues et aux objectifs croissants", () => {
    const ids = CAMPAIGN.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    const known = new Set(CATEGORIES.map((c) => c.id as string));
    for (const level of CAMPAIGN) {
      for (const c of level.categories) assert.ok(known.has(c), `${level.id} : catégorie ${c} inconnue`);
      assert.ok(level.goal >= 3, `${level.id} : objectif trop court`);
      assert.equal(campaignLevel(level.id), level);
    }
    for (let i = 1; i < CAMPAIGN.length; i++) assert.ok(CAMPAIGN[i]!.goal >= CAMPAIGN[i - 1]!.goal, "objectifs décroissants");
    assert.equal(campaignLevel("inconnu"), undefined);
  });

  it("garde assez de titres dans chaque niveau pour être rejoué, sur le vrai catalogue", async () => {
    const { catalog } = await loadCatalog();
    for (const level of CAMPAIGN) {
      const count = catalog.select([...level.categories]).length;
      // Une partie pioche au plus goal + SOLO_LIVES - 1 titres ; on en veut bien plus pour varier.
      assert.ok(count >= 5 * (level.goal + SOLO_LIVES), `${level.id} : seulement ${count} titres`);
    }
  });
});
