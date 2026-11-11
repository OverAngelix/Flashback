import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Game, isCorrectPlacement } from "./game.js";
import { correctPositions, GameError, type GameTrack } from "./types.js";

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
  it("liste toutes les positions justes, plusieurs en cas d'années égales", () => {
    assert.deepEqual(correctPositions(timeline, 1970), [1]);
    assert.deepEqual(correctPositions(timeline, 1980), [1, 2]);
    assert.deepEqual(correctPositions(timeline, 2020), [3]);
    assert.deepEqual(correctPositions([], 1999), [0]);
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

describe("objectif", () => {
  it("vaut 10 cartes par défaut", () => {
    assert.equal(new Game({}).cardsToWin, 10);
  });
  it("se règle de 3 à 10 cartes, uniquement dans le salon", () => {
    const game = newGame([1, 2, 3, 4, 5]);
    game.setCardsToWin(3);
    assert.equal(game.cardsToWin, 3);
    game.setCardsToWin(10);
    assert.equal(game.cardsToWin, 10);
    for (const bad of [2, 11, 5.5, Number.NaN]) {
      assert.throws(() => game.setCardsToWin(bad), /entre 3 et 10 cartes/);
    }
    assert.equal(game.cardsToWin, 10);
    twoPlayers(game);
    game.start();
    assert.throws(() => game.setCardsToWin(5), /déjà commencé/);
  });
  it("décide de la victoire à la fin du tour de plateau", () => {
    // Objectif réglé à 3. Pioche : 1980 (Ana), 1970 (Ben), puis 1960, 1950, 1940, 1930.
    const game = newGame([1920, 1930, 1940, 1950, 1960, 1970, 1980], 10);
    const { a, b } = twoPlayers(game);
    game.setCardsToWin(3);
    game.start();
    game.placeCard(a.id, 0); // 1960 : Ana a 2 cartes
    game.advance();
    game.placeCard(b.id, 1); // 1950 après 1970 : faux
    game.advance();
    assert.equal(game.phase, "round-recap"); // 2 cartes < 3
    game.advance();
    game.placeCard(a.id, 0); // 1940 : Ana a 3 cartes
    game.advance();
    game.placeCard(b.id, 1); // 1930 après 1970 : faux
    game.advance();
    assert.equal(game.phase, "finished");
    assert.deepEqual(game.winnerIds, [a.id]);
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

describe("paquet et tour passé", () => {
  it("permet de changer le paquet avant le départ seulement", () => {
    const game = new Game({ rng: noShuffle });
    twoPlayers(game);
    assert.throws(() => game.start(), /Pas assez de titres/);
    game.setTracks([1950, 1960, 1970, 1980].map((y, i) => track(i + 1, y)));
    assert.equal(game.remainingTracks, 4);
    game.start();
    assert.throws(() => game.setTracks([]), /déjà commencé/);
  });

  it("défausse le titre quand l'hôte passe le tour", () => {
    const game = newGame([1940, 1950, 1960, 1970, 1980], 10);
    const { a, b } = twoPlayers(game);
    game.start();
    const result = game.skipTurn();
    assert.equal(result.correct, false);
    assert.equal(result.position, -1);
    assert.equal(result.playerId, a.id);
    assert.equal(a.timeline.length, 1);
    assert.equal(game.phase, "reveal");
    assert.throws(() => game.skipTurn(), /pas le moment/);
    game.advance();
    assert.equal(game.activePlayer?.id, b.id);
  });
});

describe("écoute de l'extrait", () => {
  const years = [1940, 1950, 1960, 1970, 1980, 1990];

  it("n'autorise qu'une écoute par tour, au joueur actif seulement", () => {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    assert.throws(() => game.listen(a.id), /Pas d'extrait/);
    game.start();
    assert.equal(game.listened, false);
    assert.throws(() => game.listen(b.id), /pas votre tour/);
    assert.equal(game.assertCanListen(a.id).year, 1970);
    assert.equal(game.listened, false); // la vérification ne consomme rien

    assert.equal(game.listen(a.id).year, 1970);
    assert.equal(game.listened, true);
    assert.throws(() => game.listen(a.id), /déjà écouté/);
  });

  it("rend l'écoute au joueur suivant et ne permet plus d'écouter après le placement", () => {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    game.start();
    game.listen(a.id);
    game.placeCard(a.id, 0);
    assert.throws(() => game.listen(a.id), /Pas d'extrait/);
    game.advance();
    assert.equal(game.listened, false);
    assert.equal(game.listen(b.id).year, 1960);
  });
});

describe("groove", () => {
  // Départ : Ana 1990, Ben 1980, Cléo 1970 ; titres suivants : 1960, puis 1950, puis 1940.
  const years = [1940, 1950, 1960, 1970, 1980, 1990];
  function threePlayers() {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    const c = game.addPlayer("Cléo", 2);
    game.start();
    return { game, a, b, c };
  }

  it("rapporte un point aux placements justes dans la frise du joueur actif, rien aux faux", () => {
    const { game, a, b, c } = threePlayers();
    game.listen(a.id);
    game.placeGroove(b.id, 0); // 1960 avant 1990 : juste
    game.placeGroove(c.id, 1); // 1960 après 1990 : faux
    const result = game.placeCard(a.id, 1); // faux pour Ana aussi
    assert.deepEqual(result.groove, [
      { playerId: b.id, position: 0, correct: true },
      { playerId: c.id, position: 1, correct: false },
    ]);
    assert.deepEqual([a.groove, b.groove, c.groove], [0, 1, 0]);
    // Le groove ne pose aucune carte : seule la frise du joueur actif peut changer.
    assert.deepEqual([a, b, c].map((p) => p.timeline.map((t) => t.year)), [[1990], [1980], [1970]]);
  });

  it("corrige sur la frise d'avant le placement du joueur actif", () => {
    const { game, a, b } = threePlayers();
    game.listen(a.id);
    game.placeGroove(b.id, 0);
    game.placeCard(a.id, 0); // Ana pose 1960 en tête : la position 0 de Ben reste juste
    assert.equal(b.groove, 1);
    assert.deepEqual(a.timeline.map((t) => t.year), [1960, 1990]);
  });

  it("refuse avant l'écoute, au joueur actif, en double, hors frise, et après le placement", () => {
    const { game, a, b, c } = threePlayers();
    assert.throws(() => game.placeGroove(b.id, 0), /extrait soit lancé/);
    game.listen(a.id);
    assert.throws(() => game.placeGroove(a.id, 0), /C'est ton tour/);
    assert.throws(() => game.placeGroove(b.id, 2), /Position invalide/);
    assert.throws(() => game.placeGroove("p99", 0), /Joueur inconnu/);
    game.placeGroove(b.id, 0);
    assert.throws(() => game.placeGroove(b.id, 1), /déjà placé/);
    game.placeCard(a.id, 0);
    assert.throws(() => game.placeGroove(c.id, 0), /Trop tard/);
  });

  it("corrige aussi les placements d'un tour passé, puis repart de zéro au tour suivant", () => {
    const { game, a, b, c } = threePlayers();
    game.listen(a.id);
    game.placeGroove(b.id, 0);
    assert.deepEqual(game.skipTurn().groove, [{ playerId: b.id, position: 0, correct: true }]);
    assert.equal(b.groove, 1);
    game.advance();
    assert.equal(game.grooveGuesses.size, 0);
    game.listen(b.id);
    game.placeGroove(a.id, 1); // 1950 après 1980 : faux
    game.placeGroove(c.id, 0);
    assert.deepEqual(game.placeCard(b.id, 0).groove.map((g) => g.correct), [false, true]);
    assert.deepEqual([a.groove, b.groove, c.groove], [0, 1, 1]);
  });

  it("oublie le placement d'un joueur qui s'en va", () => {
    const { game, a, c } = threePlayers();
    game.listen(a.id);
    game.placeGroove(c.id, 0);
    game.removePlayer(c.id);
    assert.deepEqual(game.placeCard(a.id, 0).groove, []);
  });
});

describe("départ d'un joueur en cours de partie", () => {
  const years = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 1955, 1965, 1975, 1985];
  function threePlayers() {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    const c = game.addPlayer("Cléo", 2);
    game.start();
    return { game, a, b, c };
  }

  it("retire un joueur qui n'a pas la main sans toucher au tour en cours", () => {
    const { game, a, c } = threePlayers();
    const current = game.current;
    game.removePlayer(c.id);
    assert.deepEqual(game.players.map((p) => p.name), ["Ana", "Ben"]);
    assert.equal(game.activePlayer?.id, a.id);
    assert.equal(game.current, current);
    assert.equal(game.phase, "awaiting-placement");
  });

  it("garde le joueur actif quand un joueur placé avant lui s'en va", () => {
    const { game, a, b } = threePlayers();
    game.placeCard(a.id, 0);
    game.advance();
    game.removePlayer(a.id);
    assert.equal(game.activePlayer?.id, b.id);
  });

  it("défausse le titre et passe au suivant quand le joueur actif s'en va", () => {
    const { game, a, b } = threePlayers();
    game.listen(a.id);
    const before = game.remainingTracks;
    game.removePlayer(a.id);
    assert.equal(game.phase, "awaiting-placement");
    assert.equal(game.activePlayer?.id, b.id);
    assert.equal(game.listened, false);
    assert.equal(game.remainingTracks, before - 1);
  });

  it("passe au suivant pendant la révélation du joueur qui s'en va", () => {
    const { game, a, b } = threePlayers();
    game.placeCard(a.id, 0);
    game.removePlayer(a.id);
    assert.equal(game.phase, "awaiting-placement");
    assert.equal(game.activePlayer?.id, b.id);
    assert.equal(game.lastResult, undefined);
  });

  it("termine le tour de plateau quand le dernier joueur du tour s'en va", () => {
    const { game, a, b, c } = threePlayers();
    game.placeCard(a.id, 0);
    game.advance();
    game.placeCard(b.id, 0);
    game.advance();
    game.removePlayer(c.id);
    assert.equal(game.phase, "round-recap");
    assert.equal(game.round, 2);
    game.advance();
    assert.equal(game.activePlayer?.id, a.id);
  });

  it("donne la main au nouveau premier joueur après le récapitulatif", () => {
    const { game, a, b, c } = threePlayers();
    for (const p of [a, b, c]) {
      game.placeCard(p.id, 0);
      game.advance();
    }
    assert.equal(game.phase, "round-recap");
    game.removePlayer(a.id);
    game.advance();
    assert.equal(game.activePlayer?.id, b.id);
  });

  it("arrête la partie quand il ne reste qu'un joueur, qui l'emporte", () => {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    game.start();
    game.removePlayer(a.id);
    assert.equal(game.phase, "finished");
    assert.deepEqual(game.winnerIds, [b.id]);
    assert.equal(game.current, undefined);
  });

  it("ne change rien à une partie terminée", () => {
    const game = newGame(years, 10);
    const { a, b } = twoPlayers(game);
    game.start();
    game.removePlayer(a.id);
    game.removePlayer(b.id);
    assert.deepEqual(game.players.map((p) => p.id), [b.id]);
    assert.deepEqual(game.winnerIds, [b.id]);
  });
});
