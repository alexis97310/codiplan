import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { habilitationExigeeSurLeSite } from "@/app/(back-office)/interventions/presentation";
import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_RS_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EE-TP-UX4-1-FICHE-INTERVENTION-1 — L'EN-TÊTE, LE BANDEAU D'ÉTAT ET LA
 * FRISE D8, AU GABARIT DE LA MAQUETTE DU 28/09.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EE-`
 *
 * Six interventions forgées DIRECTEMENT par `INSERT`, comme l'aurait fait un
 * import ou l'application elle-même selon le statut — jamais via
 * `tests/e2e/setup/scene.ts` : aucune ligne du semis ne porte ces six
 * statuts À LA FOIS avec une habilitation bloquante et une pause avec pièce.
 * Créée en `beforeAll`, supprimée en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9EE = "00000000-0000-7000-8000-00000000ee01";
const SITE_9EE = "00000000-0000-7000-8000-00000000ee02";
const INTERVENTION_A_PLANIFIER = "00000000-0000-7000-8000-00000000ee10";
const INTERVENTION_EN_RETARD = "00000000-0000-7000-8000-00000000ee11";
const INTERVENTION_EN_COURS = "00000000-0000-7000-8000-00000000ee12";
const INTERVENTION_SUSPENDUE = "00000000-0000-7000-8000-00000000ee13";
const INTERVENTION_TERMINEE_REFUSEE = "00000000-0000-7000-8000-00000000ee14";
const INTERVENTION_TERMINEE_PRETE = "00000000-0000-7000-8000-00000000ee15";
const SEGMENT_EN_COURS = "00000000-0000-7000-8000-00000000ee20";
const SEGMENT_TERMINEE = "00000000-0000-7000-8000-00000000ee21";
const HABILITATION_9EE = "00000000-0000-7000-8000-00000000ee30";
const EXIGENCE_9EE = "00000000-0000-7000-8000-00000000ee31";
const HABILITATION_CODE = fr["9ee.e2e.habilitation_code"];
const PIECE_REF = fr["9ee.e2e.piece_ref"];

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
    const technicienId = reperes.technicienDucos;
    const jourLocal = jourDe(maintenant(reperes.fuseau).local);
    const aujourdhui = instantDuJour(jourLocal);
    const hier = instantDuJour(jourLocal, -1);
    const dansCinqJours = instantDuJour(jourLocal, 5);

    await client.client.create({
      data: {
        id: CLIENT_9EE,
        societe_id: reperes.societeId,
        raison_sociale: "9EE — client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EE,
        societe_id: reperes.societeId,
        client_id: CLIENT_9EE,
        agence_id: agence.id,
        libelle: "9EE — site de l'épreuve",
      },
    });

    // UNE EXIGENCE BLOQUANTE SUR CE SITE — pour le bandeau « À planifier ».
    await client.habilitation.create({
      data: {
        id: HABILITATION_9EE,
        societe_id: reperes.societeId,
        code: HABILITATION_CODE,
        libelle: "9EE — habilitation de l'épreuve",
        actif: true,
      },
    });
    await client.siteHabilitationRequise.create({
      data: {
        id: EXIGENCE_9EE,
        societe_id: reperes.societeId,
        site_id: SITE_9EE,
        habilitation_id: HABILITATION_9EE,
        bloquant: true,
      },
    });

    // À PLANIFIER, P1 — bandeau refus, exigence nommée, frise en tête.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p1', 'a_planifier', now())`,
      INTERVENTION_A_PLANIFIER,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
    );

    // PLANIFIÉE, DATÉE D'HIER — en retard.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'planifiee', $6::date, now() - interval '1 day',
               now() - interval '1 day' + interval '1 hour', 60, $7::uuid, now())`,
      INTERVENTION_EN_RETARD,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
      hier,
      technicienId,
    );

    // EN COURS — un segment ouvert.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'en_cours', $6::date, now(), now() + interval '1 hour',
               60, $7::uuid, now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
      aujourdhui,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id", "societe_id", "intervention_id", "utilisateur_id", "debut",
          "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
               now() - interval '35 minutes', NULL, now())`,
      SEGMENT_EN_COURS,
      reperes.societeId,
      INTERVENTION_EN_COURS,
      technicienId,
    );

    // SUSPENDUE — motif et pièce attendue.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id",
          "motif_suspension", "piece_attendue_ref", "date_dispo_prevue",
          "suspendue_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p2', 'suspendue', $6::date, now(), now() + interval '1 hour',
               60, $7::uuid, '9EE — pièce manquante', $8, $9::date,
               now() - interval '2 days', now())`,
      INTERVENTION_SUSPENDUE,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
      aujourdhui,
      technicienId,
      PIECE_REF,
      dansCinqJours,
    );

    // TERMINÉE, SANS TEMPS MESURÉ — clôture refusée.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'terminee', $6::date, now(), now() + interval '1 hour',
               60, $7::uuid, now())`,
      INTERVENTION_TERMINEE_REFUSEE,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
      aujourdhui,
      technicienId,
    );

    // TERMINÉE, AVEC TEMPS MESURÉ (un segment fermé) — prête à clôturer.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "date_planifiee", "creneau_debut",
          "creneau_fin", "duree_estimee_min", "technicien_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p4', 'terminee', $6::date, now(), now() + interval '1 hour',
               60, $7::uuid, now())`,
      INTERVENTION_TERMINEE_PRETE,
      reperes.societeId,
      CLIENT_9EE,
      SITE_9EE,
      agence.id,
      aujourdhui,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail"
         ("id", "societe_id", "intervention_id", "utilisateur_id", "debut",
          "fin", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid,
               now() - interval '90 minutes', now(), now())`,
      SEGMENT_TERMINEE,
      reperes.societeId,
      INTERVENTION_TERMINEE_PRETE,
      technicienId,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention"
         SET "temps_mesure_min" = 90, "temps_valide_min" = 90
       WHERE "id" = $1::uuid`,
      INTERVENTION_TERMINEE_PRETE,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" IN (
         SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid
       )`,
      CLIENT_9EE,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9EE,
    );
    await client.siteHabilitationRequise.deleteMany({
      where: { id: EXIGENCE_9EE },
    });
    await client.habilitation.deleteMany({ where: { id: HABILITATION_9EE } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9EE } });
    await client.client.deleteMany({ where: { id: CLIENT_9EE } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EE-TP-UX4-1-FICHE-INTERVENTION-1/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [1280, 375]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test.describe("sous le rôle ADV par défaut", () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirUneSession(page);
  });

  test("à planifier, P1, habilitation bloquante : bandeau refus nommé, frise en tête", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);
    const entete = page.locator("main header");
    await expect(entete).toContainText(fr["type_intervention.curatif"]);
    await expect(entete).toContainText(fr["statut.a_planifier"]);
    await expect(entete).toContainText(fr["priorite.p1"]);

    const bandeau = page
      .getByRole("alert")
      .filter({ hasText: fr["intervention.bandeau.a_planifier_depuis"] });
    await expect(bandeau).toBeVisible();
    await expect(bandeau).toContainText(
      fr["intervention.bandeau.priorite_critique"],
    );
    await expect(bandeau).toContainText(
      habilitationExigeeSurLeSite(HABILITATION_CODE),
    );

    const frise = page.getByRole("list").first();
    await expect(frise).toBeVisible();
    await expect(
      page.locator('[aria-current="step"]', {
        hasText: fr["statut.a_planifier"],
      }),
    ).toBeVisible();

    await capturer(page, "a-planifier-p1");
  });

  test("planifiée en retard : bandeau refus « en retard », pastille planifiée", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_EN_RETARD}`);
    await expect(page.locator("main header")).toContainText(
      fr["statut.planifiee"],
    );
    const bandeau = page
      .getByRole("alert")
      .filter({ hasText: fr["intervention.bandeau.en_retard_avant"] });
    await expect(bandeau).toContainText(
      fr["intervention.bandeau.en_retard_avant"],
    );

    await capturer(page, "planifiee-en-retard");
  });

  test("en cours, segment ouvert : bandeau information, le compteur en marche", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);
    const bandeau = page.getByRole("status").filter({
      hasText: fr["intervention.bandeau.compteur_en_marche"],
    });
    await expect(bandeau).toBeVisible();

    await capturer(page, "en-cours-compteur");
  });

  test("suspendue, pièce attendue : bandeau avertissement, la référence de la pièce", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_SUSPENDUE}`);
    const bandeau = page.getByRole("status").filter({
      hasText: fr["intervention.bandeau.suspendue_depuis"],
    });
    await expect(bandeau).toBeVisible();
    await expect(bandeau).toContainText(PIECE_REF);

    const frise = page.locator('[aria-current="step"]');
    await expect(frise.first()).toContainText(fr["statut.en_cours"]);

    await capturer(page, "suspendue-piece");
  });

  test("terminée sans temps mesuré : clôture refusée, nommée", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_TERMINEE_REFUSEE}`);
    const bandeau = page.getByRole("status").filter({
      hasText: fr["intervention.bandeau.cloture_impossible"],
    });
    await expect(bandeau).toBeVisible();
    await expect(bandeau).toContainText(
      fr["intervention.refus.temps_manquant"],
    );

    await capturer(page, "terminee-refusee");
  });

  test("terminée avec temps mesuré : prête à clôturer, le lien primaire mène au bloc", async ({
    page,
  }) => {
    await page.goto(`/interventions/${INTERVENTION_TERMINEE_PRETE}`);
    const bandeau = page.getByRole("status").filter({
      hasText: fr["intervention.bandeau.prete_a_cloturer"],
    });
    await expect(bandeau).toBeVisible();

    const lien = page
      .getByRole("link", { name: fr["intervention.action.cloturer"] })
      .first();
    await lien.click();
    await expect(page).toHaveURL(/#action-cloturer$/);
    await expect(page.locator("#action-cloturer")).toBeInViewport();

    await capturer(page, "terminee-prete");
  });
});

test("rôle responsable SAV : même en-tête, mêmes bandeaux sur « à planifier » et « terminée »", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RS_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);
  await expect(page.locator("main header")).toContainText(
    fr["statut.a_planifier"],
  );
  await capturer(page, "a-planifier-p1-resp-sav");

  await page.goto(`/interventions/${INTERVENTION_TERMINEE_PRETE}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["intervention.bandeau.prete_a_cloturer"] }),
  ).toBeVisible();
  await capturer(page, "terminee-prete-resp-sav");
});
