import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { loadCatalog } from "../catalog/store.js";
import { RoomManager } from "../rooms/manager.js";
import { buildApp } from "./app.js";

let dir: string;
let app: FastifyInstance;

const entry = (id: number, category: string, withFiles: boolean) => ({
  id,
  title: `Titre ${id}`,
  artist: "Artiste",
  year: 1970 + id,
  category,
  query: `Titre ${id} - Artiste`,
  ...(withFiles ? { audioFile: `audio/${id}.m4a`, imageFile: `images/${id}.jpg` } : {}),
});

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "flashback-"));
  await mkdir(join(dir, "media/audio"), { recursive: true });
  await mkdir(join(dir, "media/images"), { recursive: true });
  await writeFile(
    join(dir, "catalog.json"),
    JSON.stringify([entry(1, "fr", true), entry(2, "fr", true), entry(3, "international", true), entry(4, "fr", false)]),
  );
  for (const id of [1, 2, 3]) {
    await writeFile(join(dir, `media/audio/${id}.m4a`), Buffer.alloc(1000, id));
    await writeFile(join(dir, `media/images/${id}.jpg`), Buffer.alloc(100, id));
  }
  const { catalog } = await loadCatalog(dir);
  app = buildApp({ catalog, rooms: new RoomManager({ catalog }), dataDir: dir });
  await app.ready();
});

after(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe("catalogue", () => {
  it("ignore les titres sans médias et sélectionne par catégorie", async () => {
    const { catalog, skipped } = await loadCatalog(dir);
    assert.deepEqual(skipped, ["Titre 4 - Artiste"]);
    assert.equal(catalog.tracks.length, 3);
    assert.deepEqual(catalog.select(["international"]).map((t) => t.id), [3]);
    assert.equal(catalog.select(["fr", "international"]).length, 3);
    assert.deepEqual(catalog.select(["inconnue"]), []);
    assert.equal("category" in catalog.select(["fr"])[0]!, false);
  });
});

describe("API HTTP", () => {
  it("répond sur /api/health", async () => {
    const res = await app.inject("/api/health");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok", tracks: 3 });
  });

  it("liste les catégories avec leur nombre de titres, sans rien révéler d'autre", async () => {
    const res = await app.inject("/api/categories");
    assert.deepEqual(res.json(), [
      { id: "fr", label: "Chanson française", count: 2 },
      { id: "international", label: "International", count: 1 },
    ]);
  });

  it("n'expose aucune route qui renvoie les titres", async () => {
    for (const url of ["/api/catalog", "/api/tracks", "/catalog.json", "/media/../catalog.json"]) {
      assert.equal((await app.inject(url)).statusCode, 404, url);
    }
  });

  it("sert les extraits et les pochettes", async () => {
    const audio = await app.inject("/media/audio/1.m4a");
    assert.equal(audio.statusCode, 200);
    assert.equal(audio.rawPayload.length, 1000);
    assert.match(String(audio.headers["content-type"]), /^audio\//);
    const image = await app.inject("/media/images/2.jpg");
    assert.equal(image.statusCode, 200);
    assert.match(String(image.headers["content-type"]), /^image\/jpeg/);
  });

  it("gère les requêtes Range (lecture audio sur Safari et iOS)", async () => {
    const res = await app.inject({ url: "/media/audio/1.m4a", headers: { range: "bytes=0-99" } });
    assert.equal(res.statusCode, 206);
    assert.equal(res.rawPayload.length, 100);
    assert.equal(res.headers["content-range"], "bytes 0-99/1000");
  });

  it("ne liste pas le contenu des dossiers", async () => {
    for (const url of ["/media/", "/media/audio/"]) {
      const res = await app.inject(url);
      assert.ok([403, 404].includes(res.statusCode), `${url} : ${res.statusCode}`);
      assert.doesNotMatch(res.payload, /1\.m4a/);
    }
  });
});
