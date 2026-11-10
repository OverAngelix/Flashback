/**
 * Test de bout en bout : un écran hôte et deux téléphones (paysage) jouent un tour complet dans un
 * vrai Chrome, contre le vrai serveur et le vrai catalogue.
 *
 * Prérequis : `npm run build` dans server/ et dans client/, et un Chrome installé
 * (CHROME_PATH pour un chemin non standard). Lancer : `npm test` dans e2e/.
 * Les captures d'écran sont écrites dans e2e/shots/ (ignoré par git).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

const ROOT = new URL("../", import.meta.url).pathname;
const PORT = process.env.E2E_PORT ?? "3399";
const BASE = `http://localhost:${PORT}`;
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!CHROME) throw new Error("Chrome introuvable : définir CHROME_PATH.");
for (const f of ["server/dist/index.js", "client/dist/index.html"]) {
  if (!existsSync(ROOT + f)) throw new Error(`${f} absent : lancer npm run build dans server/ et client/.`);
}

// Le vrai serveur, sur un port dédié.
const server = spawn("node", ["dist/index.js"], { cwd: ROOT + "server", env: { ...process.env, PORT } });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Le serveur n'a pas démarré.")), 10000);
  server.stdout.on("data", (d) => String(d).includes("titres chargés") && (clearTimeout(timer), resolve()));
  server.on("exit", (c) => reject(new Error(`Le serveur s'est arrêté (code ${c}).`)));
});

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const logs = [];
const pages = {};
const steps = [];
const ok = (name) => { steps.push("✓ " + name); console.log("✓ " + name); };

async function newPage(label, viewport) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  pages[label] = page;
  page.on("pageerror", (e) => logs.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`[${label}] ${m.type()}: ${m.text()}`); });
  await page.evaluateOnNewDocument(() => {
    window.__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); window.__lastAudio = this; return orig.call(this); };
  });
  return page;
}
const sel = (id) => `[data-testid="${id}"]`;
const text = (page, s) => page.$eval(s, (e) => e.textContent.trim());
const shot = async (page, name) => { await new Promise((r) => setTimeout(r, 900)); return page.screenshot({ path: OUT + name + ".png" }); };
const overflow = (page) =>
  page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
async function assertFits(page, label, { vertical = false } = {}) {
  const o = await overflow(page);
  if (o.x > 1) throw new Error(`${label} : déborde de ${o.x}px sur la largeur`);
  if (vertical && o.y > 1) throw new Error(`${label} : déborde de ${o.y}px sur la hauteur`);
}
const titles = (page) => page.$$eval(".track-card .title", (els) => els.map((e) => e.textContent.trim()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phone = { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

try {
  const host = await newPage("hôte", { width: 1280, height: 720 });
  await host.goto(BASE);
  await shot(host, "01-home");
  const [createBtn] = await host.$$("xpath/.//button[contains(., 'Créer une partie')]");
  await createBtn.click();
  await host.waitForSelector(sel("room-code"));
  const code = await text(host, sel("room-code"));
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error("code invalide: " + code);
  ok(`hôte : salle créée, code ${code}`);
  ok(`hôte : adresse affichée ${await text(host, sel("join-url"))}`);

  // Le formulaire d'entrée ne doit jamais déborder, même sur un petit téléphone en portrait.
  for (const [w, h] of [[390, 844], [360, 640], [320, 568]]) {
    const p = await newPage(`portrait-${w}`, { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await p.goto(`${BASE}/join/${code}`);
    await p.waitForSelector(sel("name-input"));
    await assertFits(p, `formulaire d'entrée à ${w}px`);
    if (w === 360) await shot(p, "02b-join-portrait-360");
    await p.close();
  }
  ok("formulaire d'entrée : aucun débordement horizontal à 390, 360 et 320 px de large");

  async function join(label, name, avatar, viewport = phone) {
    const p = await newPage(label, viewport);
    await p.goto(`${BASE}/join/${code}`);
    await p.waitForSelector(sel("name-input") + " input");
    await p.type(sel("name-input") + " input", name);
    await p.waitForSelector(sel(`avatar-${avatar}`) + ":not([disabled])");
    await p.click(sel(`avatar-${avatar}`));
    await p.waitForFunction(() => !document.querySelector('[data-testid="join"]').disabled);
    return p;
  }
  const ana = await join("Ana", "Ana", 0);
  await shot(ana, "02-join-form");
  await assertFits(ana, "formulaire d'entrée en paysage");
  await ana.click(sel("join"));
  await ana.waitForFunction(() => document.body.innerText.includes("En attente du lancement"));
  ok("Ana : a rejoint, salon affiché");

  // Le QR code affiché sur l'écran hôte est lu comme le ferait un téléphone, puis suivi par Ben.
  await host.waitForSelector(sel("qr"));
  await sleep(300);
  const qrEl = await host.$(sel("qr"));
  const png = PNG.sync.read(await qrEl.screenshot());
  const qrLink = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  if (!qrLink || !qrLink.endsWith(`/join/${code}`)) throw new Error(`QR code illisible ou incorrect : ${qrLink}`);
  if ((await qrEl.evaluate((e) => e.dataset.joinUrl)) !== qrLink) throw new Error("le QR code ne correspond pas au lien annoncé");
  const { urls } = await (await fetch(`${BASE}/api/network`)).json();
  if (urls.length > 0 && /localhost|127\.0\.0\.1/.test(qrLink)) throw new Error("le QR code pointe vers localhost, injoignable depuis un téléphone");
  ok(`hôte : le QR code se lit et mène à ${qrLink.replace(/\/join\/.*/, "")}/join/${code}`);

  // Avatar 0 pris : Ben ne peut pas le choisir
  const ben = await newPage("Ben", phone);
  await ben.goto(qrLink);
  await ben.waitForSelector(sel("avatar-0") + "[disabled]");
  ok("Ben : arrivé par le QR code, code pré-rempli ; l'avatar d'Ana est grisé");
  await ben.type(sel("name-input") + " input", "Ben");
  await ben.click(sel("avatar-1"));
  await ben.click(sel("join"));
  await ben.waitForFunction(() => document.body.innerText.includes("En attente du lancement"));
  ok("Ben : a rejoint");

  await host.waitForFunction(() => document.body.innerText.includes("Joueurs (2)"));
  await host.click(sel("category-fr"));
  await host.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
  await shot(host, "03-host-lobby");
  await host.click(sel("start"));
  ok("hôte : partie lancée");

  await ana.waitForSelector(sel("play-extract"));
  await shot(ana, "04-ana-turn");
  await host.waitForFunction(() => document.body.innerText.includes("lance l'extrait"));
  await shot(host, "05-host-waiting");
  ok("Ana : c'est son tour ; l'hôte l'attend");

  // Ben ne voit pas le bouton d'écoute
  if (await ben.$(sel("play-extract"))) throw new Error("Ben ne devrait pas pouvoir écouter");
  ok("Ben : pas de bouton d'écoute hors de son tour");

  // Chacun voit sa propre frise : l'écran montre celle d'Ana, le téléphone de Ben la sienne.
  const anaStart = await titles(host);
  const benStart = await titles(ben);
  if (anaStart.length === 0 || benStart.length === 0) throw new Error("frise introuvable");
  if (benStart.some((t) => anaStart.includes(t))) throw new Error("Ben voit la frise du joueur actif");
  const benText = await ben.evaluate(() => document.body.innerText);
  if (!benText.includes("Ta frise") || !benText.includes("Ana réfléchit")) throw new Error("écran d'attente de Ben incorrect");
  ok("Ben : voit sa propre frise pendant le tour d'Ana (celle d'Ana est sur l'écran)");

  // Petit téléphone en paysage (barre du navigateur comprise) : tout doit tenir, boutons compris.
  await ana.setViewport({ width: 740, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(300);
  const boxes = await ana.evaluate(() =>
    ["play-extract", "place"].map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      return { id, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }),
  );
  for (const b of boxes) {
    if (b.top < 0 || b.bottom > 300 || b.left < 0 || b.right > 740) throw new Error(`bouton ${b.id} hors de l'écran (740x300) : ${JSON.stringify(b)}`);
  }
  await assertFits(ana, "tour du joueur à 740x300", { vertical: true });
  await shot(ana, "04b-ana-turn-740x300");
  ok("Ana : à 740x300, « Écouter » et « Placer ici » sont visibles, sans défilement");
  await ana.setViewport(phone);

  if (!(await host.evaluate(() => document.querySelector('[data-testid="turn-status"]').textContent.includes("lance l'extrait")))) throw new Error("l'hôte devrait attendre l'écoute");
  await ana.click(sel("play-extract"));
  await host.waitForFunction(() => window.__plays.some((u) => u.includes("/media/audio/")));
  const played = await host.evaluate(() => window.__plays.filter((u) => u.includes("/media/audio/")).at(-1));
  ok(`hôte : joue l'extrait ${played.replace(BASE, "")}`);
  const audioRes = await fetch(played);
  if (audioRes.status !== 200) throw new Error("extrait introuvable " + audioRes.status);
  ok("l'extrait est bien servi (200)");

  // Une seule écoute par tour : le bouton se désactive et le son n'est joué qu'une fois.
  await ana.waitForFunction(() => document.querySelector('[data-testid="play-extract"]').disabled);
  await ana.click(sel("play-extract")).catch(() => {});
  await sleep(300);
  const playsCount = await host.evaluate(() => window.__plays.filter((u) => u.includes("/media/audio/")).length);
  if (playsCount !== 1) throw new Error(`l'extrait a été joué ${playsCount} fois`);
  ok("Ana : « Écouter » est désactivé après l'écoute, l'extrait n'est joué qu'une fois");

  // Pendant l'extrait, puis à la fin de la musique : l'écran hôte suit.
  await host.evaluate(() => window.__lastAudio.dispatchEvent(new Event("playing")));
  await host.waitForFunction(() => document.querySelector('[data-testid="turn-status"]').textContent.includes("Écoute"));
  await host.evaluate(() => window.__lastAudio.dispatchEvent(new Event("ended")));
  await host.waitForFunction(() => document.querySelector('[data-testid="turn-status"]').textContent.includes("place le titre dans sa frise"));
  ok("hôte : à la fin de l'extrait, l'écran indique que le joueur doit placer son titre");

  // Ana place en position 0
  await ana.click(sel("place") + "[disabled]").catch(() => {});
  await ana.click(".slot");
  await ana.waitForFunction(() => !document.querySelector('[data-testid="place"]').disabled);
  await shot(ana, "06-ana-slot");
  await ana.click(sel("place"));
  await host.waitForSelector(sel("advance"));
  await shot(host, "07-host-reveal");
  const revealText = await host.evaluate(() => document.body.innerText);
  if (!/Bien joué|Raté/.test(revealText)) throw new Error("pas de résultat");
  ok("hôte : révélation affichée (" + (revealText.includes("Bien joué") ? "bien joué" : "raté") + ")");
  await ben.waitForFunction(() => document.body.innerText.includes("En attente de l'écran"));
  await ben.setViewport({ width: 740, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(300);
  await assertFits(ben, "révélation à 740x300", { vertical: true });
  await shot(ben, "08-ben-reveal");
  const benReveal = await titles(ben);
  if (benReveal.includes(anaStart[0])) throw new Error("la révélation montre la frise d'Ana sur le téléphone de Ben");
  if (!(await ben.evaluate(() => document.body.innerText.includes("Ta frise")))) throw new Error("« Ta frise » absent de la révélation de Ben");
  ok("Ben : la révélation tient à 740x300 et montre sa frise, pas celle d'Ana");
  await ben.setViewport(phone);

  // Double clic sur « Continuer » : le second message doit être ignoré, pas faire sauter un tour.
  // Deux clics dans la même tâche JS : le second part avant que l'écran ait changé (déterministe).
  await host.evaluate((q) => {
    const b = document.querySelector(q);
    b.click();
    b.click();
  }, sel("advance"));
  await ben.waitForSelector(sel("play-extract"));
  await new Promise((r) => setTimeout(r, 400));
  if (await host.$(sel("advance"))) throw new Error("le double clic a fait avancer deux fois");
  if (await host.evaluate(() => document.body.innerText.includes("Rien à faire avancer"))) {
    throw new Error("le message en double a produit une erreur au lieu d'être ignoré");
  }
  ok("hôte : un double clic sur Continuer est ignoré sans erreur ; c'est le tour de Ben");
  await ben.click(sel("play-extract"));
  await ben.click(".slot");
  await ben.click(sel("place"));
  await host.waitForSelector(sel("advance"));
  // Fin de tour de plateau : un double clic ne doit pas faire sauter le récapitulatif.
  await host.evaluate((q) => {
    const b = document.querySelector(q);
    b.click();
    b.click();
  }, sel("advance"));
  await host.waitForFunction(() => document.body.innerText.includes("Frises après le tour 1"));
  await new Promise((r) => setTimeout(r, 500));
  if (!(await host.evaluate(() => document.body.innerText.includes("Frises après le tour 1")))) throw new Error("le récapitulatif a été sauté");
  await shot(host, "09-host-recap");
  ok("hôte : récapitulatif des frises après le tour de plateau, même avec un double clic");
  await ana.waitForFunction(() => document.body.innerText.includes("Ta frise après le tour 1"));
  if ((await ana.evaluate(() => document.body.innerText)).includes("Ben")) throw new Error("le récapitulatif du téléphone d'Ana montre la frise de Ben");
  ok("Ana : le récapitulatif de son téléphone montre sa frise seulement");

  // Portrait : l'overlay doit bloquer la manette
  await ana.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ana.waitForFunction(() => document.body.innerText.includes("Tourne ton téléphone"));
  await shot(ana, "10-ana-portrait");
  ok("Ana : en portrait, l'écran « Tourne ton téléphone » s'affiche");
  await ana.setViewport(phone);
  await ana.waitForFunction(() => !document.body.innerText.includes("Tourne ton téléphone"));
  ok("Ana : l'overlay disparaît en paysage");

  // Rechargement de la manette : retour dans la partie avec le jeton
  await ana.reload();
  await ana.waitForFunction(() => !document.body.innerText.includes("Rejoindre une partie") && document.body.innerText.length > 20);
  const afterReload = await ana.evaluate(() => document.body.innerText);
  ok("Ana : après rechargement, " + (afterReload.includes("Rejoindre une partie") ? "ÉCHEC reprise" : "reprise de la partie"));
  if (afterReload.includes("Rejoindre une partie")) throw new Error("reprise impossible");
  await shot(ana, "11-ana-after-reload");
} catch (e) {
  console.log("✗ ÉCHEC :", e.message);
  for (const [k, p] of Object.entries(pages)) await p.screenshot({ path: OUT + "fail-" + k + ".png" }).catch(() => {});
  console.log("HTML hôte:", (await pages["hôte"].evaluate(() => document.body.innerText)).slice(0, 600));
  process.exitCode = 1;
} finally {
  if (logs.length) console.log("\nLogs navigateur :\n" + logs.join("\n"));
  await browser.close();
  server.kill();
}
