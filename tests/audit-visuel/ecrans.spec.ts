import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import {
  EMAIL_DIRECTION_AUDIT,
  fermerCompteDirectionAudit,
  ouvrirCompteDirectionAudit,
} from "../audit-fonctionnel/comptes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  COMPTE_RM_EPREUVE,
  COMPTE_RS_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../e2e/setup/scene";
import { ouvrirLaSessionSensible } from "../e2e/setup/session";
import { avecRole, cleDe, CATALOGUE, type Repere } from "./catalogue";
import {
  ouvrirCompteAdminSocieteNonEnrole,
  ouvrirCompteMultiSociete,
  ouvrirSessionPortailDeDemonstration,
  urlDeLienDejaConsomme,
  urlDePremierAccesNonConsomme,
} from "./comptes";
import {
  calculerLesVerdicts,
  DOSSIER_ECRANS,
  ecrireIndex,
  ecrireLaFicheDUnEcran,
  ecrireRepartition,
  type EntreeDossier,
  type LargeurCle,
  type MesureLargeur,
} from "./dossier";
import { instrumenter, mesurerLaPage, type Instrumentation } from "./mesures";
import { resoudreLesReperes } from "./resolution";

/**
 * L'AUDIT VISUEL À L'ÉCRAN (9F6A-DOSSIER-AUDIT-8-AGENTS) — RENDU, jamais lu
 * dans le code. Pour chaque écran : une capture « haut » (viewport) et une
 * capture « pleine » (redimensionnée au contenu, plafonnée à 4 hauteurs
 * d'écran) du SITE et, quand elle existe, de la MAQUETTE, à 1280 et à 375,
 * plus des mesures automatiques. Le dossier par écran (`fiche.md`,
 * `mesures.json`, textes) est écrit à la toute fin par `./dossier.ts`.
 *
 * Un seul fichier, un seul worker (`playwright.audit.config.ts`).
 */

const MAQUETTE = pathToFileURL(
  join(
    process.cwd(),
    "docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html",
  ),
).toString();

const LARGEURS = [1280, 375] as const;
type Largeur = (typeof LARGEURS)[number];
const HAUTEUR: Record<Largeur, number> = { 1280: 800, 375: 812 };
const PLAFOND_HAUTEURS_ECRAN = 4;

mkdirSync(DOSSIER_ECRANS, { recursive: true });

type AccumLargeur = Omit<MesureLargeur, "verdict" | "verdictDetail">;

type Accum = {
  zone: string;
  libelle: string;
  route: string | null;
  role: string;
  etat?: string;
  maquetteHash: string | null;
  largeurs: Record<LargeurCle, AccumLargeur>;
};

const ACCUM = new Map<string, Accum>();

function vide(): AccumLargeur {
  return { statut: "absente", maquetteExiste: false };
}

function obtenir(
  cle: string,
  zone: string,
  libelle: string,
  route: string | null,
  role: string,
  maquetteHash: string | null,
  etat?: string,
): Accum {
  let a = ACCUM.get(cle);
  if (a === undefined) {
    a = {
      zone,
      libelle,
      route,
      role,
      etat,
      maquetteHash,
      largeurs: { "1280": vide(), "375": vide() },
    };
    ACCUM.set(cle, a);
  }
  return a;
}

function fusionnerLargeur(
  cle: string,
  largeur: Largeur,
  partiel: Partial<AccumLargeur>,
): void {
  const a = ACCUM.get(cle);
  if (a === undefined) return;
  const l = String(largeur) as LargeurCle;
  a.largeurs[l] = { ...a.largeurs[l], ...partiel };
}

/**
 * `haut` (viewport) puis `pleine` (redimensionnée, plafonnée) — point 1.a.
 *
 * `mesurer` s'exécute ENTRE les deux captures, jamais avant la première —
 * *mesuré en construisant cet outil* (point 1 du ticket
 * 9G7-AUDIT-COMPLEMENT) : `mesurerLaPage` focus programmatiquement `#contenu`
 * (`mesures.ts`), et ce focus décale le défilement de la page sur certains
 * écrans (le h1 se retrouve sous le bandeau, à y=21, au lieu de sa position
 * réelle). Appeler la mesure APRÈS la capture « haut » protège cette
 * capture-là ; la capture « pleine » n'y est pas sensible, le viewport y
 * étant agrandi au contenu entier (le défilement possible retombe à zéro).
 */
