import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { fabriquerLeClasseurEquipements } from "./setup/classeur-equipements";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9L40-IMPORT-EXCEL-ANNEE-FABRICATION, DE BOUT EN BOUT (25/11/2026).
 *
 * ## Ce que les épreuves d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/application-import-materiel.test.ts` prouve que le DÉPÔT
 * conserve `annee_fabrication` ; il ne prouve pas que l'écran de modification
 * de la machine, puis celui de l'import, se succèdent sans que l'un efface ce
 * que l'autre vient d'écrire.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L40-`
 *
 * Un client et un site, créés en `beforeAll` sur le MODÈLE du semis (I9,
 * jamais une famille forgée par l'épreuve) — la MACHINE, elle, naît du
 * PREMIER import de ce scénario, exactement comme un parc réel se peuple.
 *
 * ## CAPTURES (consigne permanente d'Alexis)
 *
 * `CAPTURES_9L40` pose le dossier de sortie — absent, aucune capture n'est
 * prise.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L40 ?? "";

const CLIENT_9L40 = uuidv7();
const SITE_9L40 = uuidv7();
const RAISON_SOCIALE_9L40 = "9L40-Client (import équipements)";
const SITE_LIBELLE_9L40 = "9L40-Site";
const SERIE_9L40 = "9L40-SN-ANNEE-FAB";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.machine.deleteMany({ where: { numero_serie: SERIE_9L40 } });
  await client.site.deleteMany({ where: { id: SITE_9L40 } });
  await client.client.deleteMany({ where: { id: CLIENT_9L40 } });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
}

let MARQUE_9L40 = "";
let REFERENCE_9L40 = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    // LE MODÈLE DU SEMIS (I9) — jamais une famille forgée par l'épreuve.
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId, famille: { code: "PONT-ELEV" } },
      select: { marque: true, reference: true },
    });
    MARQUE_9L40 = modele.marque;
    REFERENCE_9L40 = modele.reference;

    await client.client.create({
      data: {
        id: CLIENT_9L40,
        societe_id: reperes.societeId,
        raison_sociale: RAISON_SOCIALE_9L40,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L40,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L40,
        agence_id: agence.id,
        libelle: SITE_LIBELLE_9L40,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test("l'année de fabrication saisie à la main SURVIT à un import qui modifie une AUTRE colonne", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1200 });

  // 1. PREMIER IMPORT : crée la machine, comme un parc réel se peuple — le
  //    gabarit n'expose aucune colonne « année de fabrication » (modeles.ts,
  //    COLONNES_EQUIPEMENTS).
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "9l40-creation.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurEquipements([
      [
        RAISON_SOCIALE_9L40,
        SITE_LIBELLE_9L40,
        MARQUE_9L40,
        REFERENCE_9L40,
        SERIE_9L40,
        "",
        "",
        "",
      ],
    ]),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(page.locator('li[data-decompte="creations"]')).toContainText(
    "1",
  );
  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();

  const client = admin();
  let machineId: string;
  try {
    const machine = await client.machine.findFirstOrThrow({
      where: { numero_serie: SERIE_9L40 },
      select: { id: true },
    });
    machineId = machine.id;
  } finally {
    await client.$disconnect();
  }

  // 2. SAISIE À LA MAIN — l'écran de modification, jamais l'import, qui
  //    n'expose pas ce champ.
  await page.goto(`/parc/${machineId}/modifier`);
  await page.locator('input[name="annee_fabrication"]').fill("2016");
  await page
    .getByRole("button", { name: fr["machine.action.enregistrer"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/parc/${machineId}(\\?|$)`));
  await expect(page.getByText("2016")).toBeVisible();
  await capturer(page, "9l40-fiche-annee-saisie", 1280);

  // 3. SECOND IMPORT : la MÊME machine, une colonne DIFFÉRENTE change
  //    (localisation) — aucune cellule de ce fichier ne porte l'année.
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "9l40-modification.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurEquipements([
      [
        RAISON_SOCIALE_9L40,
        SITE_LIBELLE_9L40,
        MARQUE_9L40,
        REFERENCE_9L40,
        SERIE_9L40,
        "",
        "9L40-Localisation modifiée",
        "",
      ],
    ]),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(
    page.locator('li[data-decompte="modifications"]'),
  ).toContainText("1");
  await capturer(page, "9l40-rapport-import", 1280);
  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();

  // 4. LA PREUVE : la localisation a RÉELLEMENT changé — ce que l'écran ne
  //    montre pas en lecture (elle n'est éditable que sur ce formulaire,
  //    jamais affichée sur la fiche) — et l'année de fabrication, qu'AUCUNE
  //    cellule de ce fichier ne porte, est INTACTE sur la fiche.
  const verif = admin();
  try {
    const apres = await verif.machine.findFirstOrThrow({
      where: { numero_serie: SERIE_9L40 },
      select: { localisation: true, annee_fabrication: true },
    });
    expect(apres.localisation).toBe("9L40-Localisation modifiée");
    expect(apres.annee_fabrication).toBe(2016);
  } finally {
    await verif.$disconnect();
  }

  await page.goto(`/parc/${machineId}`);
  await expect(page.getByText("2016")).toBeVisible();
  await capturer(page, "9l40-fiche-apres-import", 1280);
});
