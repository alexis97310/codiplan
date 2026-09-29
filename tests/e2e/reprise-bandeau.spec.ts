import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { dateCivile } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9BV-TP-A5b-DATES-REPRISE — LE BANDEAU D'UNE FICHE REPRISE D'UN IMPORT
 * (IN-23, audit du 28/09/2026).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9BV-REPRISE-`
 *
 * La scène partagée (`tests/e2e/setup/scene.ts`) ne porte aucune intervention
 * reprise d'un import — ce fichier forge la sienne, créée en `beforeAll`,
 * supprimée en `afterAll`, EN LECTURE SEULE une fois posée : aucun scénario
 * n'écrit sur cette fiche.
 *
 * ## L'INTERVENTION EST POSÉE DIRECTEMENT, COMME UN IMPORT L'AURAIT ÉCRITE
 *
 * `creerInterventionsRepriseEnLot` (`lib/interventions/depot-reprise.ts`)
 * écrit `cloturee_le` au jour du document, sans créneau ni pause. Un
 * `INSERT` direct avec `cloturee_le` dans le passé et `cree_le` à sa valeur
 * par défaut (`now()`) reproduit exactement ce fait — la seule chose qui
 * distingue une reprise, `estRepriseDunImport` (`../presentation.ts`) — sans
 * passer par la route d'import, hors périmètre de ce lot.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_REPRISE = uuidv7();
const SITE_REPRISE = uuidv7();
const INTERVENTION_REPRISE = uuidv7();
const CLOTUREE_LE = new Date("2019-03-15T00:00:00.000Z");

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
        id: CLIENT_REPRISE,
        societe_id: reperes.societeId,
        raison_sociale: "9BV-REPRISE — client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_REPRISE,
        societe_id: reperes.societeId,
        client_id: CLIENT_REPRISE,
        agence_id: agence.id,
        libelle: "9BV-REPRISE — site de l'épreuve",
      },
    });

    // `cree_le` à sa valeur par défaut (`now()`), postérieure à `cloturee_le`
    // fixé dans le passé : c'est ce seul écart qui fait la reprise.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "temps_valide_min", "cloturee_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', 60, $6, now())`,
      INTERVENTION_REPRISE,
      reperes.societeId,
      CLIENT_REPRISE,
      SITE_REPRISE,
      agence.id,
      CLOTUREE_LE,
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
      CLIENT_REPRISE,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_REPRISE } });
    await client.client.deleteMany({ where: { id: CLIENT_REPRISE } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9BV-TP-A5b-DATES-REPRISE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("une fiche reprise d'un import porte le bandeau, et jamais « pas encore tourné »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_REPRISE}`);

  const bandeau = page.locator("[data-bandeau-reprise]");
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toContainText(fr["intervention.reprise.bandeau"]);
  await expect(bandeau).toContainText(dateCivile(CLOTUREE_LE));

  await expect(
    page.getByText(fr["intervention.realisation.aucun_segment_termine"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.realisation.aucun_segment"], {
      exact: true,
    }),
  ).toHaveCount(0);

  await capturer(page, "fiche-reprise");
});