async function captureHautEtPleine<T>(
  page: Page,
  dossier: string,
  prefixe: "site" | "maquette",
  largeur: Largeur,
  mesurer: () => Promise<T>,
): Promise<{ tronquee: boolean; mesures: T }> {
  const bufferHaut = await page.screenshot({ type: "jpeg", quality: 55 });
  writeFileSync(join(dossier, `${prefixe}-${largeur}-haut.jpg`), bufferHaut);

  const mesures = await mesurer();

  const hauteurViewport = HAUTEUR[largeur];
  const hauteurContenu = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const plafond = hauteurViewport * PLAFOND_HAUTEURS_ECRAN;
  const tronquee = hauteurContenu > plafond;
  const nouvelleHauteur = Math.max(
    hauteurViewport,
    Math.min(hauteurContenu, plafond),
  );
  await page.setViewportSize({ width: largeur, height: nouvelleHauteur });
  await page.waitForTimeout(80);
  const bufferPleine = await page.screenshot({ type: "jpeg", quality: 55 });
  writeFileSync(
    join(dossier, `${prefixe}-${largeur}-pleine.jpg`),
    bufferPleine,
  );
  await page.setViewportSize({ width: largeur, height: hauteurViewport });
  return { tronquee, mesures };
}

async function texteVisible(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      document.querySelector("main")?.textContent ??
      document.body.textContent ??
      ""
    )
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function capturerEtMesurerSite(
  page: Page,
  instrumentation: Instrumentation,
  route: string,
  cle: string,
  largeur: Largeur,
): Promise<void> {
  const dossier = join(DOSSIER_ECRANS, cle);
  mkdirSync(dossier, { recursive: true });
  instrumentation.demarrerReleve();
  try {
    await page.goto(route, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(150);
    const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
      page,
      dossier,
      "site",
      largeur,
      () => mesurerLaPage(page),
    );
    const reseau = instrumentation.releve();
    writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
    fusionnerLargeur(cle, largeur, {
      statut: "capturee",
      mesuresSite,
      reseau,
      urlFinale: page.url(),
      siteTronquee: tronquee,
    });
  } catch (erreur) {
    fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
  }
}

