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
 * 9F4H2-HORS-RESEAU-HEURE-ET-REJEU — LA MENTION « SAISI HORS RÉSEAU » POUR
 * L'ADV (décision n° 107 d'Alexis, 14/10/2026).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9F4H2-` — une intervention `terminee`, UN
 * segment marqué `saisi_hors_reseau = true` : créée en `beforeAll`, supprimée
 * en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/fiche-cloturer.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9F4H2 = uuidv7();
const SITE_9F4H2 = uuidv7();
const INTERVENTION_9F4H2 = uuidv7();

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
        id: CLIENT_9F4H2,
        societe_id: reperes.societeId,
        raison_sociale: "9F4H2 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9F4H2,
        agence_id: agence.id,
        libelle: "9F4H2 site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H2,
        societe_id: reperes.societeId,
        client_id: CLIENT_9F4H2,
        site_id: SITE_9F4H2,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    // LE SEGMENT, MARQUÉ HORS RÉSEAU — même ordre que `fiche-cloturer.spec.ts` :
    // le segment d'abord, la somme ensuite (le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` vérifie la somme).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id","societe_id","intervention_id","utilisateur_id","debut","fin","saisi_hors_reseau","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '30 minutes', now(), true, now())`,
      reperes.societeId,
      INTERVENTION_9F4H2,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_9F4H2 },
      data: { temps_mesure_min: 30 },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H2,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H2 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H2-HORS-RESEAU-HEURE-ET-REJEU/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({ path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`) });
}

test("l'onglet Temps montre la mention « saisi hors réseau » sur le segment concerné", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_9F4H2}?onglet=temps`);

  await expect(
    page.getByRole("heading", {
      name: fr["intervention.realisation.segments_titre"],
      level: 3,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.realisation.saisi_hors_reseau"]),
  ).toBeVisible();

  await capturer(page, "onglet-temps", 375);
  await capturer(page, "onglet-temps", 1280);
});

test("le dialogue de clôture avertit l'ADV qu'un segment a été saisi hors réseau", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_9F4H2}`);

  await page
    .getByRole("button", { name: fr["intervention.action.cloturer"] })
    .click();
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await expect(
    dialogue.getByText(fr["intervention.cloture.avertissement_hors_reseau"]),
  ).toBeVisible();

  await capturer(page, "dialogue-cloturer-hors-reseau", 375);
  await capturer(page, "dialogue-cloturer-hors-reseau", 1280);
});
