import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, FORFAITS_SCENE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9EN-BON-CLIENT-SANS-MONTANT (D186, QT-8 (a)) — même
 * recette que `captures-gr14-duree-unique.spec.ts` : rien n'est écrit sans
 * `CAPTURES_9EN` (le chemin COMPLET du dossier cible), pour que l'exécution
 * ordinaire de `pnpm test:e2e` n'écrive jamais de fichier.
 *
 * UNE scène NEUVE, préfixée `9EN-`, avec un forfait posé (sans lui, la ligne
 * forfait de la version interne ne se distinguerait pas d'une absence) —
 * jamais `SCENE.*` ni `FICHE_BON_TERMINEE` de `bon-intervention.spec.ts`, que
 * d'autres fichiers lisent ou font avancer concurremment.
 *
 * Capturé AVANT toute assertion (§ recette) : même si une assertion rougit
 * sur l'ANCIEN code (rejoué depuis un worktree séparé pour l'AVANT), la
 * capture a déjà été écrite.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9EN = uuidv7();
const SITE_9EN = uuidv7();
const INTERVENTION_9EN = uuidv7();

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
        id: CLIENT_9EN,
        societe_id: reperes.societeId,
        raison_sociale: fr["bon5.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EN,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EN,
        agence_id: agence.id,
        libelle: fr["bon5.e2e.site"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9EN,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EN,
        site_id: SITE_9EN,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        forfait_deplacement_id: FORFAITS_SCENE[0].id,
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '90 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_9EN,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_9EN },
      data: { temps_mesure_min: 90, temps_valide_min: 90 },
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
      INTERVENTION_9EN,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9EN,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9EN } });
    await client.client.deleteMany({ where: { id: CLIENT_9EN } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER = process.env.CAPTURES_9EN ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}.png`),
    fullPage: true,
  });
}

test("ADV — bon par défaut, à l'écran et à l'impression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_9EN}/bon`);
  await capturer(page, "bon-adv-defaut-ecran");

  await page.emulateMedia({ media: "print" });
  await capturer(page, "bon-adv-defaut-impression");

  await expect(
    page.getByText(fr["bon5.e2e.client"], { exact: true }),
  ).toBeVisible();
});

test("ADV — bon `?version=interne`, à l'écran et à l'impression", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_9EN}/bon?version=interne`);
  await capturer(page, "bon-adv-interne-ecran");

  await page.emulateMedia({ media: "print" });
  await capturer(page, "bon-adv-interne-impression");

  await expect(
    page.getByText(fr["bon5.e2e.client"], { exact: true }),
  ).toBeVisible();
});

test("ADV — la barre de bascule à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_9EN}/bon`);
  await capturer(page, "bon-barre-375");

  await expect(
    page.getByText(fr["bon5.e2e.client"], { exact: true }),
  ).toBeVisible();
});

test("admin_societe — bon par défaut, sans bascule ni montant", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_9EN}/bon`);
  await capturer(page, "bon-admin-societe-ecran");

  await page.emulateMedia({ media: "print" });
  await capturer(page, "bon-admin-societe-impression");

  await expect(
    page.getByText(fr["bon5.e2e.client"], { exact: true }),
  ).toBeVisible();
});