async function capturerMaquette(
  context: BrowserContext,
  hash: string | null,
  cle: string,
  largeur: Largeur,
): Promise<void> {
  if (hash === null) return;
  const dossier = join(DOSSIER_ECRANS, cle);
  mkdirSync(dossier, { recursive: true });
  const page = await context.newPage();
  try {
    await page.goto(MAQUETTE.replace(/#.*$/, "") + hash, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(150);
    const { tronquee, mesures: mesuresMaquette } = await captureHautEtPleine(
      page,
      dossier,
      "maquette",
      largeur,
      () => mesurerLaPage(page),
    );
    writeFileSync(
      join(dossier, "texte-maquette.txt"),
      await texteVisible(page),
    );
    fusionnerLargeur(cle, largeur, {
      maquetteExiste: true,
      mesuresMaquette,
      maquetteTronquee: tronquee,
    });
  } catch (erreur) {
    fusionnerLargeur(cle, largeur, {
      maquetteExiste: false,
      note: `Maquette : ${String(erreur)}`,
    });
  } finally {
    await page.close();
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

let instrAnonyme1280: Instrumentation;
let instrAnonyme375: Instrumentation;
let instrBureau1280: Instrumentation;
let instrBureau375: Instrumentation;
let instrTerrain1280: Instrumentation;
let instrTerrain375: Instrumentation;

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
  await ouvrirCompteDirectionAudit();

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

  instrAnonyme1280 = instrumenter(pageAnonyme1280);
  instrAnonyme375 = instrumenter(pageAnonyme375);
  instrBureau1280 = instrumenter(pageBureau1280);
  instrBureau375 = instrumenter(pageBureau375);
  instrTerrain1280 = instrumenter(pageTerrain1280);
  instrTerrain375 = instrumenter(pageTerrain375);

  await ouvrirLaSessionSensible(pageBureau1280, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await ouvrirLaSessionSensible(pageBureau375, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await connecterTerrain(pageTerrain1280);
  await connecterTerrain(pageTerrain375);

  // UNE DEMANDE À QUALIFIER (point 4 du ticket 9G7-AUDIT-COMPLEMENT) — « la
  // base d'épreuve n'en a aucune » (9F6A, passation) : déposée ICI, par le
  // VRAI chemin applicatif (`/api/demandes/creer`, même route que
  // `tests/e2e/9edz-nouvelle-demande.spec.ts`), jamais par une ligne SQL à la
  // main — `agence_id`, `depose_le` et `compteur_accuse_le` sont CALCULÉS
  // par `deposerDemande` (D13), les recalculer ici les ferait diverger en
  // silence (§9, 01/09). Seulement si le semis n'en pose vraiment aucune.
  if (reperes.demandeId === null && reperes.clientId && reperes.siteId) {
    const idDemande = uuidv7();
    const reponse = await pageBureau1280.request.post("/api/demandes/creer", {
      form: {
        id: idDemande,
        source: "appel",
        client_id: reperes.clientId,
        site_id: reperes.siteId,
        machine_id: "",
        description: fr["9edz2.e2e.description"],
      },
      maxRedirects: 0,
    });
    if (reponse.status() === 303) {
      reperes = { ...reperes, demandeId: idDemande };
    }
  }
});

test.afterAll(async () => {
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
  await fermerCompteDirectionAudit();

  // ── LE DOSSIER, ÉCRIT UNE SEULE FOIS, QUAND TOUT EST CAPTURÉ ────────────
  const entrees: EntreeDossier[] = [];
  for (const [cle, accum] of ACCUM) {
    const avecVerdict = calculerLesVerdicts({
      cle,
      zone: accum.zone,
      libelle: accum.libelle,
      route: accum.route,
      role: accum.role,
      etat: accum.etat,
      maquetteHash: accum.maquetteHash,
      largeurs: accum.largeurs,
    });
    ecrireLaFicheDUnEcran(avecVerdict);
    entrees.push(avecVerdict);
  }
  ecrireIndex(entrees);
  ecrireRepartition(entrees);
});

function pageDAcces(
  acces: "anonyme" | "bureau" | "terrain",
  largeur: Largeur,
): { page: Page; instr: Instrumentation } {
  if (acces === "anonyme") {
    return largeur === 1280
      ? { page: pageAnonyme1280, instr: instrAnonyme1280 }
      : { page: pageAnonyme375, instr: instrAnonyme375 };
  }
  if (acces === "bureau") {
    return largeur === 1280
      ? { page: pageBureau1280, instr: instrBureau1280 }
      : { page: pageBureau375, instr: instrBureau375 };
  }
  return largeur === 1280
    ? { page: pageTerrain1280, instr: instrTerrain1280 }
    : { page: pageTerrain375, instr: instrTerrain375 };
}

function contexteMaquette(largeur: Largeur): BrowserContext {
  return largeur === 1280 ? maquette1280 : maquette375;
}

function roleDe(acces: string): string {
  if (acces === "anonyme") return "anonyme";
  if (acces === "bureau")
    return "admin_societe (bureau, COMPTE_ADMIN_SOCIETE_EPREUVE)";
  if (acces === "terrain") return "technicien (COMPTE_TECHNICIEN_EPREUVE)";
  return "spécial, voir note";
}

for (const entree of CATALOGUE) {
  test(`${entree.zone} · ${entree.libelle}`, async () => {
    obtenir(
      entree.cle,
      entree.zone,
      entree.libelle,
      typeof entree.route === "function" ? null : entree.route,
      roleDe(entree.acces),
      entree.maquetteHash,
      entree.note,
    );

    for (const largeur of LARGEURS) {
      await capturerMaquette(
        contexteMaquette(largeur),
        entree.maquetteHash,
        entree.cle,
        largeur,
      );
    }

    if (entree.acces === "special") {
      // Capturée par un bloc dédié plus bas (connexion/code, enrôlement,
      // premier accès, portail) — rien de plus à faire ici.
      return;
    }

    const route =
      typeof entree.route === "function" ? entree.route(reperes) : entree.route;
    const a = ACCUM.get(entree.cle);
    if (a) a.route = route;

    if (route === null) {
      fusionnerLargeur(entree.cle, 1280, {
        statut: "absente",
        note: entree.note ?? "Aucune ligne trouvée en base pour cet écran.",
        maquetteExiste: a?.largeurs["1280"].maquetteExiste ?? false,
      });
      fusionnerLargeur(entree.cle, 375, {
        statut: "absente",
        note: entree.note ?? "Aucune ligne trouvée en base pour cet écran.",
        maquetteExiste: a?.largeurs["375"].maquetteExiste ?? false,
      });
      return;
    }

    for (const largeur of LARGEURS) {
      const { page, instr } = pageDAcces(entree.acces, largeur);
      await capturerEtMesurerSite(page, instr, route, entree.cle, largeur);
    }
  });
}

// ── LES CAPTURES SPÉCIALES (section Accès) ─────────────────────────────────

test("Accès · Code du second facteur (capture spéciale)", async ({
  browser,
}) => {
  const cle = cleDe("#/connexion/code");
  const maquetteHash = avecRole("#/connexion/code", Role.direction);
  obtenir(
    cle,
    "Accès",
    "Code du second facteur (et code de secours)",
    null,
    Role.direction,
    maquetteHash,
  );
  for (const largeur of LARGEURS) {
    await capturerMaquette(
      contexteMaquette(largeur),
      maquetteHash,
      cle,
      largeur,
    );
  }
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    const dossier = join(DOSSIER_ECRANS, cle);
    mkdirSync(dossier, { recursive: true });
    instr.demarrerReleve();
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
      const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
        page,
        dossier,
        "site",
        largeur,
        () => mesurerLaPage(page),
      );
      const reseau = instr.releve();
      writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
      fusionnerLargeur(cle, largeur, {
        statut: "capturee",
        mesuresSite,
        reseau,
        urlFinale: page.url(),
        siteTronquee: tronquee,
      });
      const a = ACCUM.get(cle);
      if (a) a.route = "/connexion/code";
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Activer le second facteur (capture spéciale)", async ({
  browser,
}) => {
  const cle = cleDe("#/enrolement");
  const maquetteHash = avecRole("#/enrolement", Role.direction);
  obtenir(
    cle,
    "Accès",
    "Activer le second facteur",
    null,
    Role.direction,
    maquetteHash,
  );
  for (const largeur of LARGEURS) {
    await capturerMaquette(
      contexteMaquette(largeur),
      maquetteHash,
      cle,
      largeur,
    );
  }
  const { email, motDePasse } = await ouvrirCompteAdminSocieteNonEnrole();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    const dossier = join(DOSSIER_ECRANS, cle);
    mkdirSync(dossier, { recursive: true });
    instr.demarrerReleve();
    try {
      await page.goto("/connexion");
      await page.getByLabel(fr["connexion.email"]).fill(email);
      await page.getByLabel(fr["connexion.mot_de_passe"]).fill(motDePasse);
      await page.getByRole("button", { name: fr["connexion.valider"] }).click();
      await page.waitForURL(/\/enrolement/, { timeout: 15_000 });
      await page.waitForTimeout(150);
      const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
        page,
        dossier,
        "site",
        largeur,
        () => mesurerLaPage(page),
      );
      const reseau = instr.releve();
      writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
      fusionnerLargeur(cle, largeur, {
        statut: "capturee",
        mesuresSite,
        reseau,
        urlFinale: page.url(),
        siteTronquee: tronquee,
      });
      const a = ACCUM.get(cle);
      if (a) a.route = "/enrolement";
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Premier accès, non consommé (capture spéciale)", async ({
  browser,
}) => {
  const cle = cleDe("#/premier-acces");
  const maquetteHash = avecRole("#/premier-acces", Role.adv);
  obtenir(
    cle,
    "Accès",
    "Premier accès (lien d'accès)",
    null,
    Role.adv,
    maquetteHash,
  );
  for (const largeur of LARGEURS) {
    await capturerMaquette(
      contexteMaquette(largeur),
      maquetteHash,
      cle,
      largeur,
    );
  }
  const url = await urlDePremierAccesNonConsomme();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    const dossier = join(DOSSIER_ECRANS, cle);
    mkdirSync(dossier, { recursive: true });
    instr.demarrerReleve();
    try {
      await page.goto(url);
      await page.waitForTimeout(150);
      const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
        page,
        dossier,
        "site",
        largeur,
        () => mesurerLaPage(page),
      );
      const reseau = instr.releve();
      writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
      fusionnerLargeur(cle, largeur, {
        statut: "capturee",
        mesuresSite,
        reseau,
        urlFinale: page.url(),
        siteTronquee: tronquee,
      });
      const a = ACCUM.get(cle);
      if (a) a.route = url;
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});

test("Accès · Lien d'accès expiré (capture spéciale)", async ({ browser }) => {
  const cle = cleDe("#/premier-acces?cas=expire");
  const maquetteHash = avecRole("#/premier-acces?cas=expire", Role.adv);
  obtenir(cle, "Accès", "Lien d'accès expiré", null, Role.adv, maquetteHash);
  for (const largeur of LARGEURS) {
    await capturerMaquette(
      contexteMaquette(largeur),
      maquetteHash,
      cle,
      largeur,
    );
  }
  const url = await urlDeLienDejaConsomme();
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    const dossier = join(DOSSIER_ECRANS, cle);
    mkdirSync(dossier, { recursive: true });
    instr.demarrerReleve();
    try {
      await page.goto(url);
      await page.waitForTimeout(150);
      const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
        page,
        dossier,
        "site",
        largeur,
        () => mesurerLaPage(page),
      );
      const reseau = instr.releve();
      writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
      fusionnerLargeur(cle, largeur, {
        statut: "capturee",
        mesuresSite,
        reseau,
        urlFinale: page.url(),
        siteTronquee: tronquee,
      });
      const a = ACCUM.get(cle);
      if (a) a.route = url;
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});

// ── « CHOISIR LA SOCIÉTÉ » (point 5 du ticket 9G7-AUDIT-COMPLEMENT) ────────
// Non entreprise par 9F6A : « compte habilité sur au moins deux sociétés
// requis ; la scène n'en écrit qu'une par identité ». `ouvrirCompteMultiSociete`
// (`comptes.ts`) ouvre une identité dédiée sur CODIMA-NC ET CODIMA-EU.

test("Accès · Choisir la société (capture spéciale)", async ({ browser }) => {
  // `cle` et sa maquette existent DÉJÀ — la boucle du catalogue les a posés
  // (acces: "special" y capture la maquette, puis s'arrête) : ce bloc ne
  // réécrit QUE le site, par-dessus l'« absente » du catalogue.
  const cle = cleDe("#/arrivee");
  const identite = await ouvrirCompteMultiSociete();
  if (identite === null) {
    fusionnerLargeur(cle, 1280, {
      statut: "absente",
      note: "Identité multi-société non fraîche pour ce run — abandon propre (point 5).",
      maquetteExiste: ACCUM.get(cle)?.largeurs["1280"].maquetteExiste ?? false,
    });
    fusionnerLargeur(cle, 375, {
      statut: "absente",
      note: "Identité multi-société non fraîche pour ce run — abandon propre (point 5).",
      maquetteExiste: ACCUM.get(cle)?.largeurs["375"].maquetteExiste ?? false,
    });
    return;
  }
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    instr.demarrerReleve();
    try {
      await page.goto("/connexion");
      await page.getByLabel(fr["connexion.email"]).fill(identite.email);
      await page
        .getByLabel(fr["connexion.mot_de_passe"])
        .fill(identite.motDePasse);
      await page.getByRole("button", { name: fr["connexion.valider"] }).click();
      await page.waitForURL(/\/arrivee/, { timeout: 15_000 });
      await capturerEtMesurerSite(page, instr, "/arrivee", cle, largeur);
      const a = ACCUM.get(cle);
      if (a) a.route = "/arrivee";
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});

// ── LE TERRAIN PILOTÉ (point 2 du ticket 9G7-AUDIT-COMPLEMENT) ─────────────
//
// `reperes.interventionTerrainADemarrer` est l'intervention `affectee` du
// technicien de la scène, déjà capturée « à démarrer » par la boucle du
// catalogue, PLUS HAUT dans ce fichier (en mode sériel, l'ordre
// d'ENREGISTREMENT des `test()` est l'ordre d'EXÉCUTION : ce bloc, enregistré
// après, s'exécute après). Ce test pilote la MÊME intervention jusqu'à « en
// cours », rapport rempli, signée — et réécrit les clés que la boucle du
// catalogue avait posées `absente` pour « Intervention en cours », « Rapport »
// et « Signature et fin » (9F6A ne pouvait pas les capturer : aucune
// intervention `en_cours` du semis n'appartenait à ce technicien, et le
// rapport/la signature ne s'atteignent que par une action, jamais par une
// URL directe).

const COMMENTAIRE_PILOTE = fr["terrain.e2e.commentaire"];
const SUITE_PILOTE = fr["terrain.e2e.suite_a_donner"];
const SIGNATAIRE_PILOTE = fr["terrain.e2e.signataire_nom"];

/** Un PNG minimal (1×1, transparent) — même fixture que `rapport-terrain.spec.ts`. */
function fichierPhotoPilote(): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9g7-"));
  const chemin = join(dossier, "photo-9g7.png");
  writeFileSync(
    chemin,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  return chemin;
}

/** Même geste que `rapport-terrain.spec.ts` : des événements pointeur réels, pas un clic simulé au niveau système. */
async function tracerLaSignaturePilote(page: Page): Promise<void> {
  await page.locator("canvas").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
          pointerId: 1,
        }),
      );
    };
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointermove", 200, 30);
    envoyer("pointerup", 200, 30);
  });
}

