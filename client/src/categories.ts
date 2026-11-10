/** Icône par catégorie du catalogue ; les catégories futures retombent sur une note de musique. */
const ICONS: Record<string, string> = {
  fr: "mdi-microphone-variant",
  international: "mdi-earth",
};

export const categoryIcon = (id: string): string => ICONS[id] ?? "mdi-music";
