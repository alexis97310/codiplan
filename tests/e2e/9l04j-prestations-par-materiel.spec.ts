import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L04J-PRESTATIONS-PAR-MATERIEL, D259 — DE BOUT EN BOUT.
 *
 * ## Ce que les scénarios d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/prestations.test.ts` prouve que le DÉPÔT écrit et relit
 * les familles, cloisonnées par société. Il ne prouve pas que l'ÉCRAN
 * terrain APPLIQUE la règle de proposition — qu'une prestation réservée aux
 * ponts élévateurs disparaisse ENTIÈREMENT (rubrique comprise) sur une
 * intervention dont la machine est un compresseur, ni que l'écran de
 * réglage expose et modifie les cases de familles.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L04J-`, SANS TOUCHER À `setup/scene.ts`
 *
 * Un client, un site, deux machines (un pont élévateur, un compresseur — les
 * modèles du SEMIS, jamais une famille forgée par l'épreuve, I9) et trois
 * interventions curatives, créés en `beforeAll`, supprimés en `afterAll`
 * (même discipline que `tests/e2e/9k29-prestations-par-type-intervention.
 * spec.ts`).
 *
 * ## SÉRIEL — la scène de réglage (dernier bloc) crée une prestation que les
 * blocs terrain ne doivent jamais voir sur LEURS interventions.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9L04J = uuidv7();
const SITE_9L04J = uuidv7();
const MACHINE_PONT_9L04J = uuidv7();
const MACHINE_COMPRESSEUR_9L04J = uuidv7();
const INTERVENTION_PONT_9L04J = uuidv7();
const INTERVENTION_COMPRESSEUR_9L04J = uuidv7();
const INTERVENTION_HISTORIQUE_9L04J = uuidv7();
const PRESTATION_PONT_9L04J = uuidv7();

/** Lu en base plutôt qu'écrit en dur (§9) — le libellé appartient au semis, jamais à l'épreuve. */
let libellePont = "";

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
    // LES MODÈLES DU SEMIS (I9) — jamais une famille forgée par l'épreuve :
    // `PONT-ELEV` et `COMPRESSEUR` sont les deux familles de démonstration
    // (`prisma/seed-data.ts`), exactement celles du constat de production
    // (INT-2026-1853).
    const modelePont = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId, famille: { code: "PONT-ELEV" } },
      select: { id: true, famille_id: true },
    });
    const modeleCompresseur = await client.modeleMateriel.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        famille: { code: "COMPRESSEUR" },
      },
      select: { id: true },
    });
    const familleP = await client.familleMateriel.findUniqueOrThrow({
      where: { id: modelePont.famille_id },
      select: { libelle: true },
    });
    libellePont = familleP.libelle;

    await client.client.create({
      data: {
        id: CLIENT_9L04J,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9l04j.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L04J,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04J,
        agence_id: agence.id,
        libelle: fr["terrain9l04j.e2e.lieu"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_PONT_9L04J,
        societe_id: reperes.societeId,
        modele_id: modelePont.id,
        client_id: CLIENT_9L04J,
        site_id: SITE_9L04J,
        numero_serie: fr["terrain9l04j.e2e.serie_pont"],
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_COMPRESSEUR_9L04J,
        societe_id: reperes.societeId,
        modele_id: modeleCompresseur.id,
        client_id: CLIENT_9L04J,
        site_id: SITE_9L04J,
        numero_serie: fr["terrain9l04j.e2e.serie_compresseur"],
        qr_token: engendrerJetonQr(),
      },
    });

    // LA PRESTATION RÉSERVÉE AU PONT — le constat de production exact
    // (INT-2026-1853) : « Remplacement écrous porteurs » proposée sur un
    // compresseur.
    await client.prestation.create({
      data: {
        id: PRESTATION_PONT_9L04J,
        societe_id: reperes.societeId,
        code: fr["terrain9l04j.e2e.prestation_pont_code"],
        libelle: fr["terrain9l04j.e2e.prestation_pont_libelle"],
        actif: true,
        familles: {
          create: [{ id: uuidv7(), famille_id: modelePont.famille_id }],
        },
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_PONT_9L04J,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04J,
        site_id: SITE_9L04J,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "en_cours",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
        machines: {
          create: [{ id: uuidv7(), machine_id: MACHINE_PONT_9L04J }],
        },
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_COMPRESSEUR_9L04J,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L04J,
        site_id: SITE_9L04J,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "en_cours",
        date_planifiee: new Date("2026-09-25T00:00:00Z"),
        duree_estimee_min: 60,
        machines: {
          create: [{ id: uuidv7(), machine_id: MACHINE_COMPRESSEUR_9L04J }],
        },
      },
    });

    // UNE INTERVENTION PASSÉE, déjà clôturée, avec la prestation DÉJÀ
    // déclarée réalisée — point 5, « historique gardé » : le bon doit la
    // montrer même si rien ne la filtre plus.
    // SOUS L'EXEMPTION « fixture_isolation » (9L14-FIGE-A-LA-CLOTURE) : une
    // intervention `cloturee` figée refuse désormais `intervention_machine`
    // et `intervention_prestation` en base ; cette ligne JETABLE n'a jamais
    // été « vivante » avant d'être close.
    await client.$transaction([
      client.$executeRawUnsafe(
        `SET LOCAL "fige_a_la_cloture.exemption" = 'fixture_isolation'`,
      ),
      client.intervention.create({
        data: {
          id: INTERVENTION_HISTORIQUE_9L04J,
          societe_id: reperes.societeId,
          client_id: CLIENT_9L04J,
          site_id: SITE_9L04J,
          agence_id: agence.id,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          statut: "cloturee",
          date_planifiee: new Date("2026-09-20T00:00:00Z"),
          duree_estimee_min: 60,
          machines: {
            create: [{ id: uuidv7(), machine_id: MACHINE_PONT_9L04J }],
          },
          prestations_realisees: {
            create: [{ id: uuidv7(), prestation_id: PRESTATION_PONT_9L04J }],
          },
        },
      }),
    ]);
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LES INTERVENTIONS D'ABORD — `intervention_machine` et
    // `intervention_prestation` CASCADENT depuis elles, jamais l'inverse.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L04J,
    );
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_PONT_9L04J, MACHINE_COMPRESSEUR_9L04J] } },
    });
    await client.prestation.deleteMany({
      where: { id: PRESTATION_PONT_9L04J },
    });
    await client.prestation.deleteMany({
      where: { libelle: fr["terrain9l04j.e2e.prestation_reglage_libelle"] },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9L04J } });
    await client.client.deleteMany({ where: { id: CLIENT_9L04J } });
  } finally {
    await client.$disconnect();
  }
});

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain/);
}

test.describe("le terrain ne propose une prestation que pour la famille de SA machine", () => {
  test.use({ viewport: { width: 375, height: 1200 } });

  test("sur un PONT ÉLÉVATEUR, la prestation réservée au pont est PROPOSÉE ET COCHABLE", async ({
    page,
  }) => {
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_PONT_9L04J}`);
    const case_ = page.getByLabel(
      fr["terrain9l04j.e2e.prestation_pont_libelle"],
    );
    await expect(case_).toBeVisible();
    await expect(case_).toBeEnabled();
  });

  test("sur un COMPRESSEUR, la rubrique « Prestations réalisées » DISPARAÎT ENTIÈREMENT", async ({
    page,
  }) => {
    await ouvrirLaSessionDuTerrain(page);
    await page.goto(`/terrain/${INTERVENTION_COMPRESSEUR_9L04J}`);
    // NI la prestation NI LE TITRE DE LA RUBRIQUE — D259, décision du
    // 13/11/2026 : jamais un message à la place, la section entière s'efface.
    await expect(
      page.getByText(fr["terrain9l04j.e2e.prestation_pont_libelle"]),
    ).not.toBeVisible();
    await expect(
      page.getByText(fr["terrain.prestations.titre"]),
    ).not.toBeVisible();
  });
});

