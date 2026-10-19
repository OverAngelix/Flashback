import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { DEFAULT_DATA_DIR, loadCatalog } from "./catalog/store.js";
import { buildApp } from "./http/app.js";
import { RoomManager } from "./rooms/manager.js";

const port = Number(process.env.PORT ?? 3000);

const { catalog, skipped } = await loadCatalog();
if (skipped.length > 0) {
  console.warn(`${skipped.length} titre(s) ignoré(s), médias manquants (lancer npm run catalog:download) :`);
  for (const q of skipped) console.warn(`  - ${q}`);
}

const rooms = new RoomManager({ catalog });
const clientDir = resolve(DEFAULT_DATA_DIR, "../../client/dist");
if (!existsSync(clientDir)) console.warn("client/dist absent : lancer npm run build dans client/ (ou utiliser le serveur de dev Vite).");
const app = buildApp({ catalog, rooms, dataDir: DEFAULT_DATA_DIR, clientDir, logger: true });
setInterval(() => rooms.sweep(), 60_000).unref();
// 0.0.0.0 : les téléphones du réseau local doivent pouvoir joindre le serveur.
await app.listen({ port, host: "0.0.0.0" });

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`${catalog.tracks.length} titres chargés. Joignable sur ${["http://localhost:" + port, ...lan].join(" ou ")}`);
