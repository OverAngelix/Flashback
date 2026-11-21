/**
 * Produit les fichiers audio du commentateur (public/commentator/<id>.m4a) à partir de la banque
 * de phrases (src/commentatorLines.json). macOS uniquement (say et afconvert).
 *
 * Pour chaque phrase :
 * - un enregistrement commentator/recordings/<id>.(wav|m4a|mp3|aiff|aif|caf) est converti ;
 * - sinon une voix provisoire est générée avec `say` (voix Thomas), refaite si le texte change.
 * Un fichier déjà à jour n'est pas refait. Écrit aussi commentator/phrases.md, la liste à enregistrer.
 *
 *   npm run commentator:build              # met à jour ce qui manque ou a changé
 *   npm run commentator:build -- --force   # refait tout
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const LINES = join(ROOT, "src/commentatorLines.json");
const OUT = join(ROOT, "public/commentator");
const RECORDINGS = join(ROOT, "commentator/recordings");
const MANIFEST = join(ROOT, "commentator/manifest.json");
const VOICE = process.env.COMMENTATOR_VOICE ?? "Thomas";
const RATE = process.env.COMMENTATOR_RATE ?? "200";
const force = process.argv.includes("--force");

if (process.platform !== "darwin") throw new Error("Ce script utilise say et afconvert : macOS uniquement.");

/** @type {Record<string, { id: string; text: string }[]>} */
const bank = JSON.parse(readFileSync(LINES, "utf8"));
mkdirSync(OUT, { recursive: true });
mkdirSync(RECORDINGS, { recursive: true });
/** Origine de chaque fichier produit : { source: "say" | "<fichier d'enregistrement>", text, mtime }. */
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const recordings = new Map(
  readdirSync(RECORDINGS)
    .filter((f) => /\.(wav|m4a|mp3|aiff?|caf)$/i.test(f))
    .map((f) => [f.replace(/\.[^.]+$/, ""), f]),
);

/** Moment de la partie où chaque série de phrases est dite (voir situationFor dans src/commentator.ts). */
const MOMENTS = {
  start: "lancement de la partie",
  correct: "titre bien placé",
  close: "raté de 2 ans ou moins",
  stolen: "raté, mais un autre joueur a trouvé en groove",
  far: "raté de 20 ans ou plus",
  wrong: "autre raté",
  recap: "fin d'un tour de plateau",
  tie: "égalité en tête à l'objectif : un tour de plus",
  victory: "victoire",
};

const toM4a = (input, output) => execFileSync("afconvert", ["-f", "m4af", "-d", "aac@44100", "-b", "96000", input, output]);

const ids = new Set();
let made = 0;
let recorded = 0;
for (const [situation, lines] of Object.entries(bank)) {
  for (const { id, text } of lines) {
    if (ids.has(id)) throw new Error(`Identifiant en double : ${id}`);
    ids.add(id);
    const out = join(OUT, `${id}.m4a`);
    const prev = manifest[id];
    const rec = recordings.get(id);
    if (rec) {
      recorded++;
      const mtime = statSync(join(RECORDINGS, rec)).mtimeMs;
      if (!force && existsSync(out) && prev?.source === rec && prev.mtime === mtime) continue;
      toM4a(join(RECORDINGS, rec), out);
      manifest[id] = { situation, source: rec, text, mtime };
      console.log(`enregistrement  ${id}`);
    } else {
      if (!force && existsSync(out) && prev?.source === "say" && prev.text === text) continue;
      const tmp = join(tmpdir(), `flashback-${id}.aiff`);
      execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", tmp, text]);
      toM4a(tmp, out);
      rmSync(tmp);
      manifest[id] = { situation, source: "say", text };
      console.log(`voix provisoire ${id}`);
    }
    made++;
  }
}

// Fichiers de phrases retirées de la banque.
for (const f of readdirSync(OUT)) {
  const id = f.replace(/\.m4a$/, "");
  if (f.endsWith(".m4a") && !ids.has(id)) {
    rmSync(join(OUT, f));
    delete manifest[id];
    console.log(`retiré          ${id}`);
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

// Liste des phrases à enregistrer, à jour à chaque passage.
const rows = Object.entries(bank).flatMap(([situation, lines]) =>
  lines.map(({ id, text }) => `| ${recordings.has(id) ? "✅" : "⬜"} | \`${id}\` | ${MOMENTS[situation] ?? situation} | ${text} |`),
);
writeFileSync(
  join(ROOT, "commentator/phrases.md"),
  `# Phrases du commentateur

Fichier généré par \`npm run commentator:build\` (depuis \`client/\`) : ne pas le modifier à la main.
Les textes se changent dans \`client/src/commentatorLines.json\`.

Pour remplacer une voix provisoire : enregistrer la phrase, déposer le fichier dans
\`client/commentator/recordings/\` sous le nom de son identifiant (\`correct-1.m4a\`, \`.wav\`, \`.mp3\`,
\`.aiff\` ou \`.caf\`), puis relancer \`npm run commentator:build\`.

${recorded}/${ids.size} phrases enregistrées.

| | Identifiant | Moment | Texte |
|---|---|---|---|
${rows.join("\n")}
`,
);
console.log(`${made} fichier(s) produit(s), ${recorded}/${ids.size} phrases enregistrées.`);