/** Capture + mesure l'état courant de la page, déjà positionnée — jamais de `goto` ici. */
async function capturerEtatPilote(
  page: Page,
  instr: Instrumentation,
  cle: string,
  largeur: Largeur,
): Promise<void> {
  const dossier = join(DOSSIER_ECRANS, cle);
  mkdirSync(dossier, { recursive: true });
  instr.demarrerReleve();
  const { tronquee, mesures: mesuresSite } = await captureHautEtPleine(
    page,
    dossier,
    "site",
    largeur,
    () => mesurerLaPage(page),
  );
  writeFileSync(join(dossier, "texte-site.txt"), await texteVisible(page));
  fusionnerLargeur(cle, largeur, {
    statut: "capturee",
    mesuresSite,
    reseau: instr.releve(),
    urlFinale: page.url(),
    siteTronquee: tronquee,
  });
}

test("Terrain · intervention pilotée (en cours, rapport, signature)", async ({
  browser,
}) => {
  const interventionId = reperes.interventionTerrainADemarrer;
  if (interventionId === null) {
    // Rien à piloter — déjà noté « absente » par la boucle du catalogue
    // (aucune intervention `affectee` pour le technicien de la scène).
    return;
  }

  const cleEnCours = cleDe("#/terrain/i/i436");
  const cleRapport = cleDe("#/terrain/i/i436/rapport");
  const cleSignature = cleDe("#/terrain/i/i436/signature");

  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    try {
      await connecterTerrain(page);
      await page.goto(`/terrain/${interventionId}`);
      await page.waitForTimeout(150);

      // DÉMARRER — seulement si le compteur ne tourne pas déjà : les deux
      // largeurs pilotent la MÊME intervention (état en base, partagé), la
      // seconde la trouve déjà démarrée.
      const boutonDemarrer = page.getByRole("button", {
        name: fr["terrain.compteur.demarrer"],
      });
      if (await boutonDemarrer.isVisible().catch(() => false)) {
        await boutonDemarrer.click();
        await expect(
          page.getByText(fr["terrain.compteur.tourne_depuis"], {
            exact: false,
          }),
        ).toBeVisible();
      }

      // ── « INTERVENTION EN COURS » — deux captures À 3 S D'ÉCART, pour
      // PROUVER que le compteur défile (point 2 du ticket), en plus de la
      // paire haut/pleine habituelle.
      await capturerEtatPilote(page, instr, cleEnCours, largeur);
      const dossierEnCours = join(DOSSIER_ECRANS, cleEnCours);
      const avant = await page.screenshot({ type: "jpeg", quality: 55 });
      writeFileSync(
        join(dossierEnCours, `site-${largeur}-compteur-t0.jpg`),
        avant,
      );
      await page.waitForTimeout(3000);
      const apres = await page.screenshot({ type: "jpeg", quality: 55 });
      writeFileSync(
        join(dossierEnCours, `site-${largeur}-compteur-t3.jpg`),
        apres,
      );

      // ── RAPPORT — commentaire, suite à donner, une photo. Rempli une
      // seule fois : la seconde largeur trouve déjà les champs servis.
      const commentaireDejaServi = await page
        .getByLabel(fr["terrain.rapport.commentaire_libelle"])
        .inputValue();
      if (commentaireDejaServi.length === 0) {
        await page
          .getByLabel(fr["terrain.rapport.commentaire_libelle"])
          .fill(COMMENTAIRE_PILOTE);
        await page
          .getByLabel(fr["terrain.rapport.suite_libelle"])
          .fill(SUITE_PILOTE);
        await page.getByLabel(fr["terrain.rapport.suite_libelle"]).blur();
        await expect(
          page.getByText(fr["terrain.rapport.enregistre"]),
        ).toBeVisible();

        await page
          .locator('input[type="file"]')
          .setInputFiles(fichierPhotoPilote());
        await page
          .getByRole("button", { name: fr["terrain.photos.ajouter"] })
          .click();
        await expect(
          page.getByText(fr["terrain.photos.enregistree"]),
        ).toBeVisible();
      }
      await capturerEtatPilote(page, instr, cleRapport, largeur);

      // ── SIGNATURE — si pas déjà tracée par l'autre largeur.
      const dejaSignee = await page
        .getByText(fr["terrain.signature.deja_signee"])
        .isVisible()
        .catch(() => false);
      if (!dejaSignee) {
        await page
          .getByRole("button", { name: fr["terrain.signature.option_signee"] })
          .click();
        await page
          .getByLabel(fr["terrain.signature.nom_libelle"])
          .fill(SIGNATAIRE_PILOTE);
        await tracerLaSignaturePilote(page);
        await expect(
          page.getByText(fr["terrain.signature.enregistre"]),
        ).toBeVisible();
      }

      // LE BOUTON « TERMINER » NE SE GRISE JAMAIS — son refus prend SA
      // PLACE (`app/(mobile)/terrain/[id]/page.tsx`, commentaire au-dessus
      // de `verdictTerminer`) : sa seule PRÉSENCE dit qu'il est actif.
      await expect(
        page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).toBeVisible();

      await capturerEtatPilote(page, instr, cleSignature, largeur);

      // ── COQUILLE HORS RÉSEAU UTILISABLE — la copie SERT DÉJÀ (SW +
      // IndexedDB, visite en ligne ci-dessus) : `context.setOffline(true)`
      // coupe la pile réseau du NAVIGATEUR, jamais un `goto` joué hors
      // connexion — même discipline que `tests/e2e/offline/
      // 9f4h3-mode-avion.spec.ts` (voir son en-tête) : une NAVIGATION hors
      // réseau n'est pas mesurable ici, la coupure survient sur la page
      // DÉJÀ montée.
      const cleFicheHorsReseau = "terrain-hors-reseau-fiche-utilisable";
      obtenir(
        cleFicheHorsReseau,
        "Terrain",
        "Fiche hors réseau, utilisable (compteur, rapport, prestations, photos, signature, Terminer gardé)",
        `/terrain/${interventionId}`,
        "technicien (COMPTE_TECHNICIEN_EPREUVE)",
        null,
      );
      await ctx.setOffline(true);
      await expect(
        page.getByRole("heading", { name: fr["terrain.compteur"] }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: fr["terrain.prestations.titre"] }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: fr["terrain.photos.titre"] }),
      ).toBeVisible();
      // `deja_signee` ne s'affiche qu'APRÈS un rechargement (comme dans
      // `rapport-terrain.spec.ts`) — ici la session reste celle qui vient
      // de signer, sans recharger : le titre de la section suffit à prouver
      // qu'elle reste visible et utilisable hors réseau.
      await expect(
        page.getByRole("heading", { name: fr["terrain.signature.titre"] }),
      ).toBeVisible();
      // GARDÉ, PAS GRISÉ (même discipline que ci-dessus) : visible hors
      // réseau comme en ligne, le serveur restant l'arbitre final à l'envoi
      // (9F4H3-HORS-RESEAU-ENVOYER, décision n° 108).
      await expect(
        page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
      ).toBeVisible();
      await capturerEtatPilote(page, instr, cleFicheHorsReseau, largeur);
      await ctx.setOffline(false);

      // ── « MA JOURNÉE » HORS RÉSEAU — retour en ligne pour NAVIGUER
      // (même règle : jamais de `goto` hors connexion), puis coupure sur la
      // page déjà montée.
      const cleJourneeHorsReseau = "terrain-hors-reseau-journee-utilisable";
      obtenir(
        cleJourneeHorsReseau,
        "Terrain",
        "Ma journée, hors réseau (copie présente)",
        "/terrain",
        "technicien (COMPTE_TECHNICIEN_EPREUVE)",
        null,
      );
      await page.goto("/terrain");
      await page.waitForTimeout(150);
      await ctx.setOffline(true);
      await capturerEtatPilote(page, instr, cleJourneeHorsReseau, largeur);
      await ctx.setOffline(false);
    } catch (erreur) {
      fusionnerLargeur(cleEnCours, largeur, {
        statut: "echec",
        note: String(erreur),
      });
    } finally {
      await ctx.close();
    }
  }
});

