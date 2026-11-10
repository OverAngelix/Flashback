import {
  AVATAR_COUNT,
  DEFAULT_CARDS_TO_WIN,
  GameError,
  isCorrectPlacement,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameTrack,
  type GrooveGuess,
  type Phase,
  type PlacementResult,
  type Player,
} from "./types.js";

export interface GameOptions {
  /** Titres disponibles pour la partie (déjà filtrés par catégories) ; modifiables avec setTracks. */
  tracks?: GameTrack[];
  cardsToWin?: number;
  /** Générateur dans [0, 1[, injectable pour les tests. */
  rng?: () => number;
}

/**
 * Règles Hitster de base. Le placement est correct quand l'année du titre est comprise (bornes
 * incluses) entre celles de ses voisins dans la frise. Une carte bien placée est gardée, sinon
 * elle est défaussée.
 *
 * Fin de partie : le tour de plateau est toujours terminé, pour que tous les joueurs aient joué
 * autant de fois. À la fin d'un tour, si un seul joueur a le plus de cartes et au moins
 * `cardsToWin`, il gagne. En cas d'égalité en tête, on rejoue un tour (l'objectif monte à 11, 12…).
 *
 * Groove : pendant le tour d'un joueur, une fois l'extrait lancé, chacun des autres peut placer le
 * titre dans la frise du joueur actif (une fois, sans retour). Il doit le faire avant lui : dès que
 * le joueur actif a placé, c'est trop tard. Un placement groove juste rapporte un point groove ; il
 * ne compte pas pour la victoire, qui ne dépend que des frises.
 *
 * Déroulement : lobby → awaiting-placement → reveal → (fin de tour de plateau : round-recap)
 * → awaiting-placement … → finished. Le moteur est indépendant du réseau et du mode de jeu.
 */
export { isCorrectPlacement };

export class Game {
  readonly cardsToWin: number;
  private readonly rng: () => number;
  private deck: GameTrack[];
  private nextPlayerId = 1;

  phase: Phase = "lobby";
  readonly players: Player[] = [];
  /** Index du joueur dont c'est le tour. */
  turnIndex = 0;
  /** Numéro du tour de plateau en cours, à partir de 1 (0 avant le début). */
  round = 0;
  /** Titre à placer, uniquement pendant awaiting-placement. */
  current?: GameTrack;
  /** Le joueur actif a déjà écouté l'extrait de ce tour : une seule écoute par tour. */
  listened = false;
  /** Placements groove du tour en cours : joueur -> position dans la frise du joueur actif. */
  readonly grooveGuesses = new Map<string, number>();
  lastResult?: PlacementResult;
  winnerIds: string[] = [];

  constructor(options: GameOptions) {
    this.cardsToWin = options.cardsToWin ?? DEFAULT_CARDS_TO_WIN;
    this.rng = options.rng ?? Math.random;
    this.deck = shuffle([...(options.tracks ?? [])], this.rng);
  }

  /** Nombre de titres encore dans le paquet (avant le départ : taille du paquet choisi). */
  get remainingTracks(): number {
    return this.deck.length;
  }

  /** Change le paquet (choix des catégories) ; uniquement avant le départ. */
  setTracks(tracks: GameTrack[]): void {
    if (this.phase !== "lobby") throw new GameError("La partie a déjà commencé.");
    this.deck = shuffle([...tracks], this.rng);
  }

  get activePlayer(): Player | undefined {
    return this.phase === "lobby" ? undefined : this.players[this.turnIndex];
  }

