import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { COLONNES_CLIENTS } from "@/lib/imports/modeles";

import {
  CODE_EXTERNE_DETAIL_REJET,
  fabriquerLeClasseurDetailRejet,
} from "./setup/classeur-detail-rejet";
import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE RAPPORT D'UN LOT NOMME LA COLONNE ET LA VALEUR D'UN REJET
 * (9AK-GR15-MOTIF-REJET, gain GR15b).
 *
 * `tests/unit/imports/colonne-en-cause.test.ts` et `types-dimport.test.ts`
 * éprouvent déjà `colonneEnCause` et `detailDuRejet` en dehors de l'écran.
 * **Ce que ce scénario mesure, et qu'eux ne peuvent pas** : que
 * `[data-detail-rejet]` existe réellement sur `/imports/{id}` et porte la
 * bonne colonne et la bonne valeur — la même distinction que
 * `imports.spec.ts` fait pour le rapport lui-même.
 *
 * **Aucune fixture `SCENE.*`** : le classeur est fabriqué (I9), la ligne
 * qu'il porte est REJETÉE — aucune fiche client n'est jamais écrite —, et
 * seul le lot d'import créé par le contrôle est nettoyé, par son PROPRE id.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let idDuLot: string | null = null;

test.afterEach(async () => {
  if (idDuLot === null) return;
  const client = admin();
  try {
    // Cascade sur `import_lot_ligne` (schema.prisma, `onDelete: Cascade`).
    await client.importLot.deleteMany({ where: { id: idDuLot } });
  } finally {
    await client.$disconnect();
  }
  idDuLot = null;
});

test("un rejet « saisie refusée » affiche la colonne et la valeur en cause", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "clients-detail-rejet.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurDetailRejet(),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
  idDuLot = /\/imports\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? null;
  expect(idDuLot).not.toBeNull();

  // Depuis PA-55 (TP-A3-RAPPORT-IMPORT), le motif se lit sur le GROUPE — un
  // <details> replié — et non plus sur chaque ligne : ouvrir le groupe avant
  // de chercher la ligne qu'il contient.
  const groupe = page
    .locator("details")
    .filter({ hasText: fr["imports.motif.saisie_refusee"] });
  await expect(groupe).toBeVisible();
  await groupe.locator("summary").click();

  const ligne = groupe.locator("tr", { hasText: CODE_EXTERNE_DETAIL_REJET });
  await expect(ligne).toBeVisible();

  const detail = ligne.locator("[data-detail-rejet]");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(COLONNES_CLIENTS.raisonSociale);
  await expect(detail).toContainText(fr["imports.motif.valeur_vide"]);
});
