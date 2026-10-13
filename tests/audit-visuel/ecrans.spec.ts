import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../e2e/setup/scene";
import { ouvrirLaSessionSensible } from "../e2e/setup/session";
import { CATALOGUE, type Repere } from "./catalogue";
import {
  ouvrirCompteAdminSocieteNonEnrole,
  urlDeLienDejaConsomme,
  urlDePremierAccesNonConsomme,
} from "./comptes";
import { mesurerLaPage, type MesuresPage } from "./mesures";
import { resoudreLesReperes } from "./resolution";

/**
 * L'AUDIT VISUEL À L'ÉCRAN (9EWC-AUDIT-VISUEL-ECRAN) — RENDU, jamais lu dans
 * le code. Pour chaque écran du catalogue de la maquette : une capture du
 * SITE et une capture de la MAQUETTE, à 1280 et à 375, plus des mesures
 * automatiques sur le site. Voir le ticket pour le pourquoi.
 *
 * Un seul fichier, un seul worker (`playwright.audit.config.ts`) : les
 * mesures s'accumulent dans un objet de module, écrit une fois en JSON à la
 * toute fin (`test.afterAll`).
 */

const RACINE_SORTIE = join(
  process.cwd(),
  "docs/propositions/9EWC-AUDIT-VISUEL-ECRAN",
);
const DOSSIER_CAPTURES = join(RACINE_SORTIE, "captures");
const FICHIER_MESURES = join(RACINE_SORTIE, "mesures.json");
const MAQUETTE = pathToFileURL(
  join(
    process.cwd(),
    "docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html",
  ),
).toString();

const LARGEURS = [1280, 375] as const;
type Largeur = (typeof LARGEURS)[number];
const HAUTEUR: Record<Largeur, number> = { 1280: 800, 375: 812 };

mkdirSync(DOSSIER_CAPTURES, { recursive: true });

type EntreeMesure = {
  statut: "capturee" | "absente" | "echec";
  note?: string;
  mesures?: MesuresPage;
  consoleErreurs?: readonly string[];
  pageErreurs?: readonly string[];
  urlFinale?: string;
};

const MESURES: Record<string, Record<string, EntreeMesure>> = {};

function noterMesure(
  cle: string,
  largeur: Largeur | string,
  entree: EntreeMesure,
): void {
  MESURES[cle] ??= {};
  MESURES[cle][String(largeur)] = entree;
}

async function capturerMaquette(
  context: BrowserContext,
  hash: string,
  cle: string,
  largeur: Largeur,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(MAQUETTE.replace(/#.*$/, "") + hash, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(150);
    const buffer = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 70,
    });
    writeFileSync(
      join(DOSSIER_CAPTURES, `${cle}-maquette-${largeur}.jpg`),
      buffer,
    );
  } catch (erreur) {
    noterMesure(`maquette:${cle}`, largeur, {
      statut: "echec",
      note: String(erreur),
    });
  } finally {
    await page.close();
  }
}

async function capturerEtMesurerSite(
  page: Page,
  route: string,
  cle: string,
  largeur: Largeur,
): Promise<void> {
  const consoleErreurs: string[] = [];
  const pageErreurs: string[] = [];
  const surConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErreurs.push(msg.text());
  };
  const surErreur = (err: Error) => pageErreurs.push(String(err));
  page.on("console", surConsole);
  page.on("pageerror", surErreur);
  try {
    await page.goto(route, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(150);
    const mesures = await mesurerLaPage(page);
    const buffer = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 70,
    });
    writeFileSync(join(DOSSIER_CAPTURES, `${cle}-site-${largeur}.jpg`), buffer);
    noterMesure(cle, largeur, {
      statut: "capturee",
      mesures,
      consoleErreurs,
      pageErreurs,
      urlFinale: page.url(),
    });
  } catch (erreur) {
    noterMesure(cle, largeur, { statut: "echec", note: String(erreur) });
  } finally {
    page.off("console", surConsole);
    page.off("pageerror", surErreur);
  }
}

