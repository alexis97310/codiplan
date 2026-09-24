import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { decompte } from "@/app/(back-office)/presentation";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 67-REGISTRE-3 — LA RECHERCHE DU REGISTRE TROUVE UNE INTERVENTION PAR LE
 * NUMÉRO DE SÉRIE DE SA MACHINE (SAV-07).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `REG3-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/registre-2.spec.ts`. Un client, un
 * site, DEUX machines de S/N distincts (`REG3-SN-A`, `REG3-SN-B`), une
 * intervention rattachée à chacune : chercher `REG3-SN-A` ne doit trouver que
 * la première, jamais les deux.
 *
 * Ni la raison sociale du client ni le libellé du site ne contiennent
 * `REG3-SN-A` — seule la branche `numero_serie` de `filtreDesInterventions`
 * (`lib/interventions/depot.ts`) peut donc faire remonter la ligne : un
 * résultat unique prouve que c'est bien la machine qui a été trouvée, pas une
 * autre colonne déjà cherchée.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_REG3 = uuidv7();
const SITE_REG3 = uuidv7();
const MACHINE_A = uuidv7();
const MACHINE_B = uuidv7();
const INTERVENTION_A = uuidv7();
const INTERVENTION_B = uuidv7();
const INTERVENTION_MACHINE_A = uuidv7();
const INTERVENTION_MACHINE_B = uuidv7();

const NUMERO_SERIE_A = fr["registre3.e2e.numero_serie_a"];
const NUMERO_SERIE_B = fr["registre3.e2e.numero_serie_b"];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_REG3,
        societe_id: societeId,
        raison_sociale: fr["registre3.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_REG3,
        societe_id: societeId,
        client_id: CLIENT_REG3,
        agence_id: agence.id,
        libelle: fr["registre3.e2e.site"],
      },
    });

    for (const [machineId, serie] of [
      [MACHINE_A, NUMERO_SERIE_A],
      [MACHINE_B, NUMERO_SERIE_B],
    ] as const) {
      await client.machine.create({
        data: {
          id: machineId,
          societe_id: societeId,
          modele_id: modele.id,
          client_id: CLIENT_REG3,
          site_id: SITE_REG3,
          numero_serie: serie,
          qr_token: engendrerJetonQr(),
        },
      });
    }

    for (const id of [INTERVENTION_A, INTERVENTION_B]) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', now())`,
        id,
        societeId,
        CLIENT_REG3,
        SITE_REG3,
        agence.id,
      );
    }

    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_A,
        societe_id: societeId,
        intervention_id: INTERVENTION_A,
        machine_id: MACHINE_A,
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_B,
        societe_id: societeId,
        intervention_id: INTERVENTION_B,
        machine_id: MACHINE_B,
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
      CLIENT_REG3,
    );
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_A, MACHINE_B] } },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_REG3 } });
    await client.client.deleteMany({ where: { id: CLIENT_REG3 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/67-REGISTRE-3/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la recherche par S/N retrouve exactement l'intervention de la machine A, jamais celle de la machine B", async ({
  page,
}) => {
  await page.goto(`/interventions?q=${NUMERO_SERIE_A}`);
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText(
      decompte(
        1,
        fr["interventions.resultat_un"],
        fr["interventions.resultat"],
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await capturer(page, "recherche-numero-serie");
});

test("le champ de recherche annonce désormais le numéro de série", async ({
  page,
}) => {
  await page.goto("/interventions");
  await expect(
    page.getByText(fr["interventions.recherche"], { exact: true }),
  ).toBeVisible();
});
