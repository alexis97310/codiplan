import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES TROIS ONGLETS DU TÉLÉPHONE (PG-D4-TELEPHONE-ONGLETS, D146) — sous
 * 900 px, remplacent le sélecteur de vue et l'ancien repli en liste de la vue
 * Jour (C-B1).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGD4-` : un client, un site DUCOS, une
 * intervention `a_planifier` P1 (la file), une intervention `planifiee` avec
 * créneau (la frise/liste du jour) — tout créé et effacé par ce fichier,
 * jamais une fixture `SCENE.*` mutée (§9, même raison que `scene-glisser.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_PGD4 = uuidv7();
const SITE_PGD4 = uuidv7();
const A_PLANIFIER = uuidv7();
const PLANIFIEE = uuidv7();
// Un rang éloigné (20 semaines), pour ne recouper aucun offset déjà pris par
// les autres scénarios qui visent `technicienDucos` un mardi.
const RANG_SEMAINES = 20;
const HEURE_DEBUT_MINUTES = 9 * 60 + 15;
const DUREE_MIN = 60;

let reperes: ReperesDeScene;
let jour: ReturnType<typeof jourDeLaScene>;
let lundiDeLaFenetre: ReturnType<typeof jourDeLaScene>;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  jour = jourSuivant(jourDeLaScene(reperes, MARDI), RANG_SEMAINES * 7);
  lundiDeLaFenetre = jourSuivant(reperes.lundi, RANG_SEMAINES * 7);
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_PGD4,
        societe_id: reperes.societeId,
        raison_sociale: "PGD4CAP",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGD4,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGD4,
        agence_id: agence.id,
        libelle: "PGD4CAP",
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min", "mode_valorisation", "devise_code", "description",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL, 'curatif', 'p1',
               'a_planifier', NULL, NULL, NULL, NULL, 'temps_passe', 'XPF',
               'PGD4CAP — à planifier', now())`,
      A_PLANIFIER,
      reperes.societeId,
      agence.id,
      CLIENT_PGD4,
      SITE_PGD4,
    );
    await client.intervention.create({
      data: {
        id: PLANIFIEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_PGD4,
        site_id: SITE_PGD4,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(
          jour,
          HEURE_DEBUT_MINUTES,
          reperes.fuseau,
        ),
        creneau_fin: instantAMinutes(
          jour,
          HEURE_DEBUT_MINUTES + DUREE_MIN,
          reperes.fuseau,
        ),
        duree_estimee_min: DUREE_MIN,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
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
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [A_PLANIFIER, PLANIFIEE],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGD4,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGD4 } });
    await client.client.deleteMany({ where: { id: CLIENT_PGD4 } });
  } finally {
    await client.$disconnect();
  }
});

test.describe("à 375 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ouvrirUneSession(page);
  });

  test("trois onglets, « À traiter » montre la file sans défiler, « Aujourd'hui » ouvre la vue Jour", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}`,
    );

    const onglets = page.locator("[data-onglets-telephone]");
    await expect(onglets).toBeVisible();
    await expect(
      page.locator('[data-onglet-telephone="aujourdhui"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-onglet-telephone="a_traiter"]'),
    ).toBeVisible();
    const ongletSemaine = page.locator('[data-onglet-telephone="semaine"]');
    await expect(ongletSemaine).toBeVisible();
    await expect(ongletSemaine).toHaveAttribute("aria-current", "page");

    // SOUS L'ONGLET « SEMAINE » : LA LISTE, JAMAIS LA FILE.
    await expect(
      page.getByText(fr["planning.liste_lecture_seule"]),
    ).toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`),
    ).not.toBeVisible();

    // « À TRAITER » : L'URL GAGNE `volet=a_traiter`, GARDE `vue`/`semaine`.
    await page.locator('[data-onglet-telephone="a_traiter"]').click();
    await expect(page).toHaveURL(/volet=a_traiter/);
    await expect(page).toHaveURL(/vue=semaine/);
    await expect(page).toHaveURL(
      new RegExp(`semaine=${cleDeJour(lundiDeLaFenetre)}`),
    );
    await expect(
      page.locator(`[data-onglet-telephone="a_traiter"]`),
    ).toHaveAttribute("aria-current", "page");

    // FILTRÉE SUR « PGD4CAP », LA CARTE EST LA SEULE ET TIENT SANS DÉFILER
    // (CA-9) — la file de démonstration porte d'autres P1 plus anciens, que
    // la recherche écarte.
    const colonneATraiter = page.getByRole("complementary");
    await colonneATraiter
      .getByLabel(fr["planning.a_traiter_recherche"])
      .fill("PGD4CAP");
    await colonneATraiter
      .getByRole("button", { name: fr["planning.a_traiter_filtrer"] })
      .click();
    await expect(page).toHaveURL(/q=PGD4CAP/);

    // NON VÉRIFIÉ ICI : « sans défiler » (CA-9) au sens strict — la rangée de
    // filtres (PG-C6), la bannière des calendriers et le lien des absences
    // restent visibles au-dessus de la colonne sous 900 px (question en
    // passation, point 3) ; les masquer ou non reste à trancher par Alexis.
    // Cette épreuve vérifie que la carte filtrée est atteignable et visible.
    const carte = page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`);
    await carte.scrollIntoViewIfNeeded();
    await expect(carte).toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${PLANIFIEE}"]`).first(),
    ).not.toBeVisible();

    // LA LISTE SEMAINE N'EST PLUS VISIBLE SOUS « À TRAITER ».
    await expect(
      page.getByText(fr["planning.liste_lecture_seule"]),
    ).not.toBeVisible();

    // « POSER… » OUVRE LA FENÊTRE, PLEIN ÉCRAN, SANS RIEN ÉCRIRE.
    await page
      .getByRole("button", { name: fr["planning.pose.bouton_poser"] })
      .click();
    const fenetre = page.locator(`[data-fenetre-pose="${A_PLANIFIER}"]`);
    await expect(fenetre).toBeVisible();
    const boiteFenetre = await fenetre.boundingBox();
    expect(boiteFenetre).not.toBeNull();
    if (boiteFenetre !== null) {
      expect(boiteFenetre.width).toBeGreaterThanOrEqual(374);
      expect(boiteFenetre.height).toBeGreaterThanOrEqual(811);
    }
    await page
      .getByRole("button", { name: fr["planning.pose.annuler"] })
      .click();
    await expect(fenetre).not.toBeVisible();

    const client = admin();
    try {
      const relue = await client.intervention.findUniqueOrThrow({
        where: { id: A_PLANIFIER },
        select: { statut: true, date_planifiee: true },
      });
      expect(relue.statut).toBe("a_planifier");
      expect(relue.date_planifiee).toBeNull();
    } finally {
      await client.$disconnect();
    }

    // « AUJOURD'HUI » BASCULE VERS LA VUE JOUR.
    await page.locator('[data-onglet-telephone="aujourdhui"]').click();
    await expect(page).toHaveURL(/vue=jour/);
  });

  test("la vue Jour, au téléphone, montre une liste — jamais la frise", async ({
    page,
  }) => {
    await page.goto(`/planning?vue=jour&jour=${cleDeJour(jour)}`);
    await expect(
      page.locator('[data-maquette-bloc="vue-jour"]'),
    ).not.toBeVisible();
    const liste = page.locator('[data-maquette-bloc="liste-jour-telephone"]');
    await expect(liste).toBeVisible();
    const carte = liste.locator(`[data-carte-liste="${PLANIFIEE}"]`);
    await expect(carte).toBeVisible();
  });

  test("témoin — sans onglet actif, à partir de 901 px rien ne change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}&volet=a_traiter`,
    );
    await expect(page.locator("[data-onglets-telephone]")).not.toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`),
    ).toBeVisible();
    await expect(
      page.locator('[data-maquette-bloc="tableau-charge-semaine"]'),
    ).toBeVisible();
  });
});

test.describe("à 1280 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
  });

  test("témoin — aucun onglet de téléphone, la colonne et la grille visibles ensemble", async ({
    page,
  }) => {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(lundiDeLaFenetre)}&volet=a_traiter`,
    );
    await expect(page.locator("[data-onglets-telephone]")).not.toBeVisible();
    await expect(
      page.locator(`[data-tiroir-declencheur="${A_PLANIFIER}"]`),
    ).toBeVisible();
    await expect(
      page.locator('[data-maquette-bloc="tableau-charge-semaine"]'),
    ).toBeVisible();
  });
});
