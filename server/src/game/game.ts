import {
  AVATAR_COUNT,
  DEFAULT_CARDS_TO_WIN,
  GameError,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameTrack,
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
 * Déroulement : lobby → awaiting-placement → reveal → (fin de tour de plateau : round-recap)
 * → awaiting-placement … → finished. Le moteur est indépendant du réseau et du mode de jeu.
 */
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
    const player: Player = { id: `p${this.nextPlayerId++}`, name: clean, avatar, timeline: [] };
    this.players.push(player);
    return player;
  }

  removePlayer(playerId: string): void {
    const index = this.players.findIndex((p) => p.id === playerId);
    if (index < 0) return;
    if (this.phase === "lobby") {
      this.players.splice(index, 1);
      return;
    }
    // Pas de retrait en cours de partie : le joueur reste à l'écran (déconnexion gérée par la salle).
    throw new GameError("On ne peut pas retirer un joueur en cours de partie.");
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
    const correct = isCorrectPlacement(player.timeline, position, track.year);
    if (correct) player.timeline.splice(position, 0, track);

    this.lastResult = { playerId, position, correct, track };
    this.current = undefined;
    this.phase = "reveal";
    return this.lastResult;
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
   * comme un mauvais placement. `position` vaut -1 dans le résultat pour signaler le passage.
   */
  skipTurn(): PlacementResult {
    if (this.phase !== "awaiting-placement" || !this.current) {
      throw new GameError("Ce n'est pas le moment de passer un tour.");
    }
    const player = this.players[this.turnIndex]!;
    this.lastResult = { playerId: player.id, position: -1, correct: false, track: this.current };
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
      const wrapped = this.turnIndex === this.players.length - 1;
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      if (wrapped) {
        const leaders = this.leadersAtGoal();
        if (leaders.length === 1) {
          this.winnerIds = leaders.map((p) => p.id);
          this.phase = "finished";
          return;
        }
        this.round++;
        this.phase = "round-recap";
        return;
      }
      this.draw();
    } else if (this.phase === "round-recap") {
      this.draw();
    } else {
      throw new GameError("Rien à faire avancer pour le moment.");
    }
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
      this.finishOnEmptyDeck();
      return;
    }
    this.current = next;
    this.listened = false;
    this.phase = "awaiting-placement";
  }

  private finishOnEmptyDeck(): void {
    const best = Math.max(...this.players.map((p) => p.timeline.length));
    this.winnerIds = this.players.filter((p) => p.timeline.length === best).map((p) => p.id);
    this.phase = "finished";
  }
}

export function isCorrectPlacement(timeline: GameTrack[], position: number, year: number): boolean {
  const before = timeline[position - 1];
  const after = timeline[position];
  return (before === undefined || before.year <= year) && (after === undefined || year <= after.year);
}

/** Mélange de Fisher-Yates. */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
