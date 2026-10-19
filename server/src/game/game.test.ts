import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Game, isCorrectPlacement } from "./game.js";
import { GameError, type GameTrack } from "./types.js";

const track = (id: number, year: number): GameTrack => ({
  id,
  title: `Titre ${id}`,
  artist: `Artiste ${id}`,
  year,
  audioFile: `audio/${id}.m4a`,
  imageFile: `images/${id}.jpg`,
});

/** Générateur qui laisse le paquet dans l'ordre d'origine (le mélange est neutralisé). */
const noShuffle = () => 0.999999;

/**
 * Paquet fixe : le dernier élément est pioché en premier. Avec `rng` neutre le mélange de
 * Fisher-Yates échange chaque élément avec lui-même.
 */
function newGame(years: number[], cardsToWin = 3): Game {
  return new Game({ tracks: years.map((y, i) => track(i + 1, y)), cardsToWin, rng: noShuffle });
}

function twoPlayers(game: Game) {
  const a = game.addPlayer("Ana", 0);
  const b = game.addPlayer("Ben", 1);
  return { a, b };
}

describe("isCorrectPlacement", () => {
  const timeline = [track(1, 1960), track(2, 1980), track(3, 2000)];
  it("accepte l'intérieur d'un intervalle, les extrémités et les années égales", () => {
    assert.equal(isCorrectPlacement(timeline, 0, 1950), true);
    assert.equal(isCorrectPlacement(timeline, 1, 1970), true);
    assert.equal(isCorrectPlacement(timeline, 3, 2010), true);
    assert.equal(isCorrectPlacement(timeline, 1, 1960), true);
    assert.equal(isCorrectPlacement(timeline, 1, 1980), true);
    assert.equal(isCorrectPlacement(timeline, 2, 1980), true);
  });
  it("refuse hors intervalle", () => {
    assert.equal(isCorrectPlacement(timeline, 0, 1970), false);
    assert.equal(isCorrectPlacement(timeline, 1, 1990), false);
    assert.equal(isCorrectPlacement(timeline, 3, 1990), false);
  });
  it("accepte tout dans une frise vide", () => {
    assert.equal(isCorrectPlacement([], 0, 1999), true);
  });
});

describe("joueurs", () => {
  it("nettoie le nom et refuse les doublons de nom ou d'avatar", () => {
    const game = newGame([1, 2, 3, 4, 5]);
    assert.equal(game.addPlayer("  Ana  ", 0).name, "Ana");
    assert.throws(() => game.addPlayer("ana", 1), /nom est déjà pris/);
    assert.throws(() => game.addPlayer("Ben", 0), /avatar est déjà pris/);
  });
  it("refuse un nom vide ou trop long et un avatar hors de 0 à 9", () => {
    const game = newGame([1, 2, 3, 4, 5]);
    assert.throws(() => game.addPlayer("   ", 0), /Choisissez un nom/);
    assert.throws(() => game.addPlayer("x".repeat(17), 0), /caractères/);
    assert.throws(() => game.addPlayer("Ana", 10), /Avatar invalide/);
    assert.throws(() => game.addPlayer("Ana", -1), /Avatar invalide/);
    assert.throws(() => game.addPlayer("Ana", 1.5), /Avatar invalide/);
  });
  it("refuse plus de 10 joueurs", () => {
    const game = newGame(Array.from({ length: 30 }, (_, i) => 1950 + i));
    for (let i = 0; i < 10; i++) game.addPlayer(`J${i}`, i);
    assert.throws(() => game.addPlayer("Onze", 0), GameError);
  });
  it("ne permet plus d'ajouter un joueur après le départ", () => {
    const game = newGame([1, 2, 3, 4, 5]);
    twoPlayers(game);
    game.start();
    assert.throws(() => game.addPlayer("Cléo", 2), /déjà commencé/);
  });
});

describe("démarrage", () => {
  it("exige au moins 2 joueurs et assez de titres", () => {
    const game = newGame([1, 2, 3, 4, 5]);
    game.addPlayer("Ana", 0);
    assert.throws(() => game.start(), /au moins 2 joueurs/);
    const small = newGame([1, 2]);
    twoPlayers(small);
    assert.throws(() => small.start(), /Pas assez de titres/);
  });
  it("donne une carte de départ à chacun puis pioche le premier titre", () => {
    // Paquet [1950, 1960, 1970, 1980, 1990] : pioche dans l'ordre 1990, 1980, 1970.
    const game = newGame([1950, 1960, 1970, 1980, 1990]);
    const { a, b } = twoPlayers(game);
    game.start();
    assert.deepEqual(a.timeline.map((t) => t.year), [1990]);
    assert.deepEqual(b.timeline.map((t) => t.year), [1980]);
    assert.equal(game.current?.year, 1970);
    assert.equal(game.phase, "awaiting-placement");
    assert.equal(game.round, 1);
    assert.equal(game.activePlayer?.id, a.id);
  });
});

