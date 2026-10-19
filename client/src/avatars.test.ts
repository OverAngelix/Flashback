import { describe, expect, it } from "vitest";
import { AVATAR_COUNT } from "@server/game/types";
import { AVATARS, avatarOf } from "./avatars";

describe("avatars", () => {
  it("en propose autant que le serveur en accepte, tous distincts", () => {
    expect(AVATARS).toHaveLength(AVATAR_COUNT);
    expect(new Set(AVATARS.map((a) => a.icon)).size).toBe(AVATAR_COUNT);
    expect(new Set(AVATARS.map((a) => a.color)).size).toBe(AVATAR_COUNT);
  });
  it("retombe sur le premier avatar pour un index inconnu", () => {
    expect(avatarOf(99)).toBe(AVATARS[0]);
  });
});
