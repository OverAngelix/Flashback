import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vuetify from "vite-plugin-vuetify";

// En développement, Vite sert le client et relaie l'API, les médias et le WebSocket vers le serveur.
const server = process.env.FLASHBACK_SERVER ?? "http://localhost:3000";

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Types et constantes du protocole, partagés avec le serveur (fichiers sans dépendance Node).
      "@server": fileURLToPath(new URL("../server/src", import.meta.url)),
    },
  },
  server: {
    host: true, // joignable depuis un téléphone du réseau local
    proxy: {
      "/api": server,
      "/media": server,
      "/ws": { target: server, ws: true },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
