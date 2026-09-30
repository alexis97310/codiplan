import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";
import { mesurer } from "@/scripts/lib/mesure-captures";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CK-PG-G11B-JOUR-SUITE (D147, 30/09/2026) — même recette que
 * `captures-pg-b2-fenetre-pose.spec.ts` et `captures-pg-b4-survol-cases.spec.ts` :
 * AVANT sur le code d'avant ce ticket (`git worktree` sur le commit
 * `791f927`, le dernier avant le premier commit DE CODE de ce ticket — le
 * commit D147 lui-même est documentaire seul), APRÈS sur le code livré.
 * Les sélecteurs qui décident de la capture sont, autant que possible, des
 * CHAÎNES déjà présentes AVANT (`[data-bloc]`, `[data-fenetre-pose]`) : seule
 * leur VALEUR change (le libellé, `data-heure`), jamais leur existence.
 *
 * SA PROPRE SCÈNE (I9), préfixée `PGD1B-`, sur un mardi TRÈS éloigné
 * (`OFFSET_SEMAINES`, distinct de celui de `planning-jour-suite.spec.ts`)
 * pour n'entrer en collision ni avec le semis ni avec cet autre fichier.
 *
 * `CAPTURES_PGD1B` pilote le dossier de sortie — vide, aucune capture n'est
 * écrite (même discipline que les captures citées ci-dessus).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGD1B ?? "";
const OFFSET_SEMAINES = 434;
const DELAI_DEPLACEMENT_MS = 10_500;

const ID_SANS_HEURE = uuidv7();
const ID_FILE = uuidv7();

let reperes: ReperesDeScene;
let jourCle: string;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), OFFSET_SEMAINES);
  jourCle = cleDeJour(jour);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    // UNE LIGNE « HEURE À FIXER », DURÉE CONNUE (glisser direct — écran a et c).
    await client.intervention.create({
      data: {
        id: ID_SANS_HEURE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienKone,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGD1B- capture ligne sans heure",
      },
    });
    // UNE CARTE DE LA FILE, SANS TECHNICIEN NI DURÉE (écran b).
    await client.intervention.create({
      data: {
        id: ID_FILE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGD1B- capture carte de la file",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [ID_SANS_HEURE, ID_FILE],
    );
    await client.intervention.deleteMany({
      where: { id: { in: [ID_SANS_HEURE, ID_FILE] } },
    });
  } finally {
    await client.$disconnect();
  }
});

/**
 * LA MESURE DU SCRIPT DE CAPTURES — même seuils, même collecte que
 * `scripts/captures.mts` (`scripts/lib/mesure-captures.ts`, fonction pure) :
 * texte < 12 px (D138), cible < 32×32 px au bureau (hors lien dans le texte),
 * débordement horizontal de la page. Les cibles ne sont mesurées qu'à 375 px
 * (téléphone) — même règle que `captures.mts`.
 */
