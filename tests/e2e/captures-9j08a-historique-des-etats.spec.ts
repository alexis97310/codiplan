import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES — 9J08A-HISTORIQUE-DES-ETATS, point 5.
 *
 * Deux interventions, deux formes d'historique :
 *   — COMPLETE : créée par INSERT (le déclencheur pose la ligne de création),
 *     puis plusieurs UPDATE de statut en SQL brut (le déclencheur pose une
 *     ligne par changement réel) — le même mécanisme que la vraie
 *     application, jamais une ligne fabriquée à la main.
 *   — INCOMPLETE : créée par INSERT puis sa ligne de création EFFACÉE (sous
 *     le rôle propriétaire, hors RLS) pour simuler une intervention née
 *     AVANT cette migration — exactement ce que « sans reprise du passé »
 *     laisse comme trace : la première ligne connue porte un `statut_avant`
 *     non nul.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9J08A-HISTORIQUE-DES-ETATS/captures",
);

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_COMPLETE = uuidv7();
const INTERVENTION_INCOMPLETE = uuidv7();

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
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9J08A-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9J08A-Lieu (captures)",
      },
    });

    for (const id of [INTERVENTION_COMPLETE, INTERVENTION_INCOMPLETE]) {
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention"
           ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
            "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
            "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                 'planifiee', now() - interval '3 days', 60, $6::uuid, now())`,
        id,
        reperes.societeId,
        CLIENT_ID,
        SITE_ID,
        agence.id,
        reperes.technicienDucos,
      );
    }

    // COMPLETE — plusieurs changements RÉELS, le déclencheur pose une ligne
    // par transition. L'ÉTAT COURANT reste OUVERT (« en_cours ») — c'est ce
    // que la capture doit montrer en plus du temps cumulé.
    for (const statut of ["affectee", "en_cours"]) {
      await client.$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = $1::"StatutIntervention" WHERE "id" = $2::uuid`,
        statut,
        INTERVENTION_COMPLETE,
      );
    }

    // INCOMPLETE — la ligne de création est EFFACÉE (hors RLS, rôle
    // propriétaire) pour simuler une intervention née avant la migration ;
    // puis UN changement réel, dont la ligne porte un statut_avant non nul.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_statut_historique" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_INCOMPLETE,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = $1::uuid`,
      INTERVENTION_INCOMPLETE,
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
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

async function capturer(page: Page, nom: string, largeur: number) {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [375, 1280] as const) {
  test(`temps par état — historique complet, état courant ouvert — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/${INTERVENTION_COMPLETE}?onglet=historique`,
    );
    await expect(
      page.getByRole("heading", {
        name: fr["intervention.chronologie.temps_par_etat.titre"],
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `${fr["statut.en_cours"]} (${fr["intervention.chronologie.temps_par_etat.en_cours_suffixe"]})`,
      ),
    ).toBeVisible();
    await capturer(page, "temps-par-etat-complet", largeur);
  });

  test(`temps par état — historique incomplet, date de début affichée — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/${INTERVENTION_INCOMPLETE}?onglet=historique`,
    );
    await expect(
      page.getByRole("heading", {
        name: fr["intervention.chronologie.temps_par_etat.titre"],
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        fr["intervention.chronologie.temps_par_etat.indisponible_avant"],
        { exact: false },
      ),
    ).toBeVisible();
    await capturer(page, "temps-par-etat-incomplet", largeur);
  });
}
