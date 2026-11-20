import type { CategoryId } from "../catalog/types.js";

/**
 * Ce fichier est aussi importé par le client (alias @server) : il ne doit dépendre que des autres
 * fichiers partagés (voir shared-purity.test.ts).
 */

/**
 * Un niveau de campagne : un thème (catégories, avec la règle habituelle de sélection) et une frise à
 * réunir. Les titres sont tirés au sort à chaque essai. On joue avec SOLO_LIVES vies ; il reste au
 * joueur une étoile par vie encore en poche quand il atteint l'objectif.
 */
export interface CampaignLevel {
  id: string;
  title: string;
  description: string;
  categories: readonly CategoryId[];
  /** Nombre de cartes de la frise à atteindre, carte de départ comprise. */
  goal: number;
}

/**
 * Du plus facile au plus dur : d'abord des thèmes larges (les années sont espacées) et des frises
 * courtes, puis des époques resserrées et des frises plus longues. Chaque niveau garde assez de
 * titres pour être rejoué (vérifié par campaign.test.ts sur le vrai catalogue).
 */
export const CAMPAIGN: readonly CampaignLevel[] = [
  { id: "premiers-pas", title: "Premiers pas", description: "Les tubes français, toutes époques.", categories: ["fr"], goal: 5 },
  { id: "tour-du-monde", title: "Tour du monde", description: "Les tubes internationaux, toutes époques.", categories: ["international"], goal: 5 },
  { id: "pop", title: "Pop", description: "Les refrains que tout le monde connaît.", categories: ["pop"], goal: 6 },
  { id: "guitares", title: "Guitares", description: "Rock, metal et hard rock.", categories: ["rock", "metal"], goal: 6 },
  { id: "hip-hop", title: "Hip-hop", description: "Rap, rap français, R&B, soul et funk.", categories: ["rap", "rap-fr", "rnb"], goal: 6 },
  { id: "dancefloor", title: "Dancefloor", description: "Disco, électro et dance.", categories: ["disco", "electro"], goal: 7 },
  { id: "europe-latino", title: "Europe & Latino", description: "Hors de France et des pays anglophones.", categories: ["europe-latino"], goal: 7 },
  { id: "retro", title: "Rétro", description: "Tout ce qui précède les années 80.", categories: ["era-1960", "era-1970"], goal: 7 },
  { id: "annees-80-90", title: "Années 80 et 90", description: "Vingt ans, des années bien plus proches.", categories: ["era-1980", "era-1990"], goal: 8 },
  { id: "nouveau-siecle", title: "Nouveau siècle", description: "Des années 2000 à aujourd'hui.", categories: ["era-2000", "era-2010", "era-2020"], goal: 8 },
  { id: "annees-80", title: "Années 80", description: "Une seule décennie : à l'année près.", categories: ["era-1980"], goal: 8 },
  { id: "grand-final", title: "Grand final", description: "Tout le catalogue, la plus longue frise.", categories: [], goal: 10 },
];

export const campaignLevel = (id: string): CampaignLevel | undefined => CAMPAIGN.find((l) => l.id === id);
