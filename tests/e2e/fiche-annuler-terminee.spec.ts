import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EU-SOLDE-FICHE-PLANNING (solde 159) — UNE INTERVENTION `terminee` NE
 * S'ANNULE PLUS, NI DEPUIS LA FICHE, NI DEPUIS LA ROUTE, NI DEPUIS LE TIROIR
 * DU PLANNING.
 *
 * `peutAnnuler` (`lib/interventions/cycle-de-vie.ts`) refuse une `terminee`
 * avec la clé `intervention.refus.terminee_non_annulable` depuis
 * 9ES-TP-UX4-3-FICHE-GESTES-1 ; cette épreuve PROUVE les trois chemins qui en
 * dépendent, qu'aucune épreuve existante ne mesurait pour ce statut précis.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9EU-`, SEMAINE FUTURE
 *
 * Un client, un site, une intervention `terminee` affectée au technicien de
 * Ducos — créés en `beforeAll`, supprimés en `afterAll`, aucune ligne
 * ajoutée au semis. RANG_JOURS (210 = 30 semaines) ne recoupe aucun des
 * décalages déjà pris sur MARDI par les autres épreuves (grep sur
 * `tests/e2e`).
 */
test.describe.configure({ mode: "serial" });

const RANG_JOURS = 210;
const CLIENT_ANN2 = uuidv7();
const SITE_ANN2 = uuidv7();
const INTERVENTION_ANN2_TERMINEE = uuidv7();

let reperes: ReperesDeScene;
let jourIntervention: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jourIntervention = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_JOURS);

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ANN2,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EU-ANNULER-TERMINEE — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ANN2,
        societe_id: reperes.societeId,
        client_id: CLIENT_ANN2,
        agence_id: agence.id,
        libelle: "zz9EU-ANNULER-TERMINEE — site forgé",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANN2_TERMINEE,
        societe_id: reperes.societeId,
        client_id: CLIENT_ANN2,
        site_id: SITE_ANN2,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date(
          `${cleDeJour(jourIntervention)}T00:00:00.000Z`,
        ),
        duree_estimee_min: 60,
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
      CLIENT_ANN2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ANN2 } });
    await client.client.deleteMany({ where: { id: CLIENT_ANN2 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la fiche d'une terminée ne propose pas « Annuler l'intervention », et la route refuse toujours", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ANN2_TERMINEE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();

  // Le menu « ⋯ » porte « Bon d'intervention » à la place (`avecBon`), jamais
  // « Annuler l'intervention » : c'est CETTE absence précise que l'ancienne
  // couverture ne nommait pas pour une `terminee`.
  await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", { name: fr["intervention.action.annuler"] }),
  ).toHaveCount(0);

  const reponse = await page.request.post(
    `/api/interventions/${INTERVENTION_ANN2_TERMINEE}/annuler`,
    {
      form: { motif: "zz9EU — tentative refusée par l'épreuve" },
      maxRedirects: 0,
      failOnStatusCode: false,
    },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"]).toContain(
    "intervention.refus.terminee_non_annulable",
  );

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ANN2_TERMINEE },
      select: { statut: true },
    });
    expect(ligne.statut).toBe("terminee");
  } finally {
    await client.$disconnect();
  }
});

function hrefPlanning(): string {
  return `/planning?vue=semaine&semaine=${cleDeJour(
    jourSuivant(reperes.lundi, RANG_JOURS),
  )}`;
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EU-SOLDE-FICHE-PLANNING/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

test("le tiroir du planning affiche le refus pour une terminée, plutôt que le formulaire d'annulation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(hrefPlanning());

  const carte = page
    .locator(
      `a[data-tiroir-declencheur="${INTERVENTION_ANN2_TERMINEE}"]:visible`,
    )
    .first();
  await expect(carte).toBeVisible();
  await carte.click();

  const tiroir = page.locator(
    `[data-tiroir-ouvert="${INTERVENTION_ANN2_TERMINEE}"]`,
  );
  await expect(tiroir).toBeVisible();
  await expect(
    tiroir.getByText(fr["intervention.refus.terminee_non_annulable"]),
  ).toBeVisible();
  await expect(
    tiroir.getByLabel(fr["intervention.annulation.motif"]),
  ).toHaveCount(0);

  await capturer(page, "tiroir-terminee-refus-1280");
});