test.describe("une intervention passée garde sa prestation sur le bon (point 5)", () => {
  test.use({ viewport: { width: 375, height: 1200 } });

  test("le bon interne affiche la prestation, hors de tout filtre", async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto(`/interventions/${INTERVENTION_HISTORIQUE_9L04J}/bon`);
    await expect(
      page.getByText(fr["terrain9l04j.e2e.prestation_pont_libelle"]),
    ).toBeVisible();
  });
});

test.describe("le réglage des prestations montre et modifie les familles de matériel", () => {
  test.use({ viewport: { width: 1280, height: 1200 } });

  test("cocher une famille puis enregistrer la limite à cette famille", async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");

    await page
      .getByLabel(fr["prestations.code"], { exact: true })
      .first()
      .fill(`9L04J-REGLAGE-${uuidv7().slice(0, 8)}`);
    await page
      .getByLabel(fr["prestations.libelle"], { exact: true })
      .first()
      .fill(fr["terrain9l04j.e2e.prestation_reglage_libelle"]);
    await page.getByRole("checkbox", { name: libellePont }).first().check();
    await page
      .getByRole("button", { name: fr["prestations.creer_action"] })
      .click();

    await expect(page).toHaveURL(/\/parametres\/prestations/);
    const ligne = page.locator("tr", {
      hasText: fr["terrain9l04j.e2e.prestation_reglage_libelle"],
    });
    await expect(ligne).toBeVisible();
    await expect(ligne).toContainText(libellePont);

    const client = admin();
    try {
      await client.prestation.deleteMany({
        where: { libelle: fr["terrain9l04j.e2e.prestation_reglage_libelle"] },
      });
    } finally {
      await client.$disconnect();
    }
  });

  test("la prestation réservée au pont affiche SA famille, jamais « Toutes »", async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/prestations");

    const ligne = page.locator("tr", {
      hasText: fr["terrain9l04j.e2e.prestation_pont_code"],
    });
    await expect(ligne).toContainText(libellePont);
    await expect(ligne).not.toContainText(fr["prestations.familles_toutes"]);
  });
});
