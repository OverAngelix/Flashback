import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { watchLinks } from "./catalog/links.js";
import { DEFAULT_DATA_DIR, loadCatalog } from "./catalog/store.js";
import { buildApp } from "./http/app.js";
import { RoomManager } from "./rooms/manager.js";

const port = Number(process.env.PORT ?? 3000);

const { catalog, skipped } = await loadCatalog();
if (skipped.length > 0) {
  console.warn(`${skipped.length} titre(s) ignoré(s), sans adresse d'extrait ou de pochette (relancer npm run catalog:build) :`);
  for (const q of skipped) console.warn(`  - ${q}`);
}

const rooms = new RoomManager({ catalog });
const clientDir = resolve(DEFAULT_DATA_DIR, "../../client/dist");
if (!existsSync(clientDir)) console.warn("client/dist absent : lancer npm run build dans client/ (ou utiliser le serveur de dev Vite).");
// Extraits et pochettes sont lus chez Apple : leurs adresses sont vérifiées au démarrage puis chaque jour.
const links = watchLinks(catalog);
const app = buildApp({ catalog, rooms, links: links.state, clientDir, logger: true });
setInterval(() => rooms.sweep(), 60_000).unref();
// 0.0.0.0 : les téléphones du réseau local doivent pouvoir joindre le serveur.
await app.listen({ port, host: "0.0.0.0" });

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`${catalog.tracks.length} titres chargés. Joignable sur ${["http://localhost:" + port, ...lan].join(" ou ")}`);
