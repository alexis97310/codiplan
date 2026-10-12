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
 * 9EU-SOLDE-FICHE-PLANNING (solde 167, D197, décision n° 84 d'Alexis du
 * 13/10/2026) — SUR UNE SUSPENDUE, « DÉPLACER » ET « CHANGER DE TECHNICIEN »
 * SONT TOUS LES DEUX PROPOSÉS ; NI L'UN NI L'AUTRE SUR UNE EN COURS OU UNE
 * TERMINÉE.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9EU-`
 *
 * Un client, un site, trois interventions (`suspendue`, `en_cours`,
 * `terminee`) — créées en `beforeAll` par `INSERT` direct (ne déclenche pas
 * `intervention_cycle_de_vie`, qui ne surveille que l'`UPDATE`), supprimées
 * en `afterAll`, aucune ligne ajoutée au semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_D84 = uuidv7();
const SITE_D84 = uuidv7();
const INTERVENTION_SUSPENDUE = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();

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
        id: CLIENT_D84,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EU-D84-GESTES — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_D84,
        societe_id: reperes.societeId,
        client_id: CLIENT_D84,
        agence_id: agence.id,
        libelle: "zz9EU-D84-GESTES — site forgé",
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "duree_estimee_min", "motif_suspension", "suspendue_le",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'suspendue', 60, 'zz9EU-D84-GESTES — motif forgé', now(), now())`,
      INTERVENTION_SUSPENDUE,
      reperes.societeId,
      CLIENT_D84,
      SITE_D84,
      agence.id,
    );
    for (const [id, statut] of [
      [INTERVENTION_EN_COURS, "en_cours"],
      [INTERVENTION_TERMINEE, "terminee"],
    ] as const) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
            "statut", "duree_estimee_min", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                 '${statut}', 60, now())`,
        id,
        reperes.societeId,
        CLIENT_D84,
        SITE_D84,
        agence.id,
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
      CLIENT_D84,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_D84 } });
    await client.client.deleteMany({ where: { id: CLIENT_D84 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EU-SOLDE-FICHE-PLANNING/captures",
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

test("suspendue : « Déplacer » et « Changer de technicien… » sont tous les deux présents et fonctionnels", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_SUSPENDUE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.suspendue"]),
  ).toBeVisible();

  await capturer(page, "suspendue-gestes", 1280);
  await capturer(page, "suspendue-gestes", 375);

  const boutonDeplacer = page.getByRole("button", {
    name: fr["intervention.action.deplacer"],
  });
  await expect(boutonDeplacer).toBeVisible();
  await boutonDeplacer.click();
  const dialogueDeplacer = page.locator("dialog[open]");
  await expect(dialogueDeplacer).toBeVisible();
  await dialogueDeplacer.getByLabel(fr["intervention.date"]).fill("2026-12-15");
  await dialogueDeplacer
    .getByLabel(fr["intervention.deplacement.heure"])
    .fill("09:00");
  await dialogueDeplacer
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  await expect(page).toHaveURL(`/interventions/${INTERVENTION_SUSPENDUE}`);

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_SUSPENDUE },
      select: { date_planifiee: true },
    });
    expect(ligne.date_planifiee?.toISOString().slice(0, 10)).toBe("2026-12-15");
  } finally {
    await client.$disconnect();
  }

  await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: fr["intervention.action.changer_technicien"],
    }),
  ).toBeVisible();
});

test("en cours : ni « Déplacer » ni « Changer de technicien… »", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.en_cours"]),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: fr["intervention.action.deplacer"] }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: fr["intervention.action.changer_technicien"],
    }),
  ).toHaveCount(0);
});

test("terminée : ni « Déplacer » ni « Changer de technicien… »", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_TERMINEE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: fr["intervention.action.deplacer"] }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await expect(
    page.getByRole("menuitem", {
      name: fr["intervention.action.changer_technicien"],
    }),
  ).toHaveCount(0);
});