  addPlayer(name: string, avatar: number): Player {
    if (this.phase !== "lobby") throw new GameError("La partie a déjà commencé.");
    if (this.players.length >= MAX_PLAYERS) throw new GameError("La partie est pleine.");
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) throw new GameError("Choisissez un nom.");
    if (clean.length > MAX_NAME_LENGTH) {
      throw new GameError(`Le nom ne peut pas dépasser ${MAX_NAME_LENGTH} caractères.`);
    }
    if (this.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      throw new GameError("Ce nom est déjà pris.");
    }
    if (!Number.isInteger(avatar) || avatar < 0 || avatar >= AVATAR_COUNT) {
      throw new GameError("Avatar invalide.");
    }
    if (this.players.some((p) => p.avatar === avatar)) {
      throw new GameError("Cet avatar est déjà pris.");
    }
    const player: Player = { id: `p${this.nextPlayerId++}`, name: clean, avatar, timeline: [], groove: 0 };
    this.players.push(player);
    return player;
  }

  /**
   * Retire un joueur (il quitte la partie). En cours de partie, sa frise part avec lui et les
   * autres continuent : si c'était son tour, le titre en cours est défaussé et la main passe au
   * suivant, ou au récapitulatif s'il fermait le tour de plateau. Sous MIN_PLAYERS joueurs, la
   * partie s'arrête et le meilleur restant l'emporte. Une partie terminée garde son classement.
   */
  removePlayer(playerId: string): void {
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index < 0 || this.phase === "finished") return;
    this.players.splice(index, 1);
    this.grooveGuesses.delete(playerId);
    if (this.phase === "lobby") return;

    if (this.players.length < MIN_PLAYERS) {
      this.current = undefined;
      this.finishWithBest();
      return;
    }
    if (index < this.turnIndex) {
      this.turnIndex--;
    } else if (index === this.turnIndex && this.phase !== "round-recap") {
      // Il plaçait son titre ou on révélait son résultat : on passe directement au suivant.
      this.current = undefined;
      this.lastResult = undefined;
      this.nextTurn(index);
    }
  }

  start(): void {
    if (this.phase !== "lobby") throw new GameError("La partie a déjà commencé.");
    if (this.players.length < MIN_PLAYERS) {
      throw new GameError(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
    }
    if (this.deck.length < this.players.length + 1) {
      throw new GameError("Pas assez de titres dans les catégories choisies.");
    }
    for (const player of this.players) player.timeline.push(this.deck.pop()!);
    this.round = 1;
    this.turnIndex = 0;
    this.draw();
  }

  /** Le joueur actif place le titre courant dans sa frise (position 0 à timeline.length). */
  placeCard(playerId: string, position: number): PlacementResult {
    if (this.phase !== "awaiting-placement" || !this.current) {
      throw new GameError("Ce n'est pas le moment de placer une carte.");
    }
    const player = this.players[this.turnIndex]!;
    if (player.id !== playerId) throw new GameError("Ce n'est pas votre tour.");
    if (!Number.isInteger(position) || position < 0 || position > player.timeline.length) {
      throw new GameError("Position invalide.");
    }

    const track = this.current;
    const groove = this.settleGroove(player, track);
    const correct = isCorrectPlacement(player.timeline, position, track.year);
    if (correct) player.timeline.splice(position, 0, track);

    this.lastResult = { playerId, position, correct, track, groove };
    this.current = undefined;
    this.phase = "reveal";
    return this.lastResult;
  }

  /**
   * Un autre joueur que le joueur actif place le titre courant dans la frise de ce dernier (position 0
   * à timeline.length du joueur actif), pour un point groove. Possible une fois l'extrait lancé,
   * une seule fois par tour, et seulement tant que le joueur actif n'a pas placé.
   */
  placeGroove(playerId: string, position: number): void {
    if (this.phase !== "awaiting-placement" || !this.current) {
      throw new GameError("Trop tard : le titre a déjà été placé.");
    }
    const active = this.players[this.turnIndex]!;
    if (active.id === playerId) throw new GameError("C'est ton tour : place le titre dans ta frise.");
    if (!this.players.some((p) => p.id === playerId)) throw new GameError("Joueur inconnu.");
    if (!this.listened) throw new GameError("Attends que l'extrait soit lancé.");
    if (this.grooveGuesses.has(playerId)) throw new GameError("Tu as déjà placé ce titre.");
    if (!Number.isInteger(position) || position < 0 || position > active.timeline.length) {
      throw new GameError("Position invalide.");
    }
    this.grooveGuesses.set(playerId, position);
  }

  /** Corrige les placements groove du tour sur la frise du joueur actif (avant son propre placement). */
  private settleGroove(active: Player, track: GameTrack): GrooveGuess[] {
    const results: GrooveGuess[] = [];
    for (const p of this.players) {
      const position = this.grooveGuesses.get(p.id);
      if (position === undefined || p.id === active.id) continue;
      const correct = isCorrectPlacement(active.timeline, position, track.year);
      if (correct) p.groove++;
      results.push({ playerId: p.id, position, correct });
    }
    this.grooveGuesses.clear();
    return results;
  }

  /** Vérifie que ce joueur peut écouter l'extrait maintenant, sans rien modifier. */
  assertCanListen(playerId: string): GameTrack {
    if (this.phase !== "awaiting-placement" || !this.current) {
      throw new GameError("Pas d'extrait à écouter pour le moment.");
    }
    if (this.players[this.turnIndex]!.id !== playerId) throw new GameError("Ce n'est pas votre tour.");
    if (this.listened) throw new GameError("Vous avez déjà écouté l'extrait : placez-le dans votre frise.");
    return this.current;
  }

  /** Le joueur actif écoute l'extrait : une seule fois par tour. Renvoie le titre à jouer. */
  listen(playerId: string): GameTrack {
    const track = this.assertCanListen(playerId);
    this.listened = true;
    return track;
  }

  /**
   * L'hôte passe le tour du joueur actif (par exemple s'il est déconnecté) : le titre est défaussé,
   * comme un mauvais placement. `position` vaut -1 dans le résultat pour signaler le passage. Les
   * placements groove déjà faits sont corrigés normalement.
   */
  skipTurn(): PlacementResult {
    if (this.phase !== "awaiting-placement" || !this.current) {
      throw new GameError("Ce n'est pas le moment de passer un tour.");
    }
    const player = this.players[this.turnIndex]!;
    const groove = this.settleGroove(player, this.current);
    this.lastResult = { playerId: player.id, position: -1, correct: false, track: this.current, groove };
    this.current = undefined;
    this.phase = "reveal";
    return this.lastResult;
  }

  /**
   * Fait avancer la partie après la révélation ou le récapitulatif (action de l'hôte).
   * À la fin d'un tour de plateau : fin de partie s'il y a un vainqueur, sinon récapitulatif.
   */
  advance(): void {
    if (this.phase === "reveal") {
      this.nextTurn(this.turnIndex + 1);
    } else if (this.phase === "round-recap") {
      this.draw();
    } else {
      throw new GameError("Rien à faire avancer pour le moment.");
    }
  }

  /**
   * Donne la main au joueur `index`. Au-delà du dernier, le tour de plateau est fini : victoire
   * s'il y a un seul meilleur à l'objectif, sinon récapitulatif.
   */
  private nextTurn(index: number): void {
    if (index < this.players.length) {
      this.turnIndex = index;
      this.draw();
      return;
    }
    this.turnIndex = 0;
    const leaders = this.leadersAtGoal();
    if (leaders.length === 1) {
      this.winnerIds = leaders.map((p) => p.id);
      this.phase = "finished";
      return;
    }
    this.round++;
    this.phase = "round-recap";
  }

  /** Joueurs en tête de frise, seulement si la tête a atteint l'objectif (sinon aucun). */
  private leadersAtGoal(): Player[] {
    const best = Math.max(...this.players.map((p) => p.timeline.length));
    if (best < this.cardsToWin) return [];
    return this.players.filter((p) => p.timeline.length === best);
  }

  /** Pioche le prochain titre ; si le paquet est vide, la partie se termine. */
  private draw(): void {
    const next = this.deck.pop();
    if (!next) {
      this.finishWithBest();
      return;
    }
    this.current = next;
    this.listened = false;
    this.grooveGuesses.clear();
    this.phase = "awaiting-placement";
  }

  /** Fin anticipée (paquet vide, joueurs partis) : les plus longues frises l'emportent. */
  private finishWithBest(): void {
    const best = Math.max(...this.players.map((p) => p.timeline.length));
    this.winnerIds = this.players.filter((p) => p.timeline.length === best).map((p) => p.id);
    this.phase = "finished";
  }
}

/** Mélange de Fisher-Yates. */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
