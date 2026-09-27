import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { enDuree } from "@/lib/calendar/duree";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9AH-GR14-PRESTATIONS-SITES — le catalogue des prestations
 * (`/parametres/prestations`) écrit sa durée standard en heures (`enDuree`),
 * plus jamais « 90 min » en dur (audit GR du 26/09/2026, constat G17).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `ERGO14-` — une prestation créée en `beforeAll`,
 * supprimée en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/fiche-cloturer.spec.ts`). Aucune fonction d'application n'existe
 * pour ce catalogue (`lib/prestations/depot.ts` le documente) : la création
 * comme la suppression passent par le client d'administration, jamais par
 * l'écran.
 */
test.describe.configure({ mode: "serial" });

const PRESTATION_ERGO14 = uuidv7();
const CODE_ERGO14 = `ERGO14-${PRESTATION_ERGO14.slice(0, 8)}`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.prestation.create({
      data: {
        id: PRESTATION_ERGO14,
        societe_id: reperes.societeId,
        code: CODE_ERGO14,
        libelle: "Prestation ERGO14",
        duree_standard_min: 90,
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.prestation.deleteMany({ where: { id: PRESTATION_ERGO14 } });
  } finally {
    await client.$disconnect();
  }
});

test("la ligne du catalogue affiche la durée standard en heures, pas en minutes", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/prestations");

  const ligne = page.locator("tr", { hasText: CODE_ERGO14 });
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(enDuree(90));
});
