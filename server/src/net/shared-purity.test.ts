import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Fichiers que le client importe via l'alias @server : ils doivent tourner dans un navigateur. */
const SHARED = ["net/protocol.ts", "game/types.ts", "catalog/types.ts"];

describe("fichiers partagés avec le client", () => {
  it("n'importent aucun module Node ni aucun autre fichier du serveur", async () => {
    for (const file of SHARED) {
      const source = await readFile(resolve(SRC, file), "utf8");
      const imports = [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const spec of imports) {
        assert.ok(!spec.startsWith("node:"), `${file} importe ${spec}`);
        if (spec.startsWith(".")) {
          const target = resolve(dirname(resolve(SRC, file)), spec).replace(/\.js$/, ".ts");
          const relative = target.slice(SRC.length + 1);
          assert.ok(SHARED.includes(relative), `${file} importe ${relative}, absent de la liste partagée`);
        } else {
          assert.fail(`${file} importe le paquet ${spec}`);
        }
      }
    }
  });
});
