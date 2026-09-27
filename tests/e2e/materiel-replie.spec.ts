import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9AM-GR17-M11 — LES FORMULAIRES « MODIFIER » DU RÉFÉRENTIEL MATÉRIEL SONT
 * REPLIÉS PAR DÉFAUT (audit GR du 26/09, constat M11).
 *
 * `/parametres/materiel` rendait un formulaire de modification déplié pour
 * CHAQUE famille et CHAQUE modèle, comme `/parametres/equipe` avant ERGO-1 :
 * le geste rare occupait la place que le tableau, lu en premier, aurait dû
 * garder. Même repli, même forme — un `<details>` par ligne.
 *
 * Scène propre, préfixée `ERGO11-`, créée et supprimée par cette épreuve :
 * aucune ligne du semis n'est touchée.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const FAMILLE_ID = uuidv7();
const MODELE_ID = uuidv7();
const CODE_FAMILLE = "ERGO11F";
const LIBELLE_FAMILLE = "ERGO11-Famille";
const MARQUE_MODELE = "ERGO11-Marque";
const REFERENCE_MODELE = "ERGO11-Reference";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ID,
        societe_id: reperes.societeId,
        code: CODE_FAMILLE,
        libelle: LIBELLE_FAMILLE,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_ID,
        societe_id: reperes.societeId,
        famille_id: FAMILLE_ID,
        marque: MARQUE_MODELE,
        reference: REFERENCE_MODELE,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.modeleMateriel.deleteMany({ where: { id: MODELE_ID } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le formulaire « Modifier la famille » est replié, et un clic sur son titre le découvre", async ({
  page,
}) => {
  await page.goto("/parametres/materiel");

  const formulaire = page.locator(
    `form[action="/api/parametres/materiel/familles/${FAMILLE_ID}/modifier"]`,
  );
  await expect(formulaire).not.toBeVisible();

  const resume = page.locator("summary", { hasText: CODE_FAMILLE });
  await resume.scrollIntoViewIfNeeded();
  await resume.click();

  await expect(formulaire).toBeVisible();
});

test("le formulaire « Modifier le modèle » est replié, et un clic sur son titre le découvre", async ({
  page,
}) => {
  await page.goto("/parametres/materiel");

  const formulaire = page.locator(
    `form[action="/api/parametres/materiel/modeles/${MODELE_ID}/modifier"]`,
  );
  await expect(formulaire).not.toBeVisible();

  const resume = page.locator("summary", {
    hasText: `${MARQUE_MODELE} ${REFERENCE_MODELE}`,
  });
  await resume.scrollIntoViewIfNeeded();
  await resume.click();

  await expect(formulaire).toBeVisible();
});
