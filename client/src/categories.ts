import type { CategoryAxis } from "@server/catalog/types";

/** Icône par catégorie ; les époques n'en ont pas (leur libellé suffit). */
const ICONS: Record<string, string> = {
  fr: "mdi-microphone-variant",
  international: "mdi-earth",
  "europe-latino": "mdi-map-marker-radius",
  pop: "mdi-star-four-points",
  rock: "mdi-guitar-electric",
  metal: "mdi-skull",
  rap: "mdi-microphone",
  "rap-fr": "mdi-account-voice",
  rnb: "mdi-heart-pulse",
  disco: "mdi-disc",
  electro: "mdi-sine-wave",
  reggae: "mdi-palm-tree",
  chanson: "mdi-book-open-variant",
  folk: "mdi-guitar-acoustic",
  jazz: "mdi-saxophone",
};

export const categoryIcon = (id: string): string | undefined => ICONS[id];

export const AXES: { id: CategoryAxis; label: string }[] = [
  { id: "origin", label: "Origine" },
  { id: "era", label: "Époque" },
  { id: "genre", label: "Genre" },
];