// ── LE BALAYAGE PAR RÔLE — TABLEAU DE BORD (point 2.d) ─────────────────────
// admin_societe est déjà couvert par l'entrée « Tableau de bord » du
// catalogue (contexte bureau, ci-dessus) : les CINQ autres rôles de la
// scène sont ouverts ici, chacun sa propre session.

const ROLES_SUPPLEMENTAIRES: readonly {
  readonly role: string;
  readonly email: string;
  readonly maquetteToken: string;
}[] = [
  { role: Role.adv, email: COMPTE_EPREUVE, maquetteToken: Role.adv },
  {
    role: Role.technicien,
    email: COMPTE_TECHNICIEN_EPREUVE,
    maquetteToken: "technicien",
  },
  {
    role: Role.responsable_materiel,
    email: COMPTE_RM_EPREUVE,
    maquetteToken: "resp_materiel",
  },
  {
    role: Role.responsable_sav,
    email: COMPTE_RS_EPREUVE,
    maquetteToken: "resp_sav",
  },
  {
    role: Role.direction,
    email: EMAIL_DIRECTION_AUDIT,
    maquetteToken: Role.direction,
  },
];

for (const { role, email, maquetteToken } of ROLES_SUPPLEMENTAIRES) {
  test(`Exploitation · Tableau de bord (rôle ${role})`, async ({ browser }) => {
    const cle = `tableau-de-bord-${role}`;
    const maquetteHash = avecRole("#/tableau-de-bord", maquetteToken);
    obtenir(
      cle,
      "Exploitation",
      `Tableau de bord — rôle ${role}`,
      "/tableau-de-bord",
      `${role} (${email})`,
      maquetteHash,
    );
    for (const largeur of LARGEURS) {
      await capturerMaquette(
        contexteMaquette(largeur),
        maquetteHash,
        cle,
        largeur,
      );
    }
    for (const largeur of LARGEURS) {
      const ctx = await browser.newContext({
        viewport: { width: largeur, height: HAUTEUR[largeur] },
        deviceScaleFactor: 0.5,
      });
      const page = await ctx.newPage();
      const instr = instrumenter(page);
      instr.demarrerReleve();
      try {
        await ouvrirLaSessionSensible(page, email);
        await capturerEtMesurerSite(
          page,
          instr,
          "/tableau-de-bord",
          cle,
          largeur,
        );
      } catch (erreur) {
        fusionnerLargeur(cle, largeur, {
          statut: "echec",
          note: String(erreur),
        });
      } finally {
        await ctx.close();
      }
    }
  });
}

