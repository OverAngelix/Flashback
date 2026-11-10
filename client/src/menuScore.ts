/**
 * Partition de la musique de menu : un morceau « d'ascenseur » (lounge), généré en continu.
 * Module pur, sans audio : il produit des événements de notes que menuMusic.ts joue.
 *
 * Grille de 8 mesures qui boucle : Cmaj7 · Am7 · Dm7 · G7 · Em7 · A7 · Dm7 · G7 (4 temps, swing léger).
 */
export type Voice = "keys" | "bass" | "bell" | "hat" | "brush";

export interface NoteEvent {
  voice: Voice;
  /** Position dans la mesure, en temps (0 inclus à 4 exclu). */
  beat: number;
  /** Durée en temps. */
  dur: number;
  /** Hauteur MIDI (absente pour les percussions). */
  midi?: number;
  /** Intensité de 0 à 1. */
  vel: number;
}

export const BPM = 80;
export const BAR_BEATS = 4;
/** Place de la croche « levée » dans le temps : 0,5 = droit, 0,667 = swing ternaire. */
export const SWING = 0.6;

export interface Chord {
  name: string;
  /** Basse, MIDI (octave 2-3). */
  root: number;
  /** Accord joué par le piano électrique, MIDI. */
  keys: number[];
}

export const PROGRESSION: readonly Chord[] = [
  { name: "Cmaj7", root: 48, keys: [60, 64, 67, 71] },
  { name: "Am7", root: 45, keys: [57, 60, 64, 67] },
  { name: "Dm7", root: 50, keys: [62, 65, 69, 72] },
  { name: "G7", root: 43, keys: [59, 62, 65, 69] },
  { name: "Em7", root: 40, keys: [59, 62, 64, 67] },
  { name: "A7", root: 45, keys: [57, 61, 64, 67] },
  { name: "Dm7", root: 50, keys: [62, 65, 69, 72] },
  { name: "G7", root: 43, keys: [59, 62, 65, 69] },
];

/** Gamme pentatonique de do majeur, utilisée pour les notes de vibraphone. */
const PENTATONIC = [0, 2, 4, 7, 9];
const BELL_LOW = 72;
const BELL_HIGH = 88;

/** Position, en temps, de la croche n (0 à 7) d'une mesure, avec le swing. */
export const eighth = (n: number): number => Math.floor(n / 2) + (n % 2 === 1 ? SWING : 0);

/** Générateur pseudo-aléatoire reproductible (mulberry32), pour des tests et un rendu déterministes. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chordAt = (bar: number): Chord => PROGRESSION[((bar % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]!;

/** Notes de la mesure `bar` (0, 1, 2…). `rng` décide des variations : même graine, même musique. */
export function composeBar(bar: number, rng: () => number): NoteEvent[] {
  const chord = chordAt(bar);
  const next = chordAt(bar + 1);
  const events: NoteEvent[] = [];

  // Piano électrique : l'accord posé sur le premier temps, une anticipation, parfois un coup léger.
  const hit = (beat: number, dur: number, vel: number) =>
    chord.keys.forEach((midi, i) => events.push({ voice: "keys", beat: beat + i * 0.012, dur, midi, vel: vel * (0.92 + rng() * 0.16) }));
  hit(0, 2.6, 0.6);
  hit(eighth(5), 0.7, 0.42);
  if (bar % 2 === 1 || rng() < 0.3) hit(eighth(3), 0.6, 0.34);

  // Basse : la fondamentale, puis la quinte ou l'octave, et parfois une note d'approche vers l'accord suivant.
  events.push({ voice: "bass", beat: 0, dur: 1.7, midi: chord.root, vel: 0.75 });
  events.push({ voice: "bass", beat: 2, dur: 1.4, midi: bar % 2 === 0 ? chord.root + 7 : chord.root + 12, vel: 0.6 });
  if (rng() < 0.5) events.push({ voice: "bass", beat: eighth(7), dur: 0.45, midi: next.root - 1, vel: 0.5 });

  // Rythmique : un shaker sur les croches, des balais sur les temps 2 et 4.
  for (let n = 0; n < 8; n++) events.push({ voice: "hat", beat: eighth(n), dur: 0.1, vel: n % 2 === 1 ? 0.3 : 0.17 });
  events.push({ voice: "brush", beat: 1, dur: 0.3, vel: 0.28 });
  events.push({ voice: "brush", beat: 3, dur: 0.3, vel: 0.28 });

  // Vibraphone : quelques notes éparses, de préférence celles de l'accord, jamais deux fois la même d'affilée.
  const pool = [...chord.keys.map((m) => m + 12), ...[0, 1].flatMap((o) => PENTATONIC.map((s) => 60 + 12 + o * 12 + s))].filter((m) => m >= BELL_LOW && m <= BELL_HIGH);
  let last = -1;
  let count = 0;
  for (let n = 1; n < 8 && count < 4; n++) {
    if (rng() > 0.27) continue;
    const midi = pool[Math.floor(rng() * pool.length)]!;
    if (midi === last) continue;
    last = midi;
    count++;
    events.push({ voice: "bell", beat: eighth(n), dur: 0.9 + rng() * 0.8, midi, vel: 0.3 + rng() * 0.14 });
  }

  return events.sort((a, b) => a.beat - b.beat);
}
