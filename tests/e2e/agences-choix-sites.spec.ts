import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * AGENCE-ACTIVE (9AY-AA-1) — UNE AGENCE INACTIVE SORT DES CHOIX, PAS DE
 * L'HISTOIRE.
 *
 * ## Le constat
 *
 * Décision d'Alexis du 26/09/2026 : une agence inactive ne se propose plus
 * dans un menu de rattachement (`lib/agences/proposables.ts`), mais reste
 * dans Paramètres > Agences et sur les fiches qui la portent déjà (précédent
 * D129, le client inactif). `/sites/nouveau` en tire la conséquence directe :
 * une agence désactivée n'y apparaît plus. `/sites/[id]` en tire la
 * conséquence INVERSE, et c'est le piège que `garder` ferme : un site
 * rattaché à une agence désactivée APRÈS coup doit continuer à la montrer,
 * sous peine qu'« Enregistrer » un tout autre champ ne fasse déraper le
 * rattachement vers la première option du menu.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `AA1-`
 *
 * Une agence inactive et un site déjà rattaché à elle — créés directement en
 * base en `beforeAll` (même discipline que `avertissement-ton.spec.ts`) :
 * le site est un FAIT antérieur à la désactivation, pas un geste que ce
 * scénario rejoue. Supprimés en `afterAll`. Aucune ligne du semis n'est
 * touchée.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "AA1-";
const CODE_AGENCE_INACTIVE = `${PREFIXE}INACTIVE`;
const RAISON_SOCIALE = `${PREFIXE}Client (choix des sites)`;
const LIBELLE_SITE = `${PREFIXE}Site (choix des sites)`;

const AGENCE_INACTIVE_ID = randomUUID();
const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
  await client.agence.deleteMany({ where: { id: AGENCE_INACTIVE_ID } });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });

    await client.agence.create({
      data: {
        id: AGENCE_INACTIVE_ID,
        societe_id: societe.id,
        code: CODE_AGENCE_INACTIVE,
        libelle: CODE_AGENCE_INACTIVE,
        territoire: "NC",
        actif: false,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    // LE FAIT ANTÉRIEUR : ce site est rattaché à l'agence AVANT que ce
    // scénario ne commence — la désactivation ne le déloge jamais.
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: AGENCE_INACTIVE_ID,
        libelle: LIBELLE_SITE,
        temps_trajet_min: 10,
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

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("UNE AGENCE INACTIVE N'EST PAS PROPOSÉE SUR /sites/nouveau", async ({
  page,
}) => {
  await page.goto("/sites/nouveau");
  await expect(page.locator("main form")).toBeVisible();
  await expect(
    page.locator(
      `select[name="agence_id"] option[value="${AGENCE_INACTIVE_ID}"]`,
    ),
  ).toHaveCount(0);
});

test("UN SITE DÉJÀ RATTACHÉ LA GARDE SÉLECTIONNÉE, MARQUÉE « (INACTIVE) », ET ENREGISTRER UN AUTRE CHAMP NE CHANGE PAS SON RATTACHEMENT", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_ID}`);
  const selecteur = page.locator('select[name="agence_id"]');
  await expect(selecteur).toHaveValue(AGENCE_INACTIVE_ID);

  const optionGardee = page.locator(
    `select[name="agence_id"] option[value="${AGENCE_INACTIVE_ID}"]`,
  );
  await expect(optionGardee).toContainText(fr["agence.option.inactive"]);

  // Un tout autre champ, jamais le rattachement.
  await page.locator('input[name="commune"]').fill("Nouméa");
  await page.getByRole("button", { name: fr["sites.action.modifier"] }).click();
  await expect(page).toHaveURL(new RegExp(`/sites/${SITE_ID}(\\?|$)`));

  // LE LIVRABLE : rechargée, la fiche montre le MÊME rattachement — jamais
  // celui que le navigateur aurait retenu par défaut si l'option avait
  // manqué.
  await page.goto(`/sites/${SITE_ID}`);
  await expect(page.locator('select[name="agence_id"]')).toHaveValue(
    AGENCE_INACTIVE_ID,
  );
});
