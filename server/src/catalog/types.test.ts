import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORIES, categoriesOf, eraOf, matchesSelection } from "./types.js";

describe("catégories", () => {
  it("ont des identifiants uniques", () => {
    assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
  });

  it("déduisent l'époque de l'année", () => {
    assert.equal(eraOf(1948), "era-1960");
    assert.equal(eraOf(1969), "era-1960");
    assert.equal(eraOf(1970), "era-1970");
    assert.equal(eraOf(1999), "era-1990");
    assert.equal(eraOf(2025), "era-2020");
  });

  it("donnent à un titre son origine, son époque et ses genres", () => {
    assert.deepEqual(categoriesOf({ origin: "fr", genres: ["disco", "pop"], year: 1977 }), ["fr", "era-1970", "disco", "pop"]);
  });

  it("combinent la sélection : OU dans un axe, ET entre les axes", () => {
    const disco77 = { origin: "fr", genres: ["disco", "pop"], year: 1977 } as const;
    assert.equal(matchesSelection(disco77, []), true);
    assert.equal(matchesSelection(disco77, ["fr", "international"]), true);
    assert.equal(matchesSelection(disco77, ["international"]), false);
    assert.equal(matchesSelection(disco77, ["fr", "era-1980"]), false);
    assert.equal(matchesSelection(disco77, ["fr", "era-1970", "era-1980", "rock", "disco"]), true);
    assert.equal(matchesSelection(disco77, ["fr", "rock"]), false);
  });
});
