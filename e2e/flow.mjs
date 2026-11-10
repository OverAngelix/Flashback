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
  await shot(host, "01-home");
  await host.waitForSelector(sel("menu-host"));

  // Menu : quatre boîtes en grille 2x2, « Multijoueur » est grisé et ne mène nulle part.
  const tiles = await host.evaluate(() =>
    ["menu-host", "menu-join", "menu-multi", "menu-settings"].map((id) => {
      const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      return { id, x: Math.round(r.left), y: Math.round(r.top), bottom: Math.round(r.bottom) };
    }),
  );
  const [h, j, m, st] = tiles;
  if (!(h.y === j.y && m.y === st.y && h.x === m.x && j.x === st.x && h.y < m.y && h.x < j.x)) {
    throw new Error("le menu n'est pas une grille 2x2 : " + JSON.stringify(tiles));
  }
  if (m.bottom > 720 - 40) throw new Error("le menu est collé au bas de l'écran : " + JSON.stringify(m));
  if (!(await host.$eval(sel("menu-multi"), (e) => e.disabled))) throw new Error("Multijoueur devrait être grisé");
  await host.click(sel("menu-multi")).catch(() => {});
  if (new URL(host.url()).pathname !== "/") throw new Error("Multijoueur ne devrait mener nulle part");
  ok("menu : grille 2x2 sous le titre, pas collée au bas ; Multijoueur est grisé et inactif");

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
  await shot(ana, "02c-ana-leader-lobby");
  await ana.click(sel("leader-category-fr"));
  await host.waitForFunction(() => document.querySelector('[data-testid="category-fr"]')?.getAttribute("aria-pressed") === "true");
  await shot(host, "03-host-lobby");
  await ana.waitForFunction(() => !document.querySelector('[data-testid="leader-start"]').disabled);
  await ana.click(sel("leader-start"));
  ok("Ana (chef) : choisit la catégorie et lance la partie depuis son téléphone");

  await ana.waitForSelector(sel("play-extract"));
  await painted(ana, sel("play-extract"), "tour d'Ana");
  await shot(ana, "04-ana-turn");
  await host.waitForFunction(() => document.body.innerText.includes("lance l'extrait"));
  await shot(host, "05-host-waiting");
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
  await painted(host, sel("advance"), "bouton Continuer de l'hôte");
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
  await host.waitForFunction(() => document.body.innerText.includes("Nouvelle partie"));
  if ((await host.evaluate(() => document.body.innerText)).includes("Ben")) throw new Error("Ben est encore affiché sur l'écran hôte");
  await shot(host, "15-host-finished-after-leave");
  ok("Ben quitte en pleine partie après confirmation : retour à l'accueil, la partie se termine sans lui");

  // Fin de partie par l'hôte : retour à l'accueil sans confirmation (la partie est finie)
  await host.click(sel("host-leave"));
  await host.waitForSelector(sel("menu-host"));
  ok("hôte : quitter une partie terminée ramène à l'accueil");
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