async function mesurerEcran(page: Page, ecran: string, largeur: number) {
  const mesurerCibles = largeur === 375;
  const brut = (await page.evaluate(`(() => {
    const mesurerCiblesIci = ${mesurerCibles};
    const visible = (element) => {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const textes = [];
    for (const element of document.body.querySelectorAll("*")) {
      const porteDuTexteDirect = Array.from(element.childNodes).some(
        (noeud) => noeud.nodeType === Node.TEXT_NODE && (noeud.textContent ?? "").trim() !== "",
      );
      if (!porteDuTexteDirect || !visible(element)) continue;
      textes.push({
        element: element.tagName.toLowerCase(),
        taille: parseFloat(getComputedStyle(element).fontSize),
        graisse: parseFloat(getComputedStyle(element).fontWeight),
        debut: (element.innerText ?? element.textContent ?? "").trim().slice(0, 40),
      });
    }
    const cibles = [];
    if (mesurerCiblesIci) {
      const selecteur = "a, button, [role='button'], input:not([type='hidden']), select, textarea, summary";
      for (const element of document.querySelectorAll(selecteur)) {
        if (!visible(element)) continue;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        cibles.push({
          element: element.tagName.toLowerCase(),
          largeur: Math.round(rect.width),
          hauteur: Math.round(rect.height),
          debut: (element.innerText ?? element.textContent ?? "").trim().slice(0, 40),
          dansLeTexte: element.tagName === "A" && style.display === "inline",
        });
      }
    }
    return {
      textes,
      cibles,
      debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`)) as {
    textes: {
      element: string;
      taille: number;
      graisse: number;
      debut: string;
    }[];
    cibles: {
      element: string;
      largeur: number;
      hauteur: number;
      debut: string;
      dansLeTexte: boolean;
    }[];
    debordement: number;
  };
  const verdict = mesurer({
    ecran,
    largeur,
    terrain: false,
    textes: brut.textes,
    cibles: brut.cibles,
    debordement: brut.debordement,
    erreurs: [],
  });
  console.warn(
    `MESURE ${ecran}@${largeur} — textes<12px: ${verdict.textesSousLeSeuil.length}, cibles<32px: ${verdict.ciblesSousLeSeuil.length}, débordement: ${verdict.debordement}`,
  );
  if (verdict.textesSousLeSeuil.length > 0) {
    console.warn("  textes:", JSON.stringify(verdict.textesSousLeSeuil));
  }
  if (verdict.ciblesSousLeSeuil.length > 0) {
    console.warn("  cibles:", JSON.stringify(verdict.ciblesSousLeSeuil));
  }
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  await mesurerEcran(page, nom, largeur);
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

const LARGEURS = [
  { largeur: 1280, hauteur: 1000 },
  { largeur: 1024, hauteur: 1000 },
  { largeur: 375, hauteur: 900 },
] as const;

/* ── (a) LA LIGNE « HEURE À FIXER » ──────────────────────────────────────── */

for (const { largeur, hauteur } of LARGEURS) {
  test(`capture — la ligne « heure à fixer », à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);
    await page.goto(`/planning?vue=jour&jour=${jourCle}`);
    // SOUS 900 PX, LA FRISE CÈDE LA PLACE À `ListeJour` (PG-D4-TELEPHONE-
    // ONGLETS, D146) — même repli que `captures-pgd1-jour-frise.spec.ts` :
    // ni `data-tiroir-declencheur` de la frise ni `ligne-jour-sans-heure`
    // (interne à `VueJour`) n'y sont visibles ; `data-carte-liste` l'est.
    if (largeur <= 900) {
      await expect(
        page.locator(`[data-carte-liste="${ID_SANS_HEURE}"]`),
      ).toBeVisible();
    } else {
      await expect(
        page.locator('[data-maquette-bloc="ligne-jour-sans-heure"]'),
      ).toBeVisible();
    }
    await capturer(page, "ligne-sans-heure", largeur);
  });
}

/* ── (b) LA FENÊTRE DE POSE PRÉ-REMPLIE PAR LE DÉPÔT D'UNE CARTE ─────────── */

for (const { largeur, hauteur } of LARGEURS) {
  test(`capture — la fenêtre de pose ouverte depuis une carte de la file, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await ouvrirUneSession(page);

    if (largeur <= 900) {
      // SOUS 900 PX, LA COLONNE « À TRAITER » VIT DERRIÈRE SON ONGLET
      // (PG-D4-TELEPHONE-ONGLETS, D146) ; le glisser-déposer HTML5 n'a pas
      // d'équivalent tactile — le bouton « Poser » (PG-B2, inchangé par ce
      // ticket) ouvre la même fenêtre, SANS heure pré-remplie (aucune case).
      await page.goto(`/planning?vue=jour&jour=${jourCle}&volet=a_traiter`);
      const carte = page.locator(`[data-bloc="${ID_FILE}"]`);
      await expect(carte).toBeVisible();
      await carte
        .getByRole("button", { name: fr["planning.pose.bouton_poser"] })
        .click();
    } else {
      await page.goto(`/planning?vue=jour&jour=${jourCle}`);
      const source = page.locator(`[data-bloc="${ID_FILE}"]`);
      const cible = page.locator(
        `[data-depot-heure="600"][data-depot-technicien="${reperes.technicienKone}"]`,
      );
      await expect(source).toBeVisible();
      await expect(cible).toBeVisible();
      await glisser(page, source, cible);
    }

    const fenetre = page.locator(`[data-fenetre-pose="${ID_FILE}"]`);
    await expect(fenetre).toBeVisible();
    // LA DURÉE D'ABORD (spécification §3.10) — sans elle, le fieldset
    // « Heure de début » ne se dessine pas : c'est vrai AVANT ce ticket
    // comme APRÈS, la clé existant déjà (PG-B2).
    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();
    await capturer(page, "depot-fenetre-pose", largeur);
  });
}

