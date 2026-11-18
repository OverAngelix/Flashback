/** Les trois axes de sélection. Dans un axe, un titre doit avoir l'une des valeurs cochées ; entre axes, toutes. */
export type CategoryAxis = "origin" | "era" | "genre";

export type OriginId = "fr" | "international" | "europe-latino";
export type EraId = "era-1960" | "era-1970" | "era-1980" | "era-1990" | "era-2000" | "era-2010" | "era-2020";
export type GenreId =
  | "pop"
  | "rock"
  | "metal"
  | "rap"
  | "rap-fr"
  | "rnb"
  | "disco"
  | "electro"
  | "reggae"
  | "chanson"
  | "folk"
  | "jazz";
export type CategoryId = OriginId | EraId | GenreId;

export interface CategoryDef {
  id: CategoryId;
  axis: CategoryAxis;
  label: string;
}

/** Origine d'un titre (une seule) : elle donne la boutique iTunes interrogée en premier (code pays ISO). */
export const ORIGINS: Record<OriginId, { label: string; store: string }> = {
  fr: { label: "Français", store: "FR" },
  international: { label: "International", store: "US" },
  "europe-latino": { label: "Europe & Latino", store: "ES" },
};

/** Époque, déduite de l'année : la première tranche regroupe tout ce qui précède 1970. */
export const ERAS: Record<EraId, { label: string; from: number }> = {
  "era-1960": { label: "Avant 1970", from: -Infinity },
  "era-1970": { label: "Années 70", from: 1970 },
  "era-1980": { label: "Années 80", from: 1980 },
  "era-1990": { label: "Années 90", from: 1990 },
  "era-2000": { label: "Années 2000", from: 2000 },
  "era-2010": { label: "Années 2010", from: 2010 },
  "era-2020": { label: "Années 2020", from: 2020 },
};

export const GENRES: Record<GenreId, { label: string }> = {
  pop: { label: "Pop" },
  rock: { label: "Rock" },
  metal: { label: "Metal & hard rock" },
  rap: { label: "Rap & hip-hop" },
  "rap-fr": { label: "Rap français" },
  rnb: { label: "R&B, soul & funk" },
  disco: { label: "Disco" },
  electro: { label: "Électro & dance" },
  reggae: { label: "Reggae" },
  chanson: { label: "Chanson à texte" },
  folk: { label: "Country & folk" },
  jazz: { label: "Jazz, swing & blues" },
};

/** Toutes les catégories, dans l'ordre d'affichage (origines, époques, genres). */
export const CATEGORIES: readonly CategoryDef[] = [
  ...(Object.keys(ORIGINS) as OriginId[]).map((id) => ({ id, axis: "origin" as const, label: ORIGINS[id].label })),
  ...(Object.keys(ERAS) as EraId[]).map((id) => ({ id, axis: "era" as const, label: ERAS[id].label })),
  ...(Object.keys(GENRES) as GenreId[]).map((id) => ({ id, axis: "genre" as const, label: GENRES[id].label })),
];

export const isOrigin = (id: string): id is OriginId => Object.hasOwn(ORIGINS, id);
export const isGenre = (id: string): id is GenreId => Object.hasOwn(GENRES, id);

export function eraOf(year: number): EraId {
  let era: EraId = "era-1960";
  for (const id of Object.keys(ERAS) as EraId[]) if (year >= ERAS[id].from) era = id;
  return era;
}

/** Ce qu'il faut d'un titre pour le classer. */
export interface Classified {
  origin: OriginId;
  genres: readonly GenreId[];
  year: number;
}

/** Catégories d'un titre : son origine, son époque et ses genres. */
export const categoriesOf = (t: Classified): CategoryId[] => [t.origin, eraOf(t.year), ...t.genres];

/**
 * Le titre correspond-il à la sélection ? Dans un axe, il suffit d'une des valeurs choisies ; il faut
 * satisfaire chaque axe où quelque chose est choisi. Rien de choisi : tout correspond.
 */
export function matchesSelection(t: Classified, chosen: readonly string[]): boolean {
  const own = new Set<string>(categoriesOf(t));
  const byAxis = new Map<CategoryAxis, string[]>();
  for (const def of CATEGORIES) {
    if (!chosen.includes(def.id)) continue;
    byAxis.set(def.axis, [...(byAxis.get(def.axis) ?? []), def.id]);
  }
  return [...byAxis.values()].every((ids) => ids.some((id) => own.has(id)));
}

export interface CategorySummary {
  id: CategoryId;
  axis: CategoryAxis;
  label: string;
  count: number;
}

export interface CatalogTrack {
  /** trackId iTunes : permet de rafraîchir l'extrait via l'API lookup. */
  id: number;
  title: string;
  artist: string;
  /** Année retenue pour le jeu. */
  year: number;
  /**
   * "itunes" = date brute, non vérifiée. "manual" = corrigée ou confirmée à la main dans ce
   * fichier : le script ne la touche plus, même avec --refresh.
   */
  yearSource: "itunes" | "manual";
  yearNote?: string;
  /** Date brute iTunes (la plus ancienne parmi les résultats retenus), jamais modifiée. */
  releaseDate: string;
  origin: OriginId;
  genres: GenreId[];
  /**
   * Extrait et pochette chez Apple, lus directement par les navigateurs. Apple change parfois ces
   * adresses : le serveur les vérifie chaque jour et les renouvelle via l'API lookup (catalog/links.ts).
   */
  previewUrl: string;
  artworkUrl: string;
  appleUrl: string;
  /** Requête d'origine, sert de clé pour ne pas retélécharger. */
  query: string;
  /** Ce qu'iTunes a réellement renvoyé, pour vérifier les faux positifs. */
  match: {
    trackName: string;
    artistName: string;
    collectionName: string;
  };
}

export interface CatalogMiss {
  query: string;
  origin: OriginId;
  reason: string;
}
