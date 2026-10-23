import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RS_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES DU POINT 4 (9H1B-MIGRATION-SUR-BASE-REMPLIE) — le bloc
 * « Avant de clôturer », vu par un ADV (sans le lien « Valider le
 * rapport », qu'il ne détient pas) et par un responsable SAV (qui le
 * détient), aux deux largeurs demandées par le lot.
 *
 * SA PROPRE SCÈNE, préfixée `9H1BCAP-` — une `terminee` au rapport NON
 * validé, créée en `beforeAll`, supprimée en `afterAll`, aucune ligne
 * ajoutée au semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9H1BCAP = uuidv7();
const SITE_9H1BCAP = uuidv7();
const INTERVENTION_9H1BCAP = uuidv7();

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
        id: CLIENT_9H1BCAP,
        societe_id: reperes.societeId,
        raison_sociale: "9H1BCAP client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9H1BCAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1BCAP,
        agence_id: agence.id,
        libelle: "9H1BCAP site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9H1BCAP,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1BCAP,
        site_id: SITE_9H1BCAP,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-10-20T00:00:00Z"),
        duree_estimee_min: 60,
        commentaire_technicien: fr["terrain.e2e.commentaire"],
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9H1BCAP,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9H1BCAP } });
    await client.client.deleteMany({ where: { id: CLIENT_9H1BCAP } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9H1B-MIGRATION-SUR-BASE-REMPLIE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

for (const largeur of [1280, 375] as const) {
  test(`« Avant de clôturer » vu par l'ADV, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto(`/interventions/${INTERVENTION_9H1BCAP}?onglet=resume`);
    await expect(
      page
        .locator("li")
        .filter({ hasText: fr["intervention.avant_cloture.rapport_valide"] }),
    ).toBeVisible();
    await capturer(page, "avant-cloture-adv", largeur);
  });

  test(`« Avant de clôturer » vu par un responsable SAV, à ${largeur}px`, async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RS_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/planning/);
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto(`/interventions/${INTERVENTION_9H1BCAP}?onglet=resume`);
    await expect(
      page
        .locator("li")
        .filter({ hasText: fr["intervention.avant_cloture.rapport_valide"] }),
    ).toBeVisible();
    await capturer(page, "avant-cloture-responsable-sav", largeur);
  });
}
