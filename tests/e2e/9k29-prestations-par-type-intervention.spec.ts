import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K29-PRESTATIONS-PAR-TYPE-INTERVENTION, D243 — DE BOUT EN BOUT.
 *
 * ## Ce que les scénarios d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/prestations.test.ts` prouve que le DÉPÔT écrit et relit
 * les types, cloisonnés par société. Il ne prouve pas que l'ÉCRAN terrain
 * APPLIQUE la règle de proposition — qu'une prestation « curatif seulement »
 * disparaisse réellement du rapport d'un préventif, et apparaisse sur un
 * curatif — ni que l'écran de réglage expose et modifie les cases.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9K29-`, SANS TOUCHER À `setup/scene.ts`
 *
 * Une prestation « curatif seulement » et DEUX interventions (une curative,
 * une préventive) — créées en `beforeAll`, supprimées en `afterAll` (même
 * discipline que `tests/e2e/9de-terminer-signature.spec.ts`). **Jamais
 * `SCENE.rapportTravaillee`** : `tests/unit/e2e-donnees-partagees.test.ts`
 * refuse qu'un fichier écrive en SQL brut sur une fixture qu'un AUTRE fichier
 * lit (mesuré : `rapport-terrain.spec.ts` écrit sur `SCENE.rapportTravaillee`
 * par `$executeRawUnsafe`) — une fixture qui a besoin d'être lue s'en donne
 * une à elle, sur le modèle de `SCENE.redimensionnable`.
 *
 * ## SÉRIEL — la scène de réglage (dernier test) crée une prestation que le
 * premier test terrain ne doit jamais voir sur SON intervention curative.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9K29 = uuidv7();
const SITE_9K29 = uuidv7();
const INTERVENTION_CURATIVE_9K29 = uuidv7();
const INTERVENTION_PREVENTIVE_9K29 = uuidv7();
const PRESTATION_CURATIF_9K29 = uuidv7();
const PRESTATION_UNIVERSELLE_9K29 = uuidv7();

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
        id: CLIENT_9K29,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9k29.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K29,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29,
        agence_id: agence.id,
        libelle: fr["terrain9k29.e2e.lieu"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_CURATIVE_9K29,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29,
        site_id: SITE_9K29,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        // `affectee` — le terrain ne montre que le TRANSMIS depuis 9DD.
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_PREVENTIVE_9K29,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K29,
        site_id: SITE_9K29,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        statut: "affectee",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });

    // LA PRESTATION « CURATIF SEULEMENT » — le cas du signalement du
    // 02/11/2026 : « sur une intervention préventive … cocher « remplacement
    // écrou porteur », ce n'est pas bon ».
    await client.prestation.create({
      data: {
        id: PRESTATION_CURATIF_9K29,
        societe_id: reperes.societeId,
        code: fr["terrain9k29.e2e.prestation_curatif_code"],
        libelle: fr["terrain9k29.e2e.prestation_curatif_libelle"],
        actif: true,
        types: { create: [{ id: uuidv7(), type_intervention: "curatif" }] },
      },
    });
    // LE TÉMOIN INVERSE — VIDE, donc proposée pour TOUS les types (D243),
    // et c'est ce que l'écran de réglage doit afficher pour elle.
    await client.prestation.create({
      data: {
        id: PRESTATION_UNIVERSELLE_9K29,
        societe_id: reperes.societeId,
        code: fr["terrain9k29.e2e.prestation_universelle_code"],
        libelle: fr["terrain9k29.e2e.prestation_universelle_libelle"],
        actif: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.prestation.deleteMany({
      where: {
        id: { in: [PRESTATION_CURATIF_9K29, PRESTATION_UNIVERSELLE_9K29] },
      },
    });
    await client.prestation.deleteMany({
      where: { libelle: fr["terrain9k29.e2e.prestation_reglage_libelle"] },
    });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9K29,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9K29 } });
    await client.client.deleteMany({ where: { id: CLIENT_9K29 } });
  } finally {
    await client.$disconnect();
  }
});

test.describe("le terrain ne propose une prestation que pour son type", () => {
  test.use({ viewport: { width: 375, height: 1200 } });

  async function ouvrirLaSessionDuTerrain(
    page: import("@playwright/test").Page,
  ): Promise<void> {
    await page.goto("/connexion");
    await page
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain/);
  }

  test("sur un PRÉVENTIF, la prestation « curatif seulement » n'apparaît pas", async ({
    page,
  }) => {
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_PREVENTIVE_9K29}`);
    await expect(
      page.getByText(fr["terrain9k29.e2e.prestation_curatif_libelle"]),
    ).not.toBeVisible();
  });

  test("sur un CURATIF, elle apparaît", async ({ page }) => {
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_CURATIVE_9K29}`);
    await expect(
      page.getByText(fr["terrain9k29.e2e.prestation_curatif_libelle"]),
    ).toBeVisible();
  });
});

test.describe("le réglage des prestations montre et modifie les types", () => {
  test.use({ viewport: { width: 1280, height: 1200 } });

  test("cocher « Curatif » puis enregistrer limite la prestation à ce type", async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");

    await page
      .getByLabel(fr["prestations.code"], { exact: true })
      .first()
      .fill(`9K29-REGLAGE-${uuidv7().slice(0, 8)}`);
    await page
      .getByLabel(fr["prestations.libelle"], { exact: true })
      .first()
      .fill(fr["terrain9k29.e2e.prestation_reglage_libelle"]);
    await page
      .getByRole("checkbox", { name: fr["type_intervention.curatif"] })
      .first()
      .check();
    await page
      .getByRole("button", { name: fr["prestations.creer_action"] })
      .click();

    await expect(page).toHaveURL(/\/parametres\/prestations/);
    const ligne = page.locator("tr", {
      hasText: fr["terrain9k29.e2e.prestation_reglage_libelle"],
    });
    await expect(ligne).toBeVisible();
    await expect(ligne).toContainText(fr["type_intervention.curatif"]);

    // RETROUVE LA LIGNE EN BASE POUR LA NETTOYER — son identifiant est né à
    // l'écran, jamais connu avant ce clic. `afterAll` la retrouverait aussi
    // par son libellé, mais la nettoyer ici tient la scène courte.
    const client = admin();
    try {
      await client.prestation.deleteMany({
        where: { libelle: fr["terrain9k29.e2e.prestation_reglage_libelle"] },
      });
    } finally {
      await client.$disconnect();
    }
  });

  test("une prestation SANS type coché affiche « tous les types », l'autre affiche son type", async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");

    const curatifSeul = page.locator("tr", {
      hasText: fr["terrain9k29.e2e.prestation_curatif_code"],
    });
    await expect(curatifSeul).toContainText(fr["type_intervention.curatif"]);

    const universelle = page.locator("tr", {
      hasText: fr["terrain9k29.e2e.prestation_universelle_code"],
    });
    await expect(universelle).toContainText(fr["prestations.types_tous"]);
  });
});
