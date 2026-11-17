export type CategoryId = "fr" | "international";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Boutique iTunes interrogée pour cette catégorie (code pays ISO). */
  store: string;
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  fr: { id: "fr", label: "Chanson française", store: "FR" },
  international: { id: "international", label: "International", store: "US" },
};

export interface CategorySummary {
  id: CategoryId;
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
  category: CategoryId;
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
  category: CategoryId;
  reason: string;
}
