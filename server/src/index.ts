import { networkInterfaces } from "node:os";
import { DEFAULT_DATA_DIR, loadCatalog } from "./catalog/store.js";
import { buildApp } from "./http/app.js";

const port = Number(process.env.PORT ?? 3000);

const { catalog, skipped } = await loadCatalog();
if (skipped.length > 0) {
  console.warn(`${skipped.length} titre(s) ignoré(s), médias manquants (lancer npm run catalog:download) :`);
  for (const q of skipped) console.warn(`  - ${q}`);
}

const app = buildApp({ catalog, dataDir: DEFAULT_DATA_DIR, logger: true });
// 0.0.0.0 : les téléphones du réseau local doivent pouvoir joindre le serveur.
await app.listen({ port, host: "0.0.0.0" });

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => `http://${i!.address}:${port}`);
console.log(`${catalog.tracks.length} titres chargés. Joignable sur ${["http://localhost:" + port, ...lan].join(" ou ")}`);
