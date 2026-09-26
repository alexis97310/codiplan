import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99T-G9-CLOTURER-REPLIE (26/09/2026, audit d'ergonomie constat G9, décision
 * d'Alexis) — LE REFUS « TEMPS NON MESURÉ » DU BLOC CLÔTURER SE REPLIE, HORS
 * INTERVENTION `terminee`.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `G9-`
 *
 * Un client, un site, deux interventions — l'une `a_planifier`, l'autre
 * `terminee`, ni l'une ni l'autre n'ayant de temps mesuré — créées en
 * `beforeAll`, supprimées en `afterAll`, aucune ligne ajoutée au semis (même
 * discipline que `tests/e2e/fiche-actions.spec.ts`). L'`INSERT` direct ne
 * déclenche pas `intervention_cycle_de_vie` (il ne surveille que l'`UPDATE`).
 *
 * ## CE QUE CETTE ÉPREUVE MESURE
 *
 * Sur la fiche `a_planifier` : le bloc « Clôturer » est un `<details>` fermé,
 * ton neutre, dont le `<summary>` porte le titre — la raison du refus n'est
 * pas visible tant qu'il n'est pas ouvert, et le clic l'ouvre.
 *
 * Sur la fiche `terminee` : le bloc « Clôturer » reste déplié, en oxyde,
 * comme AVANT ce lot — c'est la seule intervention où « Clôturer » est
 * l'action principale.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_G9 = uuidv7();
const SITE_G9 = uuidv7();
const INTERVENTION_G9_A_PLANIFIER = uuidv7();
const INTERVENTION_G9_TERMINEE = uuidv7();

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
        id: CLIENT_G9,
        societe_id: reperes.societeId,
        raison_sociale: fr["bloccloturereplie.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_G9,
        societe_id: reperes.societeId,
        client_id: CLIENT_G9,
        agence_id: agence.id,
        libelle: fr["bloccloturereplie.e2e.site"],
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', now())`,
      INTERVENTION_G9_A_PLANIFIER,
      reperes.societeId,
      CLIENT_G9,
      SITE_G9,
      agence.id,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'terminee', now())`,
      INTERVENTION_G9_TERMINEE,
      reperes.societeId,
      CLIENT_G9,
      SITE_G9,
      agence.id,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_G9,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_G9 } });
    await client.client.deleteMany({ where: { id: CLIENT_G9 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99T-G9-CLOTURER-REPLIE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await ouvrirUneSession(page);
});

test("fiche « à planifier » sans temps mesuré : « Clôturer » est replié, et le clic l'ouvre", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_G9_A_PLANIFIER}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();

  const detailsCloturer = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.cloturer"],
    }),
  });
  await expect(detailsCloturer).toBeVisible();
  await expect(detailsCloturer).not.toHaveJSProperty("open", true);

  const raison = detailsCloturer.getByText(
    fr["intervention.refus.temps_manquant"],
  );
  await expect(raison).toBeHidden();

  await capturer(page, "cloturer-a-planifier-replie", 1280);
  await capturer(page, "cloturer-a-planifier-replie", 375);

  await detailsCloturer.locator("summary").click();
  await expect(detailsCloturer).toHaveJSProperty("open", true);
  await expect(raison).toBeVisible();

  await capturer(page, "cloturer-a-planifier-ouvert", 1280);
});

test("fiche « terminée » sans temps mesuré : « Clôturer » reste déplié, en oxyde", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_G9_TERMINEE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();

  const sectionCloturer = page.locator("section.border-app-rouge-bord", {
    has: page.getByRole("heading", {
      level: 2,
      name: fr["intervention.action.cloturer"],
    }),
  });
  await expect(sectionCloturer).toBeVisible();
  await expect(
    sectionCloturer.getByText(fr["intervention.refus.temps_manquant"]),
  ).toBeVisible();

  await expect(
    page.locator("details", {
      has: page.locator("summary", {
        hasText: fr["intervention.action.cloturer"],
      }),
    }),
  ).toHaveCount(0);

  await capturer(page, "cloturer-terminee-deplie", 1280);
  await capturer(page, "cloturer-terminee-deplie", 375);
});