/* ── (c) LE GLISSER EN COURS, ET LE BANDEAU DIFFÉRÉ — 1280px, APRÈS SEULEMENT ── */

test("capture — le glisser d'une carte « heure à fixer » en cours, puis le bandeau différé sur 14:00, à 1280px", async ({
  page,
}) => {
  // FENÊTRE HAUTE, SANS DÉFILEMENT VERTICAL : la carte « Heure à fixer » (en
  // tête de la frise) et la case 14:00 (dans le tableau, plus bas) tiennent
  // ainsi ensemble à l'écran.
  await page.setViewportSize({ width: 1280, height: 2000 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=jour&jour=${jourCle}`);

  const source = page.locator(`[data-bloc="${ID_SANS_HEURE}"]`);
  if ((await source.count()) === 0) {
    // N'EXISTE PAS AVANT CE TICKET — la carte « Heure à fixer » n'est glissable
    // que depuis ce lot (D147, point 5) : sur le code d'AVANT, cette section
    // n'est qu'une liste de liens, sans `[data-bloc]`. Rien à capturer.
    return;
  }
  const cible = page.locator(
    `[data-depot-heure="840"][data-depot-technicien="${reperes.technicienKone}"]`,
  );
  await expect(source).toBeVisible();
  await expect(cible).toBeVisible();
  // LA CASE 14:00 DÉBORDE HORIZONTALEMENT DU CADRE DÉFILANT DE LA FRISE
  // (`overflow-x-auto`, `CadreDefilant`) À 1280 PX : l'amener à l'écran
  // avant de mesurer sa boîte, sinon `elementFromPoint` n'y résout rien
  // (mesuré : sans ce défilement, la case tombe hors du viewport).
  await cible.scrollIntoViewIfNeeded();

  const depart = await source.boundingBox();
  const arrivee = await cible.boundingBox();
  if (depart === null || arrivee === null) {
    throw new Error("source ou cible sans boîte visible");
  }

  await page.mouse.move(
    depart.x + depart.width / 2,
    depart.y + depart.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    arrivee.x + arrivee.width / 2,
    arrivee.y + arrivee.height / 2,
    { steps: 20 },
  );
  await page
    .waitForSelector("[data-survol]", { timeout: 2000 })
    .catch(() => null);
  await capturer(page, "glisser-en-cours", 1280);

  // UN DERNIER PETIT MOUVEMENT AVANT LE RELÂCHER (voir `setup/glisser.ts`) :
  // Chromium n'accepte un dépôt qu'après au moins un `dragover` sur LA
  // CIBLE — un `mouse.up` immédiat après le grand déplacement ci-dessus rate
  // parfois ce dernier `dragover`.
  await page.mouse.move(
    arrivee.x + arrivee.width / 2 + 2,
    arrivee.y + arrivee.height / 2 + 2,
    { steps: 10 },
  );
  await page.mouse.up();
  await page.waitForSelector(
    `[data-deplacement-en-attente="${ID_SANS_HEURE}"]`,
    {
      timeout: 2000,
    },
  );
  await capturer(page, "bandeau-deplacement-differe", 1280);

  // LAISSER L'ÉCRITURE DIFFÉRÉE S'ACHEVER (PG-B5, QG-6) — sinon la ligne
  // resterait « en attente » côté serveur au-delà de la vie du test.
  await page.waitForTimeout(DELAI_DEPLACEMENT_MS);
});
