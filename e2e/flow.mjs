/**
 * Test de bout en bout : un écran hôte et deux téléphones (paysage) jouent un tour complet dans un
 * vrai Chrome, contre le vrai serveur et le vrai catalogue.
 *
 * Prérequis : `npm run build` dans server/ et dans client/, et un Chrome installé
 * (CHROME_PATH pour un chemin non standard). Lancer : `npm test` dans e2e/.
 * Les captures d'écran sont écrites dans e2e/shots/ (ignoré par git).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
    // __lastAudio : le dernier extrait joué (la voix du commentateur a son propre élément).
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); if (this.src.includes("/commentator/")) window.__voice = this; else window.__lastAudio = this; return orig.call(this); };
  });
  return page;
}
const sel = (id) => `[data-testid="${id}"]`;
const text = (page, s) => page.$eval(s, (e) => e.textContent.replace(/\s+/g, ""));
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
/** L'élément est présent ET visible : aucun parent à moitié transparent (transition bloquée). */
async function painted(page, selector, label = selector) {
  try {
    await page.waitForFunction(
      (q) => {
        let e = document.querySelector(q);
        if (!e) return false;
        for (; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 0.99) return false;
        return true;
      },
      { timeout: 3000 },
      selector,
    );
  } catch {
    throw new Error(`${label} : présent dans la page mais invisible (transition bloquée ou transparent)`);
  }
}
const go = (page, url) => page.goto(url + (url.includes("?") ? "&" : "?") + "nosplash");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phone = { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

try {
  const host = await newPage("hôte", { width: 1280, height: 720 });
  await host.goto(BASE);
  await host.waitForSelector(sel("splash"));
  await sleep(600);
  await host.screenshot({ path: OUT + "00-splash.png" });
  await host.waitForFunction(() => !document.querySelector('[data-testid="splash"]'), { timeout: 8000 });
  ok("écran de démarrage : affiché au chargement, puis disparaît");

  // Nouveautés : présentées au premier passage, puis plus jamais pour cette version.
  await painted(host, sel("news"), "modale des nouveautés");
  const newsVersion = (await text(host, sel("news-version"))).replace(/^v/, "");
  const newsItems = await host.$$eval(`${sel("news")} .news-item`, (els) => els.length);
  if (!/^\d+(\.\d+)*$/.test(newsVersion) || newsItems < 1) throw new Error(`nouveautés inattendues : v${newsVersion}, ${newsItems} éléments`);
  await assertFits(host, "modale des nouveautés");
  await shot(host, "00b-news");
  await host.click(sel("news-close"));
  await host.waitForFunction(() => !document.querySelector('[data-testid="news"]'));
  if ((await host.evaluate(() => localStorage.getItem("flashback.news"))) !== newsVersion) throw new Error("version vue non mémorisée");
  await go(host, BASE);
  await host.waitForSelector(sel("menu-host"));
  await sleep(800);
  if (await host.$(sel("news"))) throw new Error("la modale des nouveautés revient après avoir été fermée");
  // Un joueur qui a vu une version plus ancienne ne voit que les nouveautés.
  await host.evaluate(() => localStorage.setItem("flashback.news", "0.1"));
  await go(host, BASE);
  await painted(host, sel("news"), "nouveautés pour un ancien joueur");
  if (!(await text(host, sel("news"))).includes("Quoideneuf")) throw new Error("un ancien joueur devrait voir « Quoi de neuf ? »");
  await host.keyboard.press("Escape");
  await host.waitForFunction(() => !document.querySelector('[data-testid="news"]'));
  if ((await host.evaluate(() => localStorage.getItem("flashback.news"))) !== newsVersion) throw new Error("Échap n'a pas mémorisé la version vue");
  ok(`nouveautés v${newsVersion} : ${newsItems} éléments au premier passage, plus rien une fois fermées, les seules nouveautés pour un ancien joueur`);

  await shot(host, "01-home");
  await host.waitForSelector(sel("menu-host"));

  // Menu : Héberger, Rejoindre et Solo sur une rangée, puis Multijoueur (grisé) et Paramètres.
  const tiles = await host.evaluate(() =>
    ["menu-host", "menu-join", "menu-solo", "menu-multi", "menu-settings"].map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      return { id, x: Math.round(r.left), y: Math.round(r.top), bottom: Math.round(r.bottom) };
    }),
  );
  const [h, j, so, m, st] = tiles;
  if (!(h.y === j.y && j.y === so.y && m.y === st.y && h.y < m.y && h.x < j.x && j.x < so.x && h.x === m.x && m.x < st.x)) {
    throw new Error("le menu n'est pas en deux rangées (3 puis 2) : " + JSON.stringify(tiles));
  }
  if (m.bottom > 720 - 40) throw new Error("le menu est collé au bas de l'écran : " + JSON.stringify(m));
  if (!(await host.$eval(sel("menu-multi"), (e) => e.disabled))) throw new Error("Multijoueur devrait être grisé");
  await host.click(sel("menu-multi")).catch(() => {});
  if (new URL(host.url()).pathname !== "/") throw new Error("Multijoueur ne devrait mener nulle part");
  ok("menu : deux rangées sous le titre (3 puis 2), pas collées au bas ; Multijoueur est grisé et inactif");

  // /host sans partie en cours renvoie au menu (une salle se crée avec « Héberger »).
  const direct = await newPage("direct-host", { width: 1280, height: 720 });
  await go(direct, BASE + "/host");
  await direct.waitForSelector(sel("menu-host"));
  if (new URL(direct.url()).pathname !== "/") throw new Error("/host aurait dû renvoyer au menu");
  await direct.close();
  ok("/host sans partie en cours : retour au menu, aucune salle créée");

  // Musique de menu : elle joue dans le menu, son rendu est audible et sans saturation, on peut la couper.
  await host.waitForFunction(() => window.__menuMusic && window.__menuMusic.state().playing === true);
  ok("musique de menu : lancée dans le menu");
  const stats = await host.evaluate(() => window.__menuMusic.renderOffline(8, 1));
  console.log(
    "    rendu : " + stats.seconds.toFixed(1) + " s, niveau " + stats.rms.toFixed(3) + ", crête " + stats.peak.toFixed(2) + ", audible " + (stats.audibleRatio * 100).toFixed(0) + " %",
  );
  if (!(stats.rms > 0.01 && stats.rms < 0.25)) throw new Error("niveau de la musique incorrect : " + stats.rms);
  if (!(stats.peak < 0.95)) throw new Error("la musique sature : crête " + stats.peak);
  if (!(stats.audibleRatio > 0.95)) throw new Error("la musique a trop de silences : " + stats.audibleRatio);
  ok("musique de menu : rendu hors ligne audible (niveau correct, sans saturation, sans trous)");
  await host.click(sel("music-toggle"));
  await host.waitForFunction(() => window.__menuMusic.state().playing === false);
  await host.click(sel("music-toggle"));
  await host.waitForFunction(() => window.__menuMusic.state().playing === true);
  ok("musique de menu : se coupe et se relance avec le bouton du menu");

  // Paramètres : nom par défaut, animations réduites, mémorisés dans le navigateur.
  await host.click(sel("menu-settings"));
  await host.waitForSelector(sel("setting-name") + " input");
  await host.type(sel("setting-name") + " input", "Zoé");
  await host.$eval(sel("setting-reduced") + " input", (e) => e.click());
  await host.waitForFunction(() => document.documentElement.classList.contains("reduce-motion"));
  const saved = await host.evaluate(() => JSON.parse(localStorage.getItem("flashback.settings")));
  if (saved.playerName !== "Zoé" || saved.reducedMotion !== true) throw new Error("réglages non mémorisés : " + JSON.stringify(saved));
  await host.$eval(sel("setting-reduced") + " input", (e) => e.click());
  await host.waitForFunction(() => !document.documentElement.classList.contains("reduce-motion"));
  await shot(host, "01b-settings");
  await host.click(sel("settings-back"));
  await host.waitForSelector(sel("menu-join"));
  await host.click(sel("menu-join"));
  await host.waitForSelector(sel("name-input") + " input");
  if ((await host.$eval(sel("name-input") + " input", (e) => e.value)) !== "Zoé") throw new Error("le nom par défaut n'est pas proposé");
  const [back] = await host.$$("xpath/.//a[contains(., 'Retour')]");
  await back.click();
  await host.waitForSelector(sel("menu-host"));
  ok("paramètres : nom par défaut mémorisé et proposé, animations réduites activées puis coupées");

  await host.click(sel("menu-host"));
  await host.waitForFunction(() => window.__menuMusic.state().playing === false);
  ok("musique de menu : coupée en entrant dans une partie");
  await host.waitForSelector(sel("room-code"));
  await painted(host, sel("room-code"), "code de la salle");
  await assertFits(host, "salon de l'écran hôte");
  const code = await text(host, sel("room-code"));
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error("code invalide: " + code);
  ok(`hôte : salle créée, code ${code}`);
  ok(`hôte : adresse affichée ${await text(host, sel("join-url"))}`);

  // Le formulaire d'entrée ne doit jamais déborder, même sur un petit téléphone en portrait.
  for (const [w, h] of [[390, 844], [360, 640], [320, 568]]) {
    const p = await newPage(`portrait-${w}`, { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await go(p, `${BASE}/join/${code}`);
    await p.waitForSelector(sel("name-input"));
    await assertFits(p, `formulaire d'entrée à ${w}px`);
    if (w === 360) await shot(p, "02b-join-portrait-360");
    await p.close();
  }
  ok("formulaire d'entrée : aucun débordement horizontal à 390, 360 et 320 px de large");

  async function join(label, name, avatar, viewport = phone) {
    const p = await newPage(label, viewport);
    await go(p, `${BASE}/join/${code}`);
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
  if (await ana.$(sel("code-input"))) throw new Error("le champ code ne devrait pas s'afficher quand on arrive par un lien");
  await ana.click(sel("join"));
  await ana.waitForSelector(sel("leader-banner"));
  await painted(ana, sel("leader-banner"), "salon du chef de partie");
  ok("Ana : a rejoint par le lien (sans retaper le code) ; première arrivée, elle est chef de partie");

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

  // « Copier le lien » : le même lien que le QR code, à coller dans une conversation.
  const stubClipboard = (page) => page.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__copied = t; }; });
  await stubClipboard(host);
  await host.click(sel("copy-link"));
  await host.waitForFunction(() => document.querySelector('[data-testid="copy-link"]').innerText.includes("Lien copié"));
  if ((await host.evaluate(() => window.__copied)) !== qrLink) throw new Error("le lien copié n'est pas celui du QR code");
  await stubClipboard(ana);
  await ana.click(sel("player-copy-link"));
  const anaLink = await ana.evaluate(() => window.__copied);
  if (!anaLink?.endsWith(`/join/${code}`)) throw new Error("le lien copié depuis le téléphone est incorrect : " + anaLink);
  ok("hôte et Ana : « Copier le lien » copie le lien direct vers la salle");

  // Avatar 0 pris : Ben ne peut pas le choisir
  const ben = await newPage("Ben", phone);
  await go(ben, qrLink);
  await ben.waitForSelector(sel("avatar-0") + "[disabled]");
  if (await ben.$(sel("code-input"))) throw new Error("le champ code ne devrait pas s'afficher après un scan de QR code");
  if ((await text(ben, sel("code-chip"))).replace("Partie", "").replace("Changer", "") !== code) throw new Error("le code annoncé ne correspond pas à la salle");
  ok("Ben : arrivé par le QR code, aucun code à saisir ; l'avatar d'Ana est grisé");
  await ben.type(sel("name-input") + " input", "Ben");
  await ben.click(sel("avatar-1"));
  await ben.click(sel("join"));
  await ben.waitForFunction(() => document.body.innerText.includes("En attente du lancement"));
  await painted(ben, sel("wait"), "salon de Ben");
  ok("Ben : a rejoint");

  await host.waitForFunction(() => document.body.innerText.includes("Joueurs (2)"));
  // Le chef de partie (Ana) règle les catégories et lance depuis son téléphone ; Ben n'a pas ces commandes.
  if (await ben.$(sel("leader-start"))) throw new Error("Ben ne devrait pas voir les commandes du chef");
  await ana.click(sel("leader-category-fr"));
  await host.waitForFunction(() => document.querySelector('[data-testid="category-fr"]')?.getAttribute("aria-pressed") === "true");
  // Objectif : 10 cartes par défaut, Ana le passe à 5 ; l'écran hôte et Ben suivent.
  if ((await ana.$eval(sel("leader-goal-10"), (e) => e.getAttribute("aria-checked"))) !== "true") throw new Error("l'objectif par défaut devrait être 10 cartes");
  await ana.click(sel("leader-goal-5"));
  await host.waitForFunction(() => document.querySelector('[data-testid="goal-5"]')?.getAttribute("aria-checked") === "true");
  await ben.waitForFunction(() => document.querySelector('[data-testid="goal-info"]')?.innerText.includes("5 cartes"));
  await painted(ana, sel("leader-goal-5"), "objectif du chef");
  await shot(ana, "02c-ana-leader-lobby");
  ok("Ana (chef) : règle l'objectif à 5 cartes ; l'écran hôte et Ben l'affichent");
  // Commentateur (bêta) : coupé par défaut ; le chef l'active, le coupe puis le réactive, l'écran hôte suit.
  const commentatorOn = (page, id) => page.$eval(sel(id), (e) => e.getAttribute("aria-checked") === "true");
  if ((await commentatorOn(host, "commentator")) || (await commentatorOn(ana, "leader-commentator"))) throw new Error("le commentateur devrait être coupé par défaut");
  if (!(await text(host, sel("commentator"))).includes("Bêta")) throw new Error("l'interrupteur du commentateur devrait porter « Bêta »");
  for (const want of ["true", "false", "true"]) {
    await ana.click(sel("leader-commentator"));
    await host.waitForFunction((w) => document.querySelector('[data-testid="commentator"]').getAttribute("aria-checked") === w, {}, want);
  }
  const voiceFile = await fetch(BASE + "/commentator/start-1.m4a");
  if (voiceFile.status !== 200 || !/audio/.test(voiceFile.headers.get("content-type") ?? "")) throw new Error(`voix du commentateur non servie : ${voiceFile.status} ${voiceFile.headers.get("content-type")}`);
  ok("commentateur : marqué « Bêta », coupé par défaut, activé, coupé puis réactivé par le chef ; l'écran hôte suit");
  await shot(host, "03-host-lobby");
  await ana.waitForFunction(() => !document.querySelector('[data-testid="leader-start"]').disabled);
  await ana.click(sel("leader-start"));
  ok("Ana (chef) : choisit la catégorie et lance la partie depuis son téléphone");

  await ana.waitForSelector(sel("play-extract"));
  await painted(ana, sel("play-extract"), "tour d'Ana");
  await shot(ana, "04-ana-turn");
  await host.waitForFunction(() => document.body.innerText.includes("lance l'extrait"));
  await host.waitForFunction(() => window.__plays.some((u) => u.includes("/commentator/start-")));
  if (await host.$(sel("voice-line"))) throw new Error("le commentateur ne devrait rien afficher");
  await shot(host, "05-host-waiting");
  ok(`commentateur : annonce le lancement à voix haute, sans rien afficher (${(await host.evaluate(() => window.__voice.src.split("/").at(-1)))})`);
  ok("Ana : c'est son tour ; l'hôte l'attend");

  // Ben ne voit pas le bouton d'écoute
  if (await ben.$(sel("play-extract"))) throw new Error("Ben ne devrait pas pouvoir écouter");
  ok("Ben : pas de bouton d'écoute hors de son tour");

  // L'écran et le téléphone de Ben montrent tous deux la frise d'Ana, le joueur en cours.
  const anaStart = await titles(host);
  const benStart = await titles(ben);
  if (anaStart.length === 0 || benStart.length === 0) throw new Error("frise introuvable");
  if (JSON.stringify(benStart) !== JSON.stringify(anaStart)) throw new Error(`Ben devrait voir la frise d'Ana : ${benStart} / ${anaStart}`);
  const benText = await ben.evaluate(() => document.body.innerText);
  if (!benText.includes("Tour de Ana") || !benText.includes("pas encore lancé")) throw new Error("écran groove de Ben incorrect : " + benText);
  if (!(await ben.$eval(sel("groove-place"), (e) => e.disabled))) throw new Error("Ben ne devrait pas pouvoir placer avant l'écoute");
  if (await ben.$(".slot")) throw new Error("emplacements cliquables avant l'écoute");
  ok("Ben : voit la frise d'Ana pendant son tour ; placement groove fermé avant l'écoute");

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
  await host.waitForFunction(() => window.__plays.some((u) => u.includes("itunes.apple.com/")));
  const played = await host.evaluate(() => window.__plays.filter((u) => u.includes("itunes.apple.com/")).at(-1));
  ok(`hôte : joue l'extrait chez Apple ${played.split("/").at(-1)}`);
  const audioRes = await fetch(played);
  if (audioRes.status !== 200) throw new Error("extrait introuvable " + audioRes.status);
  ok("l'extrait répond chez Apple (200)");

  // Une seule écoute par tour : le bouton se désactive et le son n'est joué qu'une fois.
  await ana.waitForFunction(() => document.querySelector('[data-testid="play-extract"]').disabled);
  await ana.click(sel("play-extract")).catch(() => {});
  await sleep(300);
  const playsCount = await host.evaluate(() => window.__plays.filter((u) => u.includes("itunes.apple.com/")).length);
  if (playsCount !== 1) throw new Error(`l'extrait a été joué ${playsCount} fois`);
  ok("Ana : « Écouter » est désactivé après l'écoute, l'extrait n'est joué qu'une fois");

  // Groove : Ben place le titre dans la frise d'Ana avant elle.
  await ben.waitForSelector(".slot");
  await ben.setViewport({ width: 740, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(300);
  await assertFits(ben, "placement groove à 740x300", { vertical: true });
  const gb = await ben.$eval(sel("groove-place"), (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  if (gb.top < 0 || gb.bottom > 300) throw new Error("bouton groove hors de l'écran à 740x300 : " + JSON.stringify(gb));
  await ben.click(".slot");
  await ben.waitForFunction(() => !document.querySelector('[data-testid="groove-place"]').disabled);
  await shot(ben, "05b-ben-groove-740x300");
  await ben.setViewport(phone);
  await ben.click(sel("groove-place"));
  await ben.waitForSelector(sel("groove-done"));
  if (await ben.$(".slot")) throw new Error("Ben ne devrait plus pouvoir placer après son placement groove");
  await host.waitForSelector(sel("guessed"));
  await host.waitForFunction(() => document.querySelector('[data-testid="groove-hint"]').textContent.includes("1/1 ont placé"));
  await ana.waitForSelector(sel("groove-pressure"));
  await shot(host, "05c-host-groove-placed");
  ok("Ben : place le titre dans la frise d'Ana (groove) ; l'écran et Ana le voient, sans la position");

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
  // Le commentateur réagit au placement ; pendant qu'il parle, l'extrait baisse.
  await host.waitForFunction(() => window.__plays.some((u) => /\/commentator\/(correct|close|stolen|far|wrong)-/.test(u)));
  const duck = await host.evaluate(() => ({ speaking: !window.__voice.paused && !window.__voice.ended, volume: window.__lastAudio.volume }));
  if (!duck.speaking) throw new Error("le commentateur devrait encore parler au début de la révélation");
  if (duck.volume > 0.5) throw new Error("l'extrait devrait baisser pendant que le commentateur parle : volume " + duck.volume);
  const revealLine = await host.evaluate(() => window.__plays.filter((u) => u.includes("/commentator/")).at(-1).split("/").at(-1));
  ok(`commentateur : réagit au placement (${revealLine})` + `, extrait baissé à ${duck.volume.toFixed(2)}`);
  // Le résultat reste affiché au moins 3 s : « Continuer » est grisé sur l'écran et chez le chef.
  if (!(await host.$eval(sel("advance"), (b) => b.disabled))) throw new Error("« Continuer » devrait être grisé au début de la révélation");
  await ana.waitForSelector(sel("leader-advance") + "[disabled]");
  ok("révélation : « Continuer » grisé au début, sur l'écran et chez le chef");
  await painted(host, sel("verdict"), "révélation de l'hôte");
  // Pochettes lues chez Apple : chaque image de la frise doit s'être chargée.
  await host.waitForFunction(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("mzstatic.com")).every((i) => i.complete && i.naturalWidth > 0), { timeout: 10_000 });
  const covers = await host.$$eval("img", (imgs) => imgs.filter((i) => i.src.includes("mzstatic.com") && i.naturalWidth > 0).length);
  if (covers === 0) throw new Error("aucune pochette Apple affichée à la révélation");
  ok(`hôte : ${covers} pochettes chargées chez Apple`);
  await shot(host, "07-host-reveal");
  const revealText = await host.evaluate(() => document.body.innerText);
  if (!/a trouvé|n'a pas trouvé/.test(revealText)) throw new Error("pas de résultat");
  const anaOk = revealText.includes("Ana a trouvé");
  const placedTone = await host.$eval(sel("placed-card"), (e) => (e.classList.contains("tone-ok") ? "ok" : e.classList.contains("tone-ko") ? "ko" : "?"));
  if (placedTone !== (anaOk ? "ok" : "ko")) throw new Error(`la carte posée devrait être ${anaOk ? "verte" : "rouge"} (${placedTone})`);
  // Ana et Ben ont choisi le même emplacement (le premier) : même verdict. Pas d'avatar sur la frise, juste qui a eu bon.
  if (await host.$(".track .avatar")) throw new Error("la frise ne devrait pas porter d'avatars groove");
  const hostGroove = await text(host, sel("groove-result"));
  if (hostGroove !== (anaOk ? "Benaaussitrouvé" : "Personnen'atrouvé")) throw new Error("ligne groove incorrecte sur l'écran : " + hostGroove);
  const verdict = await text(host, sel("verdict"));
  if (verdict !== (anaOk ? "Anaatrouvé!" : "Anan'apastrouvé…")) throw new Error("verdict incorrect sur l'écran : " + verdict);
  // Carte ratée : les emplacements justes sont marqués en vert ; carte juste : aucun.
  const solutions = (await host.$$(sel("solution"))).length;
  if (anaOk ? solutions !== 0 : solutions < 1) throw new Error(`bonnes réponses affichées : ${solutions} (Ana ${anaOk ? "a trouvé" : "a raté"})`);
  ok("hôte : révélation affichée (" + (anaOk ? "bien joué" : "raté") + ") ; carte d'Ana " + (anaOk ? "en vert" : "en rouge, bonne réponse en vert") + " dans sa frise, « " + (anaOk ? "Ana a trouvé ! » puis « Ben a aussi trouvé" : "Ana n'a pas trouvé… » puis « Personne n'a trouvé") + " »");
  await ben.waitForFunction(() => document.body.innerText.includes("En attente de la suite"));
  await ben.setViewport({ width: 740, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(300);
  await assertFits(ben, "révélation à 740x300", { vertical: true });
  await shot(ben, "08-ben-reveal");
  const benReveal = await titles(ben);
  if (!benReveal.includes(anaStart[0])) throw new Error("la révélation de Ben devrait montrer la frise d'Ana");
  if (!(await ben.$(sel("placed-card")))) throw new Error("la carte jouée par Ana n'est pas dans la frise de Ben");
  // Ben a choisi le même emplacement qu'Ana : même verdict. Son téléphone ne parle que de lui.
  const benGroove = await text(ben, sel("groove-result"));
  if (benGroove !== (anaOk ? "Toiaussi!" : "Toinonplus…")) throw new Error("résultat groove de Ben incorrect : " + benGroove);
  ok("Ben : la révélation tient à 740x300, montre la frise d'Ana et « " + (anaOk ? "Toi aussi !" : "Toi non plus…") + " »");
  await ben.setViewport(phone);

  await ana.waitForSelector(sel("leader-advance") + ":not([disabled])", { timeout: 6000 });
  if (await host.$eval(sel("advance"), (b) => b.disabled)) throw new Error("« Continuer » est encore grisé sur l'écran après le délai");
  // Passage au joueur suivant : l'extrait d'Ana doit s'éteindre en une seconde environ, pas d'un coup.
  // On relance l'élément s'il s'est arrêté entre-temps, et on note l'instant où il est mis en pause.
  const fadeReady = await host.evaluate(async () => {
    const el = window.__lastAudio;
    window.__pausedAt = undefined;
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { if (window.__pausedAt === undefined) window.__pausedAt = performance.now(); return pause.call(this); };
    if (el.paused) await el.play().catch(() => {});
    window.__volumeBefore = el.volume;
    window.__advanceAt = performance.now();
    return !el.paused;
  });
  // Double clic sur « Continuer » depuis le téléphone du chef : le second message doit être ignoré.
  // Deux clics dans la même tâche JS : le second part avant que l'écran ait changé (déterministe).
  await ana.evaluate((q) => {
    const b = document.querySelector(q);
    b.click();
    b.click();
  }, sel("leader-advance"));
  await ben.waitForSelector(sel("play-extract"));
  await painted(ben, sel("play-extract"), "tour de Ben");
  if (fadeReady) {
    await host.waitForFunction(() => window.__pausedAt !== undefined, { timeout: 4000 });
    const fade = await host.evaluate(() => ({ ms: window.__pausedAt - window.__advanceAt, volume: window.__lastAudio.volume, before: window.__volumeBefore }));
    if (fade.ms < 800 || fade.ms > 2000) throw new Error(`l'extrait s'est arrêté après ${Math.round(fade.ms)} ms au lieu d'environ 1 s`);
    if (Math.abs(fade.volume - fade.before) > 0.01) throw new Error("le volume n'est pas revenu au réglage après le fondu");
    ok(`hôte : au joueur suivant, l'extrait s'éteint en fondu (arrêt après ${Math.round(fade.ms)} ms, volume rétabli)`);
  } else {
    ok("hôte : fondu non vérifié (l'extrait ne peut pas être relancé dans ce navigateur)");
  }
  await new Promise((r) => setTimeout(r, 400));
  if (await host.$(sel("advance"))) throw new Error("le double clic a fait avancer deux fois");
  if ((await ben.$(sel("leader-advance"))) !== null) throw new Error("Ben ne devrait pas pouvoir faire avancer la partie");
  if (await host.evaluate(() => document.body.innerText.includes("Rien à faire avancer"))) {
    throw new Error("le message en double a produit une erreur au lieu d'être ignoré");
  }
  ok("Ana (chef) : « Continuer » depuis son téléphone ; un double clic est ignoré sans erreur ; c'est le tour de Ben");
  await ben.click(sel("play-extract"));
  await ben.click(".slot");
  await ben.click(sel("place"));
  await host.waitForSelector(sel("advance") + ":not([disabled])", { timeout: 6000 });
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
  // Le récapitulatif tient dans l'écran, « Tour suivant » compris : la page ne défile jamais. Quand les
  // frises ne tiennent pas (beaucoup de joueurs, ici un écran bas), elles défilent toutes seules.
  const recapFits = (page) =>
    page.evaluate(() => {
      const b = document.querySelector('[data-testid="advance"]').getBoundingClientRect();
      return document.documentElement.scrollHeight <= innerHeight + 1 && b.bottom <= innerHeight && b.top >= 0;
    });
  if (!(await recapFits(host))) throw new Error("le récapitulatif de l'écran hôte dépasse de l'écran");
  await host.setViewport({ width: 1280, height: 420 });
  await sleep(300);
  if (!(await recapFits(host))) throw new Error("le récapitulatif dépasse d'un écran bas au lieu de défiler dans son panneau");
  const rowsBox = await host.$eval(sel("recap-rows"), (e) => ({ overflow: e.scrollHeight - e.clientHeight, top: e.scrollTop }));
  if (rowsBox.overflow <= 0) throw new Error("les frises devraient dépasser à 1280x420");
  await host.waitForFunction(() => document.querySelector('[data-testid="recap-rows"]').scrollTop > 20, { timeout: 8000 });
  await host.waitForFunction(
    (max) => document.querySelector('[data-testid="recap-rows"]').scrollTop >= max - 1,
    { timeout: 15000 },
    rowsBox.overflow,
  );
  await shot(host, "09c-host-recap-autoscroll");
  await host.setViewport({ width: 1280, height: 720 });
  ok(`hôte : récapitulatif tenu dans l'écran ; sur un écran bas, les frises défilent toutes seules (${rowsBox.overflow} px)`);
  await ana.waitForFunction(() => document.body.innerText.includes("Ta frise après le tour 1"));
  await assertFits(ana, "récapitulatif du téléphone", { vertical: true });
  await shot(ana, "09b-ana-recap");
  // Les noms des lignes, pas tout le texte : un artiste peut contenir « Ben » (Amel Bent).
  const recapNames = await ana.$$eval(".recap .name", (els) => els.map((e) => e.textContent.trim()));
  if (JSON.stringify(recapNames) !== '["Ana"]') throw new Error("le récapitulatif du téléphone d'Ana montre d'autres frises : " + recapNames);
  const recapText = await host.evaluate(() => document.body.innerText);
  if (!recapText.includes(`${anaOk ? 1 : 0} groove`)) throw new Error("le récapitulatif n'affiche pas les points groove de Ben");
  ok("Ana : le récapitulatif de son téléphone montre sa frise seulement ; l'écran affiche les points groove");

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

  // Le chef se déconnecte : Ben (premier joueur connecté) prend la relève et peut faire avancer la partie.
  await ana.close();
  await ben.waitForSelector(sel("leader-advance"));
  await shot(ben, "12-ben-new-leader");
  await ben.click(sel("leader-advance"));
  await host.waitForFunction(() => document.querySelector('[data-testid="turn-status"]'));
  ok("Ana déconnectée : Ben devient chef de partie et lance le tour suivant depuis son téléphone");

  // Quitter en pleine partie : bouton toujours visible, confirmation, puis la partie continue sans lui
  // (ici il ne reste qu'Ana, la partie s'arrête).
  await ben.waitForSelector(sel("leave-game"));
  await shot(ben, "13-ben-watch-leave-button");
  await ben.click(sel("leave-game"));
  await ben.waitForSelector(sel("leave-confirm-ok"));
  await shot(ben, "14-ben-leave-confirm");
  await ben.click(sel("leave-confirm-ok"));
  await ben.waitForSelector(sel("menu-host"));
  await host.waitForSelector(sel("replay"));
  if ((await host.evaluate(() => document.body.innerText)).includes("Ben")) throw new Error("Ben est encore affiché sur l'écran hôte");
  await shot(host, "15-host-finished-after-leave");
  ok("Ben quitte en pleine partie après confirmation : retour à l'accueil, la partie se termine sans lui");

  // Rejouer : retour au salon de la même salle, avec les joueurs restants (Ana, déconnectée) et les
  // mêmes réglages ; Ben, parti, n'y est plus.
  await host.click(sel("replay"));
  await host.waitForSelector(sel("start"));
  await painted(host, sel("room-code"), "salon après « Rejouer »");
  if ((await text(host, sel("room-code"))) !== code) throw new Error("« Rejouer » devrait garder le code de la salle");
  const replayText = await host.evaluate(() => document.body.innerText);
  if (!replayText.includes("Joueurs (1)") || !replayText.includes("Ana") || replayText.includes("Ben")) throw new Error("le salon après « Rejouer » devrait contenir Ana seule");
  if ((await host.$eval(sel("goal-5"), (e) => e.getAttribute("aria-checked"))) !== "true") throw new Error("l'objectif de 5 cartes devrait être gardé");
  await shot(host, "15b-host-replay-lobby");
  ok("hôte : « Rejouer avec les mêmes joueurs » ramène au salon de la même salle, réglages gardés, sans Ben");

  // Fin de partie par l'hôte depuis le salon : confirmation, puisqu'il reste un joueur.
  await host.click(sel("host-leave"));
  await host.waitForSelector(sel("host-leave-confirm-ok"));
  await sleep(300);
  await host.click(sel("host-leave-confirm-ok"));
  await host.waitForSelector(sel("menu-host"));
  ok("hôte : quitter le salon (après confirmation) ramène à l'accueil");

  // --- Solo ---------------------------------------------------------------------------------------
  // L'année du titre en cours n'est jamais envoyée : le test la retrouve dans le catalogue à partir
  // de l'adresse de l'extrait que l'appareil vient de jouer.
  const yearOf = new Map(JSON.parse(readFileSync(ROOT + "server/data/catalog.json", "utf8")).map((t) => [t.previewUrl, t.year]));
  /** Écoute le titre puis le place, juste ou faux (si une position fausse existe). Renvoie le verdict. */
  async function soloPlace(page, { wrong = false } = {}) {
    await painted(page, sel("play-extract"), "tour solo");
    const before = await page.evaluate(() => window.__plays.length);
    await page.click(sel("play-extract"));
    await page.waitForFunction((n) => window.__plays.length > n, { timeout: 3000 }, before);
    const url = await page.evaluate(() => window.__plays.at(-1));
    const year = yearOf.get(url);
    if (year === undefined) throw new Error("solo : l'appareil n'a pas joué un extrait du catalogue : " + url);
    const years = await page.$$eval(".track-card .year", (els) => els.map((e) => Number(e.textContent)));
    const all = [...Array(years.length + 1).keys()];
    const good = all.filter((i) => (i === 0 || years[i - 1] <= year) && (i === years.length || year <= years[i]));
    const bad = all.filter((i) => !good.includes(i));
    const pos = wrong && bad.length ? bad[0] : good[0];
    await (await page.$$(".slot"))[pos].click();
    await page.click(sel("place"));
    await painted(page, sel("solo-advance"), "révélation solo");
    return good.includes(pos);
  }
  /** Après la révélation : titre suivant ou fin de partie. Renvoie vrai si la partie est finie. */
  async function soloNext(page) {
    await page.click(sel("solo-advance"));
    await page.waitForFunction(() => document.querySelector('[data-testid="play-extract"]') || document.querySelector('[data-testid="solo-end-title"]'));
    await sleep(500);
    return !!(await page.$(sel("solo-end-title")));
  }

  const solo = await newPage("solo", { width: 1280, height: 720 });
  await go(solo, BASE);
  await painted(solo, sel("news"), "nouveautés (solo)");
  await solo.click(sel("news-close"));
  await solo.waitForFunction(() => !document.querySelector('[data-testid="news"]'));
  await solo.waitForSelector(sel("menu-solo"));
  await solo.click(sel("menu-solo"));
  await painted(solo, sel("level-premiers-pas"), "menu solo");
  if (await solo.$eval(sel("level-premiers-pas"), (e) => e.disabled)) throw new Error("le premier niveau devrait être ouvert");
  if (!(await solo.$eval(sel("level-tour-du-monde"), (e) => e.disabled))) throw new Error("le deuxième niveau devrait être fermé");
  if ((await text(solo, sel("campaign-total"))) !== "0/36") throw new Error("total d'étoiles inattendu : " + (await text(solo, sel("campaign-total"))));
  await assertFits(solo, "menu solo à 1280x720");
  await shot(solo, "16-solo-menu");
  ok("solo : menu avec la partie libre et la campagne, seul le premier niveau est ouvert");

  // Campagne, niveau 1 (5 cartes) : une erreur volontaire, puis sans faute. Passer en mobile
  // recharge la page : on la rouvre explicitement avant de cliquer.
  await solo.setViewport(phone);
  await go(solo, BASE + "/solo");
  await painted(solo, sel("level-premiers-pas"), "menu solo sur téléphone");
  await assertFits(solo, "menu solo en paysage");
  await solo.click(sel("level-premiers-pas"));
  await painted(solo, sel("play-extract"), "niveau 1");
  if ((await text(solo, sel("solo-progress"))) !== "1/5cartes") throw new Error("progression inattendue : " + (await text(solo, sel("solo-progress"))));
  await shot(solo, "17-solo-turn");
  const firstOk = await soloPlace(solo, { wrong: true });
  await shot(solo, "18-solo-reveal");
  const hearts = await solo.$$eval(`${sel("lives")} .full`, (els) => els.length);
  if (hearts !== (firstOk ? 3 : 2)) throw new Error(`vies après le premier titre : ${hearts}`);
  ok(`solo : l'appareil joue lui-même l'extrait ; ${firstOk ? "titre juste (années égales)" : "une erreur coûte une vie"}`);

  // Rechargement en pleine partie : on retrouve la révélation.
  await solo.reload();
  // L'adresse rechargée n'a pas ?nosplash : l'écran de démarrage passe d'abord par-dessus.
  await solo.waitForFunction(() => !document.querySelector('[data-testid="splash"]'), { timeout: 8000 });
  await painted(solo, sel("solo-advance"), "révélation après rechargement");
  ok("solo : un rechargement reprend la partie en cours");

  let finished = await soloNext(solo);
  let turns = 1;
  for (; !finished && turns < 12; turns++) {
    if (turns === 1) {
      await solo.setViewport({ width: 740, height: 300, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await sleep(300);
      await assertFits(solo, "tour solo à 740x300", { vertical: true });
      await shot(solo, "17b-solo-turn-740x300");
      await solo.setViewport(phone);
    }
    await soloPlace(solo);
    finished = await soloNext(solo);
  }
  if (!finished) throw new Error("le niveau 1 aurait dû se terminer");
  const endTitle = await solo.$eval(sel("solo-end-title"), (e) => e.textContent.trim());
  const stars = await solo.$eval(sel("stars"), (e) => Number(e.dataset.stars));
  if (endTitle !== "Niveau réussi !" || stars !== (firstOk ? 3 : 2)) throw new Error(`fin de niveau inattendue : ${endTitle}, ${stars} étoiles`);
  await painted(solo, sel("solo-next"), "bouton Niveau suivant");
  await assertFits(solo, "fin de niveau en paysage", { vertical: true });
  await shot(solo, "19-solo-level-won");
  ok(`solo : niveau 1 réussi avec ${stars} étoiles`);

  await solo.click(sel("solo-menu"));
  await painted(solo, sel("level-tour-du-monde"), "menu solo après le niveau 1");
  if (await solo.$eval(sel("level-tour-du-monde"), (e) => e.disabled)) throw new Error("le niveau 2 devrait être ouvert");
  if ((await text(solo, sel("campaign-total"))) !== `${stars}/36`) throw new Error("les étoiles du niveau 1 ne sont pas comptées");
  await assertFits(solo, "menu solo en paysage");
  await shot(solo, "20-solo-menu-progress");
  ok("solo : le niveau 2 s'ouvre, les étoiles sont gardées");

  // Partie libre : catégorie Français, un titre juste puis des erreurs volontaires.
  await solo.click(sel("solo-free"));
  await painted(solo, sel("solo-start"), "salon de la partie libre");
  const allCount = await text(solo, sel("solo-track-count"));
  await solo.click(sel("solo-category-fr"));
  await solo.waitForFunction((t) => document.querySelector('[data-testid="solo-track-count"]').textContent.replace(/\s+/g, "") !== t, {}, allCount);
  await shot(solo, "21-solo-free-lobby");
  await solo.click(sel("solo-start"));
  finished = false;
  for (turns = 0; !finished && turns < 20; turns++) {
    await soloPlace(solo, { wrong: turns > 0 });
    finished = await soloNext(solo);
  }
  if (!finished) throw new Error("la partie libre aurait dû s'arrêter à la troisième erreur");
  const freeEnd = await solo.$eval(sel("solo-end-detail"), (e) => e.textContent.replace(/\s+/g, " ").trim());
  if (!freeEnd.includes("nouveau record")) throw new Error("premier score : record attendu : " + freeEnd);
  await assertFits(solo, "fin de partie libre en paysage", { vertical: true });
  await shot(solo, "22-solo-free-end");
  ok(`solo : partie libre terminée à la troisième erreur (${freeEnd})`);
  await solo.click(sel("solo-menu"));
  await painted(solo, sel("solo-best"), "record sur le menu solo");
  await painted(solo, sel("solo-last"), "dernier score sur le menu solo");
  ok("solo : le meilleur score et le dernier score de la partie libre s'affichent sur le menu");

  // Rechargement : étoiles, meilleur score et dernier score sont gardés par le navigateur.
  await go(solo, BASE + "/solo");
  await painted(solo, sel("solo-last"), "dernier score après rechargement");
  if ((await text(solo, sel("campaign-total"))) !== `${stars}/36`) throw new Error("étoiles perdues au rechargement : " + (await text(solo, sel("campaign-total"))));
  if (await solo.$eval(sel("level-tour-du-monde"), (e) => e.disabled)) throw new Error("le niveau 2 s'est refermé au rechargement");
  if (!(await text(solo, sel("solo-best"))).includes("2cartes")) throw new Error("meilleur score perdu : " + (await text(solo, sel("solo-best"))));
  await shot(solo, "23-solo-menu-after-reload");
  ok("solo : après rechargement, étoiles, niveau ouvert, meilleur et dernier score sont toujours là");
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