let reperes: Repere;

let anonyme1280: BrowserContext;
let anonyme375: BrowserContext;
let bureau1280: BrowserContext;
let bureau375: BrowserContext;
let terrain1280: BrowserContext;
let terrain375: BrowserContext;
let maquette1280: BrowserContext;
let maquette375: BrowserContext;

let pageAnonyme1280: Page;
let pageAnonyme375: Page;
let pageBureau1280: Page;
let pageBureau375: Page;
let pageTerrain1280: Page;
let pageTerrain375: Page;

async function connecterTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  reperes = (await resoudreLesReperes()).repere;

  anonyme1280 = await browser.newContext({
    viewport: { width: 1280, height: HAUTEUR[1280] },
    deviceScaleFactor: 0.5,
  });
  anonyme375 = await browser.newContext({
    viewport: { width: 375, height: HAUTEUR[375] },
    deviceScaleFactor: 0.5,
  });
  bureau1280 = await browser.newContext({
    viewport: { width: 1280, height: HAUTEUR[1280] },
    deviceScaleFactor: 0.5,
  });
  bureau375 = await browser.newContext({
    viewport: { width: 375, height: HAUTEUR[375] },
    deviceScaleFactor: 0.5,
  });
  terrain1280 = await browser.newContext({
    viewport: { width: 1280, height: HAUTEUR[1280] },
    deviceScaleFactor: 0.5,
  });
  terrain375 = await browser.newContext({
    viewport: { width: 375, height: HAUTEUR[375] },
    deviceScaleFactor: 0.5,
  });
  maquette1280 = await browser.newContext({
    viewport: { width: 1280, height: HAUTEUR[1280] },
    deviceScaleFactor: 0.5,
  });
  maquette375 = await browser.newContext({
    viewport: { width: 375, height: HAUTEUR[375] },
    deviceScaleFactor: 0.5,
  });

  pageAnonyme1280 = await anonyme1280.newPage();
  pageAnonyme375 = await anonyme375.newPage();
  pageBureau1280 = await bureau1280.newPage();
  pageBureau375 = await bureau375.newPage();
  pageTerrain1280 = await terrain1280.newPage();
  pageTerrain375 = await terrain375.newPage();

  await ouvrirLaSessionSensible(pageBureau1280, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await ouvrirLaSessionSensible(pageBureau375, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await connecterTerrain(pageTerrain1280);
  await connecterTerrain(pageTerrain375);
});

test.afterAll(async () => {
  mkdirSync(RACINE_SORTIE, { recursive: true });
  writeFileSync(FICHIER_MESURES, JSON.stringify(MESURES, null, 2));
  for (const ctx of [
    anonyme1280,
    anonyme375,
    bureau1280,
    bureau375,
    terrain1280,
    terrain375,
    maquette1280,
    maquette375,
  ]) {
    await ctx?.close();
  }
});

function pageDAcces(
  acces: "anonyme" | "bureau" | "terrain",
  largeur: Largeur,
): Page {
  if (acces === "anonyme")
    return largeur === 1280 ? pageAnonyme1280 : pageAnonyme375;
  if (acces === "bureau")
    return largeur === 1280 ? pageBureau1280 : pageBureau375;
  return largeur === 1280 ? pageTerrain1280 : pageTerrain375;
}

function contexteMaquette(largeur: Largeur): BrowserContext {
  return largeur === 1280 ? maquette1280 : maquette375;
}

