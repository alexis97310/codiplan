import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * 9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE (D143, décision d'Alexis du
 * 22/10/2026) — « envoyer les seuls changements », EN LIGNE comme hors
 * réseau : ce que le bureau coche n'est jamais effacé par la fiche.
 *
 * Avant ce ticket, l'envoi EN LIGNE direct soumettait l'ENSEMBLE ENTIER des
 * prestations cochées à l'écran — une prestation D cochée par le BUREAU
 * PENDANT que la fiche était ouverte disparaissait au premier coche EN
 * LIGNE du technicien, puisque son écran ne la connaissait pas (revue du
 * pilote sur `013857b7`, 22/10/2026). `tests/unit/terrain/rapport-
 * automatique.test.tsx` mesure déjà ce défaut à l'unité ; ce fichier le
 * mesure de bout en bout, SANS JAMAIS COUPER LE RÉSEAU pour les points
 * 1(a) et 1(b) — le defaut d'origine n'existait QUE sur ce chemin EN
 * LIGNE, le chemin hors réseau (file) le tenait déjà. Le point 1(c) rejoue
 * la même propriété hors réseau, pour prouver que les deux chemins
 * convergent désormais (même route, même logique de différence).
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6E = uuidv7();
const SITE_9F4H6E = uuidv7();
const INTERVENTION_9F4H6E = uuidv7();
const PRESTATION_C = uuidv7();
const PRESTATION_D = uuidv7();

const LIBELLE_C = "9F4H6E — prestation du technicien (C)";
const LIBELLE_D = "9F4H6E — prestation du bureau (D)";

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9F4H6E,
        societe_id: societeId,
        raison_sociale: "9F4H6E client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6E,
        societe_id: societeId,
        client_id: CLIENT_9F4H6E,
        agence_id: agence.id,
        libelle: "9F4H6E site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_C,
        societe_id: societeId,
        code: "9F4H6E-C",
        libelle: LIBELLE_C,
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_D,
        societe_id: societeId,
        code: "9F4H6E-D",
        libelle: LIBELLE_D,
        actif: true,
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H6E,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H6E,
        site_id: SITE_9F4H6E,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H6E — intervention forgée par l'épreuve",
        statut: "affectee",
        date_planifiee: null,
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
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      INTERVENTION_9F4H6E,
    );
    await client.prestation.deleteMany({
      where: { id: { in: [PRESTATION_C, PRESTATION_D] } },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6E } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6E } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H6E-PRESTATIONS-DIFFERENCE-EN-LIGNE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function prestationsServeur(
  interventionId: string,
): Promise<ReadonlySet<string>> {
  const client = admin();
  try {
    const lignes = await client.interventionPrestation.findMany({
      where: { intervention_id: interventionId },
      select: { prestation_id: true },
    });
    return new Set(lignes.map((l) => l.prestation_id));
  } finally {
    await client.$disconnect();
  }
}

test("point 1(a) — EN LIGNE, le bureau coche D pendant que la fiche est ouverte, puis le technicien coche C : C ET D restent côté serveur", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H6E}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  const caseC = page.getByRole("checkbox", { name: LIBELLE_C, exact: true });
  const caseD = page.getByRole("checkbox", { name: LIBELLE_D, exact: true });
  await expect(caseC).not.toBeChecked();
  await expect(caseD).not.toBeChecked();

  // LE BUREAU COCHE D, DIRECTEMENT EN BASE — AUCUNE COUPURE RÉSEAU ICI :
  // cette fiche, EN LIGNE, n'a RIEN fait localement pour D.
  const bureau = admin();
  try {
    await bureau.interventionPrestation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_9F4H6E,
        prestation_id: PRESTATION_D,
      },
    });
  } finally {
    await bureau.$disconnect();
  }

  // LE TECHNICIEN COCHE C, TOUJOURS EN LIGNE — avant ce ticket, cet envoi
  // soumettait l'ENSEMBLE ENTIER affiché par CET écran (qui ne connaît pas
  // encore D) et effaçait D du serveur.
  await caseC.check();
  await expect(
    page.getByText(fr["terrain.prestations.enregistre"]),
  ).toBeVisible();

  await expect
    .poll(() => prestationsServeur(INTERVENTION_9F4H6E))
    .toEqual(new Set([PRESTATION_C, PRESTATION_D]));

  await caseC.scrollIntoViewIfNeeded();
  await capturer(page, "fiche-c-et-d-cochees", 375);
  await capturer(page, "fiche-c-et-d-cochees", 1280);
});

test("point 1(b) — EN LIGNE, le technicien décoche C : C disparaît du serveur, D reste intacte", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H6E}`);
  const caseC = page.getByRole("checkbox", { name: LIBELLE_C, exact: true });
  const caseD = page.getByRole("checkbox", { name: LIBELLE_D, exact: true });
  await expect(caseC).toBeChecked();
  await expect(caseD).toBeChecked();

  await caseC.uncheck();
  await expect(
    page.getByText(fr["terrain.prestations.enregistre"]),
  ).toBeVisible();

  await expect
    .poll(() => prestationsServeur(INTERVENTION_9F4H6E))
    .toEqual(new Set([PRESTATION_D]));
});

test("point 1(c) — HORS RÉSEAU puis Envoyer : la même différence s'applique, D n'est jamais effacée", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_9F4H6E}`);
  const caseC = page.getByRole("checkbox", { name: LIBELLE_C, exact: true });
  const caseD = page.getByRole("checkbox", { name: LIBELLE_D, exact: true });
  await expect(caseC).not.toBeChecked();
  await expect(caseD).toBeChecked();

  await context.setOffline(true);
  await caseC.check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  await context.setOffline(false);
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  await expect
    .poll(() => prestationsServeur(INTERVENTION_9F4H6E))
    .toEqual(new Set([PRESTATION_C, PRESTATION_D]));
});
