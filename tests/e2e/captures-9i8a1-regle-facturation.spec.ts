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
 * CAPTURES — 9I8A1-REPRISE-9I8A, point 7. Même patron que
 * `captures-9i8-affichage-des-montants.spec.ts` : une intervention CLÔTURÉE
 * est insérée directement par SQL, sa `valorisation_figee` posée à la main
 * comme `cloturerIntervention` l'aurait calculée (1 h 05 réelles, règle
 * 60/30/5 → 1 h 30 facturées, l'exemple même qu'Alexis cite), pour ne pas
 * dépendre d'un parcours de clôture complet (rapport, prestations,
 * signature) hors du territoire de ce lot.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9I8A1-REPRISE-9I8A/captures",
);

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();

/** Même exemple que `FormulaireRegleFacturation` et le registre (D224). */
const MINUTES_REELLES = 65;
const MINUTES_FACTUREES = 90;
const TAUX_MINEUR = 8500;
const MAIN_DOEUVRE_MINEUR = 12750; // 8500 × 90 / 60

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
        raison_sociale: "zz9I8A1-Client (captures)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9I8A1-Lieu (captures)",
      },
    });
    const valorisationFigee = {
      minutesReelles: MINUTES_REELLES,
      minutesArrondies: MINUTES_FACTUREES,
      minutesFacturees: MINUTES_FACTUREES,
      plancherApplique: false,
      regle: { plancherMinutes: 60, palierMinutes: 30, seuilPalierMinutes: 5 },
      tauxHoraire: { valeur: String(TAUX_MINEUR), devise: "XPF" },
      mainDoeuvre: { valeur: String(MAIN_DOEUVRE_MINEUR), devise: "XPF" },
      forfaitDeplacement: null,
      majoration: null,
      totalHT: { valeur: String(MAIN_DOEUVRE_MINEUR), devise: "XPF" },
      motifTotalInconnu: null,
    };
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "montant_ht", "devise_code", "valorisation_figee",
          "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', '2026-11-24T00:00:00Z', 60, $6::uuid,
               $7, $6::uuid, now(), now(), $8, 'XPF', $9::jsonb, now())`,
      INTERVENTION_CLOTUREE,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      reperes.technicienDucos,
      MINUTES_REELLES,
      MAIN_DOEUVRE_MINEUR,
      JSON.stringify(valorisationFigee),
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
    path: join(DOSSIER_CAPTURES, `apres-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [375, 1280] as const) {
  test(`réglage « Règle de facturation du temps », avec l'exemple en direct — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/tarifs");
    await expect(
      page.getByText(fr["tarifs.regle_facturation.titre"]),
    ).toBeVisible();
    // L'exemple cité par Alexis, calculé en direct depuis les valeurs par
    // défaut (60/30/5) : « 1 h 05 → 1 h 30 ».
    await expect(page.getByText("1 h 05")).toBeVisible();
    await expect(page.getByText("1 h 30")).toBeVisible();
    await capturer(page, "reglage-tarifs", largeur);
  });

  test(`décomposition d'une intervention clôturée (1 h 05 → 1 h 30, figée) — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
    await page.goto(
      `/interventions/${INTERVENTION_CLOTUREE}?onglet=valorisation`,
    );
    await expect(
      page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
    ).toBeVisible();
    await expect(page.getByText("1 h 30")).toBeVisible();
    await capturer(page, "fiche-decomposition-cloturee", largeur);
  });

  test(`bon d'une intervention clôturée — ${largeur}px`, async ({ page }) => {
    await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
    await page.goto(
      `/interventions/${INTERVENTION_CLOTUREE}/bon?version=interne`,
    );
    await expect(page.getByText(/12\s750/)).toBeVisible();
    await capturer(page, "bon-cloturee", largeur);
  });
}