describe("tours", () => {
  // Pioche : 1990 (Ana), 1980 (Ben), puis 1970, 1960, 1950, 1940.
  const years = [1940, 1950, 1960, 1970, 1980, 1990];

  it("garde la carte bien placée et trie la frise", () => {
    const game = newGame(years);
    const { a } = twoPlayers(game);
    game.start();
    const result = game.placeCard(a.id, 0); // 1970 avant 1990
    assert.equal(result.correct, true);
    assert.deepEqual(a.timeline.map((t) => t.year), [1970, 1990]);
    assert.equal(game.phase, "reveal");
    assert.equal(game.current, undefined);
  });

  it("défausse la carte mal placée", () => {
    const game = newGame(years);
    const { a } = twoPlayers(game);
    game.start();
    const result = game.placeCard(a.id, 1); // 1970 après 1990 : faux
    assert.equal(result.correct, false);
    assert.deepEqual(a.timeline.map((t) => t.year), [1990]);
    assert.equal(result.track.year, 1970);
  });

  it("refuse un autre joueur, une position invalide et un double placement", () => {
    const game = newGame(years);
    const { a, b } = twoPlayers(game);
    game.start();
    assert.throws(() => game.placeCard(b.id, 0), /pas votre tour/);
    assert.throws(() => game.placeCard(a.id, 2), /Position invalide/);
    assert.throws(() => game.placeCard(a.id, -1), /Position invalide/);
    game.placeCard(a.id, 0);
    assert.throws(() => game.placeCard(a.id, 0), /pas le moment/);
  });

  it("passe au joueur suivant, puis récapitule à la fin du tour de plateau", () => {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    game.start();
    game.placeCard(a.id, 0);
    game.advance();
    assert.equal(game.phase, "awaiting-placement");
    assert.equal(game.activePlayer?.id, b.id);
    assert.equal(game.round, 1);

    game.placeCard(b.id, 0);
    game.advance();
    assert.equal(game.phase, "round-recap");
    assert.equal(game.round, 2);
    assert.equal(game.activePlayer?.id, a.id);
    assert.equal(game.current, undefined);

    game.advance();
    assert.equal(game.phase, "awaiting-placement");
    assert.ok(game.current);
  });

  it("n'avance pas dans une phase où il n'y a rien à valider", () => {
    const game = newGame(years);
    twoPlayers(game);
    assert.throws(() => game.advance(), /Rien à faire avancer/);
    game.start();
    assert.throws(() => game.advance(), /Rien à faire avancer/);
  });
});

describe("fin de partie", () => {
  it("attend la fin du tour de plateau, même si un joueur a déjà atteint l'objectif", () => {
    // Objectif 2 cartes. Pioche : 1980 (Ana), 1970 (Ben), puis 1960 et 1950.
    const game = newGame([1940, 1950, 1960, 1970, 1980], 2);
    const { a, b } = twoPlayers(game);
    game.start();
    game.placeCard(a.id, 0); // 1960 avant 1980 : Ana a 2 cartes
    assert.deepEqual(game.winnerIds, []);
    game.advance();
    assert.equal(game.phase, "awaiting-placement");
    assert.equal(game.activePlayer?.id, b.id); // Ben joue encore son tour

    game.placeCard(b.id, 1); // 1950 après 1970 : faux
    game.advance(); // fin du tour de plateau
    assert.equal(game.phase, "finished");
    assert.deepEqual(game.winnerIds, [a.id]);
  });

  it("rejoue un tour quand plusieurs joueurs sont à égalité en tête (l'objectif monte)", () => {
    const game = newGame([1920, 1930, 1940, 1950, 1960, 1970, 1980], 2);
    const { a, b } = twoPlayers(game);
    game.start(); // Ana 1980, Ben 1970, courant 1960
    game.placeCard(a.id, 0); // Ana : 2 cartes
    game.advance(); // courant 1950
    game.placeCard(b.id, 0); // Ben : 2 cartes
    game.advance(); // égalité à 2 : pas de vainqueur
    assert.equal(game.phase, "round-recap");
    assert.deepEqual(game.winnerIds, []);

    game.advance(); // courant 1940
    game.placeCard(a.id, 0); // Ana : 3 cartes
    game.advance(); // courant 1930
    game.placeCard(b.id, 2); // 1930 après 1970 : faux, Ben reste à 2
    game.advance();
    assert.equal(game.phase, "finished");
    assert.deepEqual(game.winnerIds, [a.id]);
  });

  it("continue tant que l'égalité en tête persiste sur plusieurs tours", () => {
    // Ana et Ben gagnent chacun une carte à chaque tour : l'égalité persiste, pas de vainqueur.
    const game = newGame([1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990], 2);
    const { a, b } = twoPlayers(game);
    game.start(); // Ana 1990, Ben 1980, courant 1970
    game.placeCard(a.id, 0);
    game.advance();
    game.placeCard(b.id, 0);
    game.advance();
    assert.equal(game.phase, "round-recap");
    game.advance();
    game.placeCard(a.id, 0);
    game.advance();
    game.placeCard(b.id, 0);
    game.advance();
    assert.equal(game.phase, "round-recap");
    assert.deepEqual(game.winnerIds, []);
  });

  it("ne donne pas la victoire sur un mauvais placement", () => {
    const game = newGame([1940, 1950, 1960, 1970, 1980], 2);
    const { a } = twoPlayers(game);
    game.start();
    game.placeCard(a.id, 1);
    assert.deepEqual(game.winnerIds, []);
  });

  it("se termine quand le paquet est vide, victoire à égalité possible", () => {
    // 4 titres : 2 cartes de départ, 1 titre joué par Ana (mal placé), le dernier par Ben (mal placé).
    const game = newGame([1950, 1960, 1970, 1980], 10);
    const { a, b } = twoPlayers(game);
    game.start(); // Ana 1980, Ben 1970, courant 1960
    game.placeCard(a.id, 1); // 1960 après 1980 : faux
    game.advance(); // courant 1950
    game.placeCard(b.id, 1); // 1950 après 1970 : faux
    game.advance(); // fin de tour de plateau
    assert.equal(game.phase, "round-recap");
    game.advance(); // paquet vide
    assert.equal(game.phase, "finished");
    assert.deepEqual(game.winnerIds.sort(), [a.id, b.id].sort());
  });
});
