import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { libelleCodeExterne } from "@/lib/clients/code-externe";
import { libelleChampFacultatif } from "@/lib/i18n/obligatoire";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * SOLDE 9EP POINT 40 (Q10) — L'AIDE DU CODE CLIENT SORT DU `<label>`.
 *
 * `AideChamp` rendait un `<button>` À L'INTÉRIEUR du `<label>` du code
 * externe : le bouton entrait dans le nom accessible du champ. Aucune
 * donnée créée ici — lecture seule, pas de scène dédiée.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("/clients/nouveau — aucun bouton dans un `<label>`, le code externe reste atteignable par son libellé", async ({
  page,
}) => {
  const client = admin();
  let libelleSociete: string | null;
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { libelle_code_externe: true },
    });
    libelleSociete = societe.libelle_code_externe;
  } finally {
    await client.$disconnect();
  }

  await page.goto("/clients/nouveau");

  await expect(page.locator("label button")).toHaveCount(0);

  const libelle = libelleChampFacultatif(libelleCodeExterne(libelleSociete));
  await expect(page.getByLabel(libelle, { exact: true })).toBeVisible();
});