// ── MONTANTS ET BON INTERNE, RÔLE ADV ET DIRECTION (point 3 du ticket
// 9G7-AUDIT-COMPLEMENT) — CAN.montants EXCLUT "admin" côté maquette (point 1)
// et admin_societe côté site (même fait, vérifié en lisant
// components/terrain/rapport-automatique.tsx et la carte Valorisation de la
// maquette) : les captures « onglet Valorisation » et « Bon » plus haut, en
// admin_societe, ne montrent donc JAMAIS de montant. Ces deux rôles-ci les
// voient — nécessaires pour qu'un agent de l'audit puisse comparer.

const ROLES_MONTANTS: readonly {
  readonly role: string;
  readonly email: string;
}[] = [
  { role: Role.adv, email: COMPTE_EPREUVE },
  { role: Role.direction, email: EMAIL_DIRECTION_AUDIT },
];

for (const { role, email } of ROLES_MONTANTS) {
  test(`Exploitation · Valorisation et bon interne (rôle ${role})`, async ({
    browser,
  }) => {
    const interventionId = reperes.interventionAvecBon;
    if (interventionId === null) return;

    const cleValo = `interventions-onglet-valorisation-${role}`;
    const cleBon = `interventions-bon-interne-${role}`;
    obtenir(
      cleValo,
      "Exploitation",
      `Fiche intervention — onglet Valorisation (rôle ${role})`,
      `/interventions/${interventionId}?onglet=valorisation`,
      `${role} (${email})`,
      null,
    );
    obtenir(
      cleBon,
      "Exploitation",
      `Bon d'intervention — version interne (rôle ${role})`,
      `/interventions/${interventionId}/bon?version=interne`,
      `${role} (${email})`,
      null,
    );

    for (const largeur of LARGEURS) {
      const ctx = await browser.newContext({
        viewport: { width: largeur, height: HAUTEUR[largeur] },
        deviceScaleFactor: 0.5,
      });
      const page = await ctx.newPage();
      const instr = instrumenter(page);
      try {
        await ouvrirLaSessionSensible(page, email);
        await capturerEtMesurerSite(
          page,
          instr,
          `/interventions/${interventionId}?onglet=valorisation`,
          cleValo,
          largeur,
        );
        await capturerEtMesurerSite(
          page,
          instr,
          `/interventions/${interventionId}/bon?version=interne`,
          cleBon,
          largeur,
        );
      } catch (erreur) {
        fusionnerLargeur(cleValo, largeur, {
          statut: "echec",
          note: String(erreur),
        });
      } finally {
        await ctx.close();
      }
    }
  });
}

