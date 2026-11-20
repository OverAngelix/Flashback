import { useRouter } from "vue-router";
import type { ClientMessage } from "@server/net/protocol";
import { useConnection } from "@/net/connection";
import { useSettings } from "@/settings";

/** Nom du joueur seul : celui des réglages, sinon un nom par défaut (personne d'autre ne le voit). */
const SOLO_NAME = "Toi";

/**
 * Lance une partie solo et ouvre son écran. `then` : messages à envoyer juste après la création (par
 * exemple les catégories et le lancement, pour rejouer une partie libre) ; ils partent dans l'ordre.
 */
export function useSoloStart() {
  const connection = useConnection();
  const settings = useSettings();
  const router = useRouter();
  return (level: string | null, then: ClientMessage[] = []) => {
    connection.createSolo(level, settings.playerName || SOLO_NAME, 0);
    for (const message of then) connection.send(message);
    void router.push("/solo/play");
  };
}
