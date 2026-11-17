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

const entry = (id: number, category: string, withLinks: boolean) => ({
  id,
  title: `Titre ${id}`,
  artist: "Artiste",
  year: 1970 + id,
  category,
  query: `Titre ${id} - Artiste`,
  ...(withLinks ? { previewUrl: `https://audio.test/${id}.m4a`, artworkUrl: `https://img.test/${id}.jpg` } : {}),
});

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "flashback-"));
  await writeFile(
    join(dir, "catalog.json"),
    JSON.stringify([entry(1, "fr", true), entry(2, "fr", true), entry(3, "international", true), entry(4, "fr", false)]),
  );
  const { catalog } = await loadCatalog(dir);
  app = buildApp({ catalog, rooms: new RoomManager({ catalog }) });
  await app.ready();
});

after(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

describe("catalogue", () => {
  it("ignore les titres sans liens Apple et sélectionne par catégorie", async () => {
    const { catalog, skipped } = await loadCatalog(dir);
    assert.deepEqual(skipped, ["Titre 4 - Artiste"]);
    assert.equal(catalog.tracks.length, 3);
    assert.deepEqual(catalog.select(["international"]).map((t) => t.id), [3]);
    assert.equal(catalog.select(["fr", "international"]).length, 3);
    assert.deepEqual(catalog.select(["inconnue"]), []);
    // Les entrées elles-mêmes : un lien renouvelé profite aux parties en cours.
    assert.equal(catalog.select(["international"])[0], catalog.tracks[2]);
  });

  it("ne tire plus les titres marqués indisponibles", async () => {
    const { catalog } = await loadCatalog(dir);
    catalog.tracks[0]!.unavailable = true;
    assert.deepEqual(catalog.select(["fr"]).map((t) => t.id), [2]);
    assert.deepEqual(catalog.categories().map((c) => c.count), [1, 1]);
  });
});

describe("API HTTP", () => {
  it("répond sur /api/health", async () => {
    const res = await app.inject("/api/health");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok", tracks: 3, unavailable: 0, linksCheckedAt: null });
  });

  it("liste les catégories avec leur nombre de titres, sans rien révéler d'autre", async () => {
    const res = await app.inject("/api/categories");
    assert.deepEqual(res.json(), [
      { id: "fr", label: "Chanson française", count: 2 },
      { id: "international", label: "International", count: 1 },
    ]);
  });

  it("n'expose aucune route qui renvoie les titres", async () => {
    for (const url of ["/api/catalog", "/api/tracks", "/catalog.json", "/media/audio/1.m4a"]) {
      assert.equal((await app.inject(url)).statusCode, 404, url);
    }
  });
});

describe("réseau et client compilé", () => {
  it("donne les adresses du réseau local avec le port du serveur", async () => {
    const res = await app.inject("/api/network");
    assert.equal(res.statusCode, 200);
    const { urls } = res.json() as { urls: string[] };
    assert.ok(Array.isArray(urls));
    for (const url of urls) assert.match(url, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);
  });

  it("sert le client et renvoie index.html pour les routes du routeur", async () => {
    const clientDir = join(dir, "client-dist");
    await mkdir(join(clientDir, "assets"), { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>CLIENT</html>");
    await writeFile(join(clientDir, "assets/app.js"), "console.log(1)");
    const { catalog } = await loadCatalog(dir);
    const withClient = buildApp({ catalog, rooms: new RoomManager({ catalog }), clientDir });
    await withClient.ready();
    try {
      assert.match((await withClient.inject("/")).payload, /CLIENT/);
      assert.match((await withClient.inject("/host")).payload, /CLIENT/);
      assert.match((await withClient.inject("/join/ABC234")).payload, /CLIENT/);
      assert.equal((await withClient.inject("/assets/app.js")).payload, "console.log(1)");
      // Une recompilation du client crée de nouveaux fichiers sans redémarrer le serveur.
      await writeFile(join(clientDir, "assets/nouveau-hash.js"), "console.log(2)");
      assert.equal((await withClient.inject("/assets/nouveau-hash.js")).payload, "console.log(2)");
      // Ni les API, ni un fichier manquant ne retombent sur la page d'accueil.
      for (const url of ["/api/inconnu", "/assets/manquant.js"]) {
        const res = await withClient.inject(url);
        assert.equal(res.statusCode, 404, url);
        assert.doesNotMatch(res.payload, /CLIENT/, url);
      }
      // Toujours aucune fuite du catalogue.
      assert.equal((await withClient.inject("/catalog.json")).payload.includes("Titre 1"), false);
      assert.equal((await withClient.inject("/api/categories")).statusCode, 200);
    } finally {
      await withClient.close();
    }
  });
});
