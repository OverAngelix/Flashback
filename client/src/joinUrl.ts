export interface LocationLike {
  protocol: string;
  hostname: string;
  port: string;
  origin: string;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Adresse de base que les téléphones doivent utiliser. L'hôte ouvre souvent la page sur
 * localhost, qu'un téléphone ne peut pas joindre : on prend alors l'adresse du réseau local
 * donnée par le serveur, en gardant le port de la page (celui de Vite en développement).
 */
export function joinBase(loc: LocationLike, networkUrls: readonly string[]): string {
  if (!LOOPBACK.has(loc.hostname)) return loc.origin;
  const lan = networkUrls[0];
  if (!lan) return loc.origin;
  return `${loc.protocol}//${new URL(lan).hostname}${loc.port ? `:${loc.port}` : ""}`;
}

/** Lien direct vers une salle : le formulaire d'entrée s'ouvre avec le code déjà rempli. */
export const joinLink = (base: string, code: string): string => `${base}/join/${code}`;