// ── LE PORTAIL CLIENT (point 2.d) — ABANDON PROPRE SI L'AMORÇAGE NE PASSE PAS

test("Hors V1 · Portail client (capture spéciale)", async ({ browser }) => {
  const cle =
    CATALOGUE.find((e) => e.libelle.startsWith("Portail"))?.cle ?? "portail";
  const maquetteHash = avecRole("#/portail", Role.adv);
  obtenir(
    cle,
    "Hors V1",
    "Portail client (aperçu)",
    null,
    "client (portail@example.test)",
    maquetteHash,
  );
  for (const largeur of LARGEURS) {
    await capturerMaquette(
      contexteMaquette(largeur),
      maquetteHash,
      cle,
      largeur,
    );
  }
  const identite = await ouvrirSessionPortailDeDemonstration();
  if (identite === null) {
    fusionnerLargeur(cle, 1280, {
      statut: "absente",
      note: "Amorçage du compte portail de démonstration refusé — abandon propre (point 2.d).",
      maquetteExiste: ACCUM.get(cle)?.largeurs["1280"].maquetteExiste ?? false,
    });
    fusionnerLargeur(cle, 375, {
      statut: "absente",
      note: "Amorçage du compte portail de démonstration refusé — abandon propre (point 2.d).",
      maquetteExiste: ACCUM.get(cle)?.largeurs["375"].maquetteExiste ?? false,
    });
    return;
  }
  for (const largeur of LARGEURS) {
    const ctx = await browser.newContext({
      viewport: { width: largeur, height: HAUTEUR[largeur] },
      deviceScaleFactor: 0.5,
    });
    const page = await ctx.newPage();
    const instr = instrumenter(page);
    instr.demarrerReleve();
    try {
      await page.goto("/connexion");
      await page.getByLabel(fr["connexion.email"]).fill(identite.email);
      await page
        .getByLabel(fr["connexion.mot_de_passe"])
        .fill(identite.motDePasse);
      await page.getByRole("button", { name: fr["connexion.valider"] }).click();
      await page.waitForURL(/\/portail/, { timeout: 15_000 });
      await capturerEtMesurerSite(page, instr, "/portail", cle, largeur);
    } catch (erreur) {
      fusionnerLargeur(cle, largeur, { statut: "echec", note: String(erreur) });
    } finally {
      await ctx.close();
    }
  }
});
