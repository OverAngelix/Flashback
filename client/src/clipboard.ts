/** Ce dont `copyText` a besoin du navigateur : injecté dans les tests. */
export interface ClipboardEnv {
  /** `navigator.clipboard`, qui n'existe qu'en contexte sécurisé (https, localhost). */
  clipboard?: { writeText(text: string): Promise<void> };
  /** Copie à l'ancienne (zone de texte sélectionnée, `execCommand("copy")`), seule possible en http. */
  legacyCopy?: (text: string) => boolean;
}

/**
 * Copie un texte dans le presse-papiers. Une page ouverte sur l'adresse du réseau local
 * (http://192.168…) n'a pas `navigator.clipboard` : on passe alors par la copie à l'ancienne.
 * Renvoie false si rien n'a marché (l'appelant montre le texte pour une copie à la main).
 */
export async function copyText(text: string, env: ClipboardEnv = browserEnv()): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refusée, page sans le focus… : on tente l'autre voie.
    }
  }
  try {
    return env.legacyCopy?.(text) ?? false;
  } catch {
    return false;
  }
}

function browserEnv(): ClipboardEnv {
  return { clipboard: window.isSecureContext ? navigator.clipboard : undefined, legacyCopy };
}

function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } finally {
    area.remove();
  }
}
