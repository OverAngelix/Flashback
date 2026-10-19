import { AVATAR_COUNT } from "@server/game/types";

export interface Avatar {
  icon: string;
  color: string;
  label: string;
}

/** L'index dans ce tableau est l'identifiant d'avatar échangé avec le serveur (0 à AVATAR_COUNT - 1). */
export const AVATARS: readonly Avatar[] = [
  { icon: "mdi-cat", color: "#ff7675", label: "Chat" },
  { icon: "mdi-dog", color: "#fdcb6e", label: "Chien" },
  { icon: "mdi-owl", color: "#a29bfe", label: "Hibou" },
  { icon: "mdi-rabbit", color: "#fd79a8", label: "Lapin" },
  { icon: "mdi-penguin", color: "#74b9ff", label: "Manchot" },
  { icon: "mdi-panda", color: "#b2bec3", label: "Panda" },
  { icon: "mdi-bee", color: "#f9ca24", label: "Abeille" },
  { icon: "mdi-unicorn", color: "#e056fd", label: "Licorne" },
  { icon: "mdi-dolphin", color: "#00cec9", label: "Dauphin" },
  { icon: "mdi-turtle", color: "#55efc4", label: "Tortue" },
];

if (AVATARS.length !== AVATAR_COUNT) throw new Error("AVATARS doit contenir exactement AVATAR_COUNT avatars");

export const avatarOf = (index: number): Avatar => AVATARS[index] ?? AVATARS[0]!;
