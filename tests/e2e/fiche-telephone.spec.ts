import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9AD-GR13-FICHE-TELEPHONE (27/09/2026, constat G11 de l'audit du 26/09,
 * décision d'Alexis) — SUR TÉLÉPHONE, L'ACTION PRINCIPALE SE MONTRE JUSTE
 * SOUS LE TITRE DE LA FICHE.
 *
 * ## LE CONSTAT
 *
 * Sous 901 px, le panneau « Actions » (l'`<aside>`) passe SOUS tout le reste
 * du contenu de la fiche : l'action qui fait avancer l'intervention — celle
 * que `actionPrincipale` désigne — se retrouve loin, après un long défilé.
 * Le lien posé ici ne DUPLIQUE aucun formulaire (le formulaire réel reste
 * dans l'aside, unique) : il mène par ancre au bloc `Action` principal.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ERGO13`
 *
 * Un client, un site, TROIS interventions — créées en `beforeAll`, supprimées
 * en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/fiche-actions.spec.ts`) : `planifiee` (principale =
 * « Transmettre », depuis D141/9CO-PG-G14A-TRANSMETTRE — « Affecter »
 * jusque-là), `terminee` (principale = « Clôturer »), `en_cours` (AUCUNE
 * action principale — le lien ne doit pas exister).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ERGO13 = uuidv7();
const SITE_ERGO13 = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ERGO13,
        societe_id: reperes.societeId,
        raison_sociale: fr["gr13telephone.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ERGO13,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO13,
        agence_id: agence.id,
        libelle: fr["gr13telephone.e2e.lieu"],
      },
    });

    for (const [id, statut] of [
      [INTERVENTION_PLANIFIEE, "planifiee"],
      [INTERVENTION_TERMINEE, "terminee"],
      [INTERVENTION_EN_COURS, "en_cours"],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
            "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
            "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                 $6::"StatutIntervention", '2026-09-24T00:00:00Z', 60,
                 $7::uuid, now())`,
        id,
        reperes.societeId,
        CLIENT_ERGO13,
        SITE_ERGO13,
        agence.id,
        statut,
        reperes.technicienDucos,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ERGO13,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ERGO13 } });
    await client.client.deleteMany({ where: { id: CLIENT_ERGO13 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("sur téléphone, le lien mène à l'action principale « Transmettre » (D141, 9CO-PG-G14A-TRANSMETTRE)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

  // DEUX LIENS MÈNENT DÉSORMAIS À LA MÊME ANCRE (9EE-TP-UX4-1-
  // FICHE-INTERVENTION-1, Q9 du pilote, 08/10/2026) : l'action principale
  // de l'en-tête (`LienPrimaire`, visible bureau et téléphone) ET ce lien
  // 9AD, inchangé, `min-[901px]:hidden`, juste sous le titre — celui que
  // cette épreuve visait à l'origine. `.last()` le cible nommément, jamais
  // une attente affaiblie.
  const lien = page
    .getByRole("link", { name: fr["intervention.action.transmettre"] })
    .last();
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "#action-transmettre");

  const bloc = page.locator("#action-transmettre");
  const aside = page.locator("main aside");
  const yLien = (await lien.boundingBox())?.y ?? Number.POSITIVE_INFINITY;
  const yAside = (await aside.boundingBox())?.y ?? Number.NEGATIVE_INFINITY;
  expect(yLien).toBeLessThan(yAside);

  // AVANT LE CLIC, LE BLOC N'EST PAS FORCÉMENT DANS LA FENÊTRE.
  await lien.click();
  await expect(page).toHaveURL(/#action-transmettre$/);
  await expect(bloc).toBeInViewport();
});

test("sur téléphone, le lien mène à l'action principale « Clôturer »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/interventions/${INTERVENTION_TERMINEE}`);

  // MÊME RÉSERVE QUE L'ÉPREUVE « TRANSMETTRE » CI-DESSUS — `.last()` cible
  // le lien 9AD, pas celui de l'en-tête.
  const lien = page
    .getByRole("link", { name: fr["intervention.action.cloturer"] })
    .last();
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "#action-cloturer");

  await lien.click();
  await expect(page.locator("#action-cloturer")).toBeInViewport();
});

test("sur téléphone, aucun lien quand le statut n'a pas d'action principale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

  await expect(
    page.getByRole("link", { name: fr["intervention.action.affecter"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: fr["intervention.action.cloturer"] }),
  ).toHaveCount(0);
});

test("à 1280 px, le lien est invisible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

  await expect(
    page.getByRole("link", { name: fr["intervention.action.affecter"] }),
  ).toBeHidden();
});
