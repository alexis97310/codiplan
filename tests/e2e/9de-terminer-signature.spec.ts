import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirLaSessionSensible } from "./setup/session";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";

/**
 * 9DE-TP-CY1-TERMINER-SIGNATURE — COMPTEUR → SIGNATURE → TERMINER, DE BOUT EN
 * BOUT.
 *
 * ## Ce que les scénarios d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/terminer-intervention.test.ts` prouve que le DÉPÔT accepte
 * ou refuse. Il ne prouve pas que l'ÉCRAN propose le bon enchaînement — le
 * bouton « Terminer » apparaît seulement quand `peutTerminer` peut aboutir —
 * ni que la fiche back-office et l'onglet « À contrôler » affichent ensuite
 * ce que le terrain vient d'écrire.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DE-`, SANS TOUCHER À `setup/scene.ts`
 *
 * Un client, un site, une intervention — créés en `beforeAll`, supprimés en
 * `afterAll` (même discipline que `tests/e2e/bon-4.spec.ts`).
 *
 * ## LE TEMPS MESURÉ EST BACKDATÉ, PAS ATTENDU
 *
 * `tests/e2e/terrain.spec.ts` le dit déjà : deux clics séparés d'une seconde
 * mesurent 0 min, la troncature se faisant à la minute. Ce fichier ne fait
 * pas attendre le navigateur une heure : il recule `debut` de 70 minutes par
 * une écriture directe, APRÈS avoir démarré le compteur par l'écran — ce qui
 * reste éprouvé par l'écran est l'ENCHAÎNEMENT, pas l'arithmétique du temps,
 * déjà éprouvée par les scénarios unitaires et d'isolation.
 *
 * ## SÉRIEL — un seul dossier, du compteur à l'onglet « À contrôler »
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9DE = uuidv7();
const SITE_9DE = uuidv7();
const INTERVENTION_9DE = uuidv7();

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
        id: CLIENT_9DE,
        societe_id: reperes.societeId,
        raison_sociale: "9DE-E2E Client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DE,
        societe_id: reperes.societeId,
        client_id: CLIENT_9DE,
        agence_id: agence.id,
        libelle: "9DE-E2E Site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9DE,
        societe_id: reperes.societeId,
        client_id: CLIENT_9DE,
        site_id: SITE_9DE,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        // `affectee` — le terrain ne montre que le TRANSMIS depuis 9DD.
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
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
    // `segment_travail` est RESTRICT sur l'intervention (I10) — supprimé
    // explicitement avant la ligne, jamais par CASCADE comme la signature.
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9DE,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9DE,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9DE } });
    await client.client.deleteMany({ where: { id: CLIENT_9DE } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9DE-TP-CY1-TERMINER-SIGNATURE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/** Recule le DÉBUT du segment ouvert, pour que l'écart mesure plus que zéro minute. */
async function reculerLeSegmentOuvert(): Promise<void> {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `UPDATE "segment_travail" SET "debut" = "debut" - interval '70 minutes'
        WHERE "intervention_id" = $1::uuid AND "fin" IS NULL`,
      INTERVENTION_9DE,
    );
  } finally {
    await client.$disconnect();
  }
}

test("compteur → signature → Terminer : la fiche bureau affiche Terminée, « À contrôler » en compte une", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  await page.goto(`/terrain/${INTERVENTION_9DE}`);

  // ── LE COMPTEUR ───────────────────────────────────────────────────────
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_9DE}$`));
  await expect(page.getByText(fr["terrain.compteur.tourne"])).toBeVisible();
  await capturer(page, "terrain-en-cours", 375);
  await capturer(page, "terrain-en-cours", 1280);

  await reculerLeSegmentOuvert();

  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(page.getByText(fr["terrain.compteur.tourne"])).toHaveCount(0);

  // ── LA SIGNATURE — AUCUNE ISSUE CHOISIE D'AVANCE ─────────────────────
  await capturer(page, "signature-trois-issues", 375);
  await page
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill("Jean Testeur");
  await page.locator("canvas").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
          pointerId: 1,
        }),
      );
    };
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointerup", 100, 80);
  });
  await page
    .getByRole("button", { name: fr["terrain.signature.enregistrer"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_9DE}$`));
  await expect(
    page.getByText(fr["terrain.signature.deja_signee"]),
  ).toBeVisible();

  // ── TERMINER ──────────────────────────────────────────────────────────
  await expect(
    page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
  ).toBeVisible();
  await capturer(page, "terrain-avant-terminer", 375);
  await capturer(page, "terrain-avant-terminer", 1280);

  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_9DE}$`));
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }),
  ).toBeVisible();

  await capturer(page, "terrain-apres-terminer", 375);
  await capturer(page, "terrain-apres-terminer", 1280);
});

test("la fiche back-office affiche Terminée, et « À contrôler » compte CETTE intervention", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  await page.goto(`/interventions/${INTERVENTION_9DE}`);
  await expect(
    page.getByText(fr["statut.terminee"], { exact: true }).first(),
  ).toBeVisible();

  await capturer(page, "fiche-bureau-terminee", 1280);
  await capturer(page, "fiche-bureau-terminee", 375);

  // Scopé à CETTE scène, jamais au compte brut de l'onglet (partagé entre
  // les specs qui tournent en parallèle, `fullyParallel: true`).
  await page.goto("/interventions?q=9DE-&vue=a_controler");
  await expect(page.getByRole("link", { name: /INT-|Local-/ })).toHaveCount(1);

  await capturer(page, "a-controler-9de", 1280);
});

test("la fiche back-office affiche l'issue « Client absent » et son motif", async ({
  page,
}) => {
  // Une SECONDE intervention jetable, forgée directement en base — ce test
  // ne rejoue pas le terrain (déjà prouvé ci-dessus), il montre ce qu'une
  // issue « client_absent » affiche sur la fiche bureau.
  const client = admin();
  const interventionAbsente = uuidv7();
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
         "type","statut","date_planifiee","technicien_id","duree_estimee_min","modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               'curatif', 'terminee', '2026-09-25', $6::uuid, 60, now())`,
      interventionAbsente,
      reperes.societeId,
      CLIENT_9DE,
      SITE_9DE,
      agence.id,
      reperes.technicienDucos,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_signature" ("id","societe_id","intervention_id","issue","motif")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'client_absent', 'Client injoignable au numéro connu')`,
      reperes.societeId,
      interventionAbsente,
    );

    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto(`/interventions/${interventionAbsente}`);
    await expect(
      page.getByText(fr["intervention.realisation.signature_absente"]),
    ).toBeVisible();
    await expect(
      page.getByText("Client injoignable au numéro connu"),
    ).toBeVisible();

    await capturer(page, "fiche-bureau-client-absent", 1280);
    await capturer(page, "fiche-bureau-client-absent", 375);
  } finally {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      interventionAbsente,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionAbsente,
    );
    await client.$disconnect();
  }
});
