import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * AGENCE-ACTIVE (AA-4-REGISTRE-FILTRE) — UNE AGENCE INACTIVE SORT DU FILTRE
 * DU REGISTRE, PAS DE SA PUCE.
 *
 * ## Le constat
 *
 * `/interventions` proposait TOUTES les agences dans son filtre, actives et
 * inactives — en production, « DUCO — 1 » restait proposé alors que DUCO est
 * inactive. `agencesProposables` (AGENCE-ACTIVE, AA-1) retire désormais les
 * inactives du menu, SAUF celle que l'URL demande déjà (`garder`) : elle
 * reste sélectionnée, marquée « (inactive) », et sa PUCE continue de
 * s'afficher — le filtre appliqué ne change jamais, seul le menu se ferme
 * aux choix nouveaux.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `AA4-`
 *
 * Une agence inactive, créée directement en base en `beforeAll` — aucun site
 * ni intervention n'est nécessaire : le filtre et sa puce ne dépendent que du
 * référentiel des agences. Supprimée en `afterAll`. Aucune ligne du semis
 * n'est touchée.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "AA4-";
const CODE_AGENCE_INACTIVE = `${PREFIXE}INACTIVE`;
const AGENCE_INACTIVE_ID = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
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

test("UNE AGENCE INACTIVE N'EST PAS PROPOSÉE PAR LE FILTRE DU REGISTRE", async ({
  page,
}) => {
  await page.goto("/interventions");
  await expect(
    page.locator(`select[name="agence"] option[value="${AGENCE_INACTIVE_ID}"]`),
  ).toHaveCount(0);
});

test("`?agence=<INACTIVE>` LA GARDE SÉLECTIONNÉE, MARQUÉE « (INACTIVE) », ET SA PUCE S'AFFICHE", async ({
  page,
}) => {
  await page.goto(`/interventions?agence=${AGENCE_INACTIVE_ID}`);

  const selecteur = page.locator('select[name="agence"]');
  await expect(selecteur).toHaveValue(AGENCE_INACTIVE_ID);

  const optionGardee = page.locator(
    `select[name="agence"] option[value="${AGENCE_INACTIVE_ID}"]`,
  );
  await expect(optionGardee).toContainText(fr["agence.option.inactive"]);

  // Le TEXTE de la puce n'est pas comparé : il composerait le libellé de la
  // scène (`CODE_AGENCE_INACTIVE`) en dur dans une requête d'écran, ce que le
  // gardien de L0-11 refuse (forme 2, la chaîne concaténée). Sa PRÉSENCE
  // suffit à mesurer « la puce s'affiche ».
  await expect(page.locator('span[data-puce="agence"]')).toBeVisible();
});
