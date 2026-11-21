/**
 * Nouveautés affichées à l'arrivée sur le menu, une fois par version.
 *
 * Chaque version liste des éléments identifiés par `id`. Un nouveau venu voit la présentation
 * complète : tous les éléments de toutes les versions, la dernière formulation d'un même `id`
 * l'emportant (« Plus de 1 500 musiques » remplace « Plus de 1 200 musiques »). Un joueur qui a déjà
 * vu une version ne voit que les versions suivantes, avec la formulation `update` quand elle existe
 * (« 300 musiques en plus »).
 *
 * Pour publier une version, l'ajouter à la fin de RELEASES, par exemple :
 *
 *   { version: "1.1", items: [
 *     { id: "catalog", icon: "mdi-music-box-multiple", title: "Plus de 1 500 musiques",
 *       text: "Des tubes de toutes les époques…", update: "300 musiques en plus, …" },
 *   ] }
 */
export interface NewsItem {
  /** Identifiant stable : une version suivante qui reprend le même `id` remplace l'élément. */
  id: string;
  /** Icône `mdi-*`, ou « disco » pour la boule disco des points groove. */
  icon: string;
  title: string;
  /** Formulation complète, pour un nouveau venu. */
  text: string;
  /** Formulation pour qui a vu une version précédente ; `text` par défaut. */
  updateTitle?: string;
  update?: string;
}

export interface Release {
  /** « 1.0 », « 1.1 », « 2.0 »… comparées nombre par nombre. */
  version: string;
  items: readonly NewsItem[];
}

/** De la plus ancienne à la plus récente. */
export const RELEASES: readonly Release[] = [
  {
    version: "1.0",
    items: [
      {
        id: "catalog",
        icon: "mdi-music-box-multiple",
        title: "Plus de 1 200 musiques",
        text: "Des tubes de toutes les époques, à choisir par origine, époque et genre.",
      },
      {
        id: "host",
        icon: "mdi-television-play",
        title: "Mode hébergé",
        text: "La télé ou le PC joue l'extrait, chacun rejoint la partie avec son téléphone.",
      },
      {
        id: "groove",
        icon: "disco",
        title: "Groove",
        text: "Pendant le tour des autres, place le titre toi aussi pour gagner des points groove.",
      },
      {
        id: "solo",
        icon: "mdi-account-music",
        title: "Mode solo avec campagne",
        text: "Une partie libre avec 3 vies, ou une campagne de 12 niveaux à étoiles.",
      },
    ],
  },
];

export interface NewsSection {
  version: string;
  items: { icon: string; title: string; text: string }[];
}

export interface News {
  /** Dernière version : celle à mémoriser une fois la modale fermée. */
  version: string;
  /** Vrai pour un nouveau venu (présentation complète), faux pour les nouveautés seules. */
  welcome: boolean;
  /** Une seule section pour un nouveau venu ; sinon une par version manquée, la plus récente d'abord. */
  sections: NewsSection[];
}

const parseVersion = (v: string): number[] | null => (/^\d+(\.\d+)*$/.test(v) ? v.split(".").map(Number) : null);

/** Compare deux versions valides nombre par nombre (« 1.10 » après « 1.9 », « 1.0 » égale « 1 »). */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a) ?? [];
  const pb = parseVersion(b) ?? [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/**
 * Ce qu'il faut montrer à qui a vu la version `seen` (null : jamais rien vu ; une valeur illisible
 * compte pareil). Null s'il n'y a rien de nouveau.
 */
export function newsFor(seen: string | null, releases: readonly Release[] = RELEASES): News | null {
  const latest = releases.at(-1);
  if (!latest) return null;
  const known = seen !== null && parseVersion(seen) !== null;
  if (known && compareVersions(seen, latest.version) >= 0) return null;

  if (!known) {
    // Ordre de première apparition, formulation la plus récente.
    const merged = new Map<string, NewsItem>();
    for (const release of releases) for (const item of release.items) merged.set(item.id, item);
    const items = [...merged.values()].map(({ icon, title, text }) => ({ icon, title, text }));
    return { version: latest.version, welcome: true, sections: [{ version: latest.version, items }] };
  }

  const sections = releases
    .filter((r) => compareVersions(r.version, seen) > 0)
    .reverse()
    .map((r) => ({
      version: r.version,
      items: r.items.map((i) => ({ icon: i.icon, title: i.updateTitle ?? i.title, text: i.update ?? i.text })),
    }));
  return { version: latest.version, welcome: false, sections };
}

const KEY = "flashback.news";

type Store = Pick<Storage, "getItem" | "setItem">;

function storage(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Dernière version vue dans ce navigateur (null si aucune ou stockage refusé). */
export function seenVersion(store: Store | null = storage()): string | null {
  try {
    return store?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

/** Note la version comme vue : la modale ne revient qu'à la version suivante. */
export function markSeen(version: string, store: Store | null = storage()): void {
  try {
    store?.setItem(KEY, version);
  } catch {
    // Stockage plein ou interdit : la modale reviendra à la prochaine visite.
  }
}
