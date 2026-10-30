import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CAPTURES — 9I8-AFFICHAGE-DES-MONTANTS, point 6. APRÈS seulement (budget
 * de temps du lot épuisé avant l'AVANT) : la preuve AVANT (bloc ENTIÈREMENT
 * absent) est le rouge mesuré et committé par
 * `tests/e2e/9i8-affichage-des-montants.spec.ts` (point 1) — voir la
 * passation.
 *
 * Même discipline que `captures-9i7a-mentions-legales-modifiables.spec.ts` :
 * `societe.afficher_montants` est PARTAGÉ par tout le run e2e, ce fichier
 * tourne en SÉRIE, le désactive le plus tard possible, le rétablit dans
 * `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I8-AFFICHAGE-DES-MONTANTS/captures",
);

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_VALORISEE = uuidv7();

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
        raison_sociale: "zz9I8-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9I8-Lieu (captures)",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'en_cours', '2026-11-24T00:00:00Z', 60, $6::uuid, 'XPF', now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      reperes.technicienDucos,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', '2026-11-24T00:00:00Z', 60, $6::uuid,
               90, $6::uuid, now(), now(), 'XPF', now())`,
      INTERVENTION_VALORISEE,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: true },
    });
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
    path: join(DOSSIER_CAPTURES, `apres-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [375, 1280] as const) {
  test(`onglet Valorisation avant clôture, ADV — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
    await page.goto(
      `/interventions/${INTERVENTION_EN_COURS}?onglet=valorisation`,
    );
    await expect(
      page.getByText(fr["intervention.valorisation.pas_encore"]),
    ).toBeVisible();
    await capturer(page, "valorisation-pas-encore-adv", largeur);
  });

  test(`onglet Valorisation avant clôture, admin_societe — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto(
      `/interventions/${INTERVENTION_EN_COURS}?onglet=valorisation`,
    );
    await expect(
      page.getByText(fr["intervention.valorisation.sans_droit"]),
    ).toBeVisible();
    await capturer(page, "valorisation-sans-droit-admin-societe", largeur);
  });
}

test("réglage désactivé — fiche et bon, captures aux deux largeurs", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: false },
    });
  } finally {
    await client.$disconnect();
  }

  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  for (const largeur of [375, 1280] as const) {
    await page.goto(
      `/interventions/${INTERVENTION_VALORISEE}?onglet=valorisation`,
    );
    await expect(
      page.getByText(fr["intervention.valorisation.desactive_par_societe"]),
    ).toBeVisible();
    await capturer(page, "fiche-desactive-par-societe", largeur);

    await page.goto(
      `/interventions/${INTERVENTION_VALORISEE}/bon?version=interne`,
    );
    await expect(
      page.getByText(fr["intervention.valorisation.desactive_par_societe"]),
    ).toBeVisible();
    await capturer(page, "bon-desactive-par-societe", largeur);
  }

  const clientRestauration = admin();
  try {
    await clientRestauration.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: true },
    });
  } finally {
    await clientRestauration.$disconnect();
  }
});

for (const largeur of [375, 1280] as const) {
  test(`page Paramètres société, avec la case — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/societe");
    await expect(page.getByText(fr["societe.montants_case"])).toBeVisible();
    await capturer(page, "parametres-societe-case-montants", largeur);
  });
}
