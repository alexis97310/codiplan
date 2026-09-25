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
 * 93-FICHE-ACTIONS (25/09/2026, constat 19 de l'audit d'ergonomie) — LA FICHE
 * MONTRE UNE SEULE ACTION PRINCIPALE, LES AUTRES REPLIÉES.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ACT93-`
 *
 * Un client, un site, une intervention `a_planifier` — créés en `beforeAll`,
 * supprimés en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/interventions-2.spec.ts`). L'`INSERT` direct ne déclenche pas
 * `intervention_cycle_de_vie` (il ne surveille que l'`UPDATE`), et
 * `a_planifier` est de toute façon le statut par défaut d'une intervention.
 *
 * ## CE QUE CETTE ÉPREUVE MESURE
 *
 * Sur une fiche `a_planifier` : « Planifier » est l'action PRINCIPALE — un
 * `<h2>`, un bouton plein (`bg-primary`) — et « Suspendre » est REPLIÉE dans
 * un `<details>` fermé, dont le `<summary>` porte son titre et que le clic
 * ouvre.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ACT93 = uuidv7();
const SITE_ACT93 = uuidv7();
const INTERVENTION_ACT93 = uuidv7();

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
        id: CLIENT_ACT93,
        societe_id: reperes.societeId,
        raison_sociale: fr["actionprincipale.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ACT93,
        societe_id: reperes.societeId,
        client_id: CLIENT_ACT93,
        agence_id: agence.id,
        libelle: fr["actionprincipale.e2e.site"],
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', now())`,
      INTERVENTION_ACT93,
      reperes.societeId,
      CLIENT_ACT93,
      SITE_ACT93,
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
      CLIENT_ACT93,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ACT93 } });
    await client.client.deleteMany({ where: { id: CLIENT_ACT93 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/93-FICHE-ACTIONS/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await ouvrirUneSession(page);
});

test("« Planifier » est ouvert et plein ; « Suspendre » est replié et s'ouvre au clic", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ACT93}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();

  // ── « PLANIFIER » : OUVERT, BOUTON PLEIN ────────────────────────────────
  const formPlanifier = page.locator("form", {
    has: page.getByRole("heading", { name: fr["intervention.action.planifier"] }),
  });
  await expect(formPlanifier).toBeVisible();
  const boutonPlanifier = formPlanifier.getByRole("button", {
    name: fr["intervention.action.planifier"],
  });
  await expect(boutonPlanifier).toBeVisible();
  await expect(boutonPlanifier).toHaveClass(/bg-primary/);

  // ── « SUSPENDRE » : REPLIÉ ───────────────────────────────────────────────
  const detailsSuspendre = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.suspendre"],
    }),
  });
  await expect(detailsSuspendre).toBeVisible();
  await expect(detailsSuspendre).not.toHaveJSProperty("open", true);
  const champMotif = detailsSuspendre.locator('input[name="motif"]');
  await expect(champMotif).toBeHidden();

  await capturer(page, "suspendre-replie");

  // ── LE CLIC SUR LE SUMMARY OUVRE SES CHAMPS ─────────────────────────────
  await detailsSuspendre.locator("summary").click();
  await expect(detailsSuspendre).toHaveJSProperty("open", true);
  await expect(champMotif).toBeVisible();
  const boutonSuspendre = detailsSuspendre.getByRole("button", {
    name: fr["intervention.action.suspendre"],
  });
  await expect(boutonSuspendre).toHaveClass(/border/);
  await expect(boutonSuspendre).not.toHaveClass(/bg-primary/);

  await capturer(page, "suspendre-ouvert");
});