for (const entree of CATALOGUE) {
  test(`${entree.zone} · ${entree.libelle}`, async () => {
    for (const largeur of LARGEURS) {
      await capturerMaquette(
        contexteMaquette(largeur),
        entree.maquetteHash,
        entree.cle,
        largeur,
      );
    }

    if (entree.acces === "special") {
      // Traité séparément ci-dessous (connexion/code, enrôlement, premier
      // accès) — rien à faire ici pour ces entrées communes.
      noterMesure(entree.cle, "site", {
        statut: "absente",
        note: entree.note ?? "Capture spéciale, voir plus bas dans la spec.",
      });
      return;
    }

    const route =
      typeof entree.route === "function" ? entree.route(reperes) : entree.route;

    if (route === null) {
      noterMesure(entree.cle, "site", {
        statut: "absente",
        note: entree.note ?? "Aucune ligne trouvée en base pour cet écran.",
      });
      return;
    }

    for (const largeur of LARGEURS) {
      const page = pageDAcces(entree.acces, largeur);
      await capturerEtMesurerSite(page, route, entree.cle, largeur);
    }
  });
}

// ── LES QUATRE CAPTURES SPÉCIALES (section Accès) ──────────────────────────

test("Accès · Code du second facteur (capture spéciale)", async ({
  browser,
}) => {
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    try {
      await page.goto("/connexion");
      await page
        .getByLabel(fr["connexion.email"])
        .fill(COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page
        .getByLabel(fr["connexion.mot_de_passe"])
        .fill(MOT_DE_PASSE_EPREUVE);
      await page.getByRole("button", { name: fr["connexion.valider"] }).click();
      await page.waitForURL(/\/connexion\/code/, { timeout: 15_000 });
      await page.waitForTimeout(150);
      const buffer = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 70,
      });
      writeFileSync(
        join(DOSSIER_CAPTURES, `connexion-code-site-${largeur}.jpg`),
        buffer,
      );
      noterMesure("connexion-code", largeur, {
        statut: "capturee",
        urlFinale: page.url(),
      });
    } catch (erreur) {
      noterMesure("connexion-code", largeur, {
        statut: "echec",
        note: String(erreur),
      });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Activer le second facteur (capture spéciale)", async ({
  browser,
}) => {
  const { email, motDePasse } = await ouvrirCompteAdminSocieteNonEnrole();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    try {
      await page.goto("/connexion");
      await page.getByLabel(fr["connexion.email"]).fill(email);
      await page.getByLabel(fr["connexion.mot_de_passe"]).fill(motDePasse);
      await page.getByRole("button", { name: fr["connexion.valider"] }).click();
      await page.waitForURL(/\/enrolement/, { timeout: 15_000 });
      await page.waitForTimeout(150);
      const buffer = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 70,
      });
      writeFileSync(
        join(DOSSIER_CAPTURES, `enrolement-site-${largeur}.jpg`),
        buffer,
      );
      noterMesure("enrolement", largeur, {
        statut: "capturee",
        urlFinale: page.url(),
      });
    } catch (erreur) {
      noterMesure("enrolement", largeur, {
        statut: "echec",
        note: String(erreur),
      });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Premier accès, non consommé (capture spéciale)", async ({
  browser,
}) => {
  const url = await urlDePremierAccesNonConsomme();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(url);
      await page.waitForTimeout(150);
      const buffer = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 70,
      });
      writeFileSync(
        join(DOSSIER_CAPTURES, `premier-acces-site-${largeur}.jpg`),
        buffer,
      );
      noterMesure("premier-acces", largeur, {
        statut: "capturee",
        urlFinale: page.url(),
      });
    } catch (erreur) {
      noterMesure("premier-acces", largeur, {
        statut: "echec",
        note: String(erreur),
      });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Lien d'accès expiré (capture spéciale)", async ({ browser }) => {
  const url = await urlDeLienDejaConsomme();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(url);
      await page.waitForTimeout(150);
      const buffer = await page.screenshot({
        fullPage: true,
        type: "jpeg",
        quality: 70,
      });
      writeFileSync(
        join(DOSSIER_CAPTURES, `premier-acces-expire-site-${largeur}.jpg`),
        buffer,
      );
      noterMesure("premier-acces-expire", largeur, {
        statut: "capturee",
        urlFinale: page.url(),
      });
    } catch (erreur) {
      noterMesure("premier-acces-expire", largeur, {
        statut: "echec",
        note: String(erreur),
      });
    } finally {
      await ctx.close();
    }
  }
});
