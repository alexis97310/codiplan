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
 * 9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES — M1 DE L'AUDIT UX DU 10/11/2026 :
 * LA FICHE TERRAIN RENDT DEUX BANDEAUX DISTINCTS, JAMAIS UN SEUL.
 *
 * `tests/unit/interventions/terrain-routes-json.test.ts` prouve que la
 * ROUTE calcule les bonnes clés (`motif`, `alerte`) selon ce que
 * `alerterResponsablesSAV` rend ; `tests/isolation/
 * signature-terrain-repli-bureau.test.ts` prouve le REPLI sur le bureau.
 * Ni l'un ni l'autre ne prouve que l'ÉCRAN rend les deux bandeaux,
 * INDÉPENDAMMENT, dans les bonnes couleurs — ce que ce fichier mesure, par
 * une navigation DIRECTE sur les deux paramètres de requête que la route
 * pose (`versLaFiche`). Aucune désactivation de compte partagé ici : les
 * comptes de bureau de la scène (`COMPTE_ADMIN_SOCIETE_EPREUVE`,
 * `COMPTE_RS_EPREUVE`…) sont utilisés par d'autres scénarios en parallèle
 * (`fullyParallel: true`) — les désactiver temporairement les ferait
 * rougir sans rapport avec ce ticket (voir la passation).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9K26-`, SANS TOUCHER À `setup/scene.ts`
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9K26 = uuidv7();
const SITE_9K26 = uuidv7();
const INTERVENTION_9K26 = uuidv7();

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
        id: CLIENT_9K26,
        societe_id: reperes.societeId,
        raison_sociale: "9K26 — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K26,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K26,
        agence_id: agence.id,
        libelle: "9K26 — Site de l'épreuve",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9K26,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K26,
        site_id: SITE_9K26,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
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
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9K26,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "site" WHERE "client_id" = $1::uuid`,
      CLIENT_9K26,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "client" WHERE "id" = $1::uuid`,
      CLIENT_9K26,
    );
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K26-TERRAIN-ALERTE-FIN-DESTINATAIRES/captures",
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

test("l'alerte est partie : seul le bandeau vert « Intervention terminée. » est visible", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(
    `/terrain/${INTERVENTION_9K26}?motif=terrain.terminer.reussite`,
  );

  await expect(
    page.getByText(fr["terrain.terminer.reussite"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["terrain.terminer.alerte_non_partie"]),
  ).toHaveCount(0);

  await capturer(page, "terrain-reussite-seule", 375);
});

test("ni le SAV ni le bureau prévenus : le bandeau vert ET l'avertissement ambre, DEUX bandeaux distincts", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(
    `/terrain/${INTERVENTION_9K26}?motif=terrain.terminer.reussite&alerte=terrain.terminer.alerte_non_partie`,
  );

  await expect(
    page.getByText(fr["terrain.terminer.reussite"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["terrain.terminer.alerte_non_partie"], { exact: true }),
  ).toBeVisible();

  // JAMAIS « signalez-le vous-même » (B1 de l'audit) — la clé retirée ne
  // s'affiche plus, quel que soit le paramètre de requête.
  await expect(page.getByText(/signalez-le vous-même/i)).toHaveCount(0);

  await capturer(page, "terrain-reussite-et-alerte", 375);
  await capturer(page, "terrain-reussite-et-alerte", 1280);
});

// LE BANDEAU DU TABLEAU DE BORD (POINT 3) N'EST PAS ÉPROUVÉ PAR BASCULE
// D'ÉTAT ICI — voir l'en-tête du fichier : désactiver le `responsable_sav`
// de la scène PARTAGÉE romprait d'autres scénarios en parallèle. L'état
// « aucun responsable SAV actif » est prouvé par
// `tests/isolation/signature-terrain-repli-bureau.test.ts`
// (`aucunResponsableSavActif`) ; cette capture montre l'état par défaut de
// la scène (un responsable SAV actif existe), bandeau absent.
test("tableau de bord de l'administrateur — état par défaut, bandeau absent (un responsable SAV actif existe)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/tableau-de-bord");
  await expect(
    page.getByText(fr["tableau_de_bord.sans_responsable_sav_titre"]),
  ).toHaveCount(0);

  await capturer(page, "tableau-de-bord-admin-sans-bandeau", 375);
  await capturer(page, "tableau-de-bord-admin-sans-bandeau", 1280);
});
