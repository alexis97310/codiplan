import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9K17-CAPTURES-9K11 — LES CAPTURES DU POINT 4, NON FAIT PAR 9K11
 * (`docs/propositions/9K11-LIBELLES-SUITES-ITINERAIRE/passation.md`).
 *
 * **APRÈS SEULEMENT** : 9K11 est déjà publié (c70550a37), donc l'ANCIEN
 * état n'est pas régénéré ici — la passation cite les captures existantes
 * (9K05, 9K07) qui le montrent déjà. Même recette que `captures-9k06-
 * portail-compte-telephone.spec.ts` (mémoire « captures-avant-apres-e2e ») :
 * sa propre scène jetable, posée dans `beforeAll`, effacée dans `afterAll`,
 * jamais celle de `tests/e2e/setup/scene.ts` (mémoire
 * « e2e-semis-partage-parallele »).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K17 ?? "";

const ADRESSE_RUE = "12 rue des Palétuviers";
const ADRESSE_COMMUNE = "Nouméa";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

let aQualifierId = "";
let origineReplanifierId = "";
let suiteReplanifierId = "";
let ordinaireId = "";
let clientId = "";
let siteId = "";
let clientTerrainId = "";
let siteTerrainId = "";

test.beforeAll(async () => {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
      reperes.lundi.mois,
    ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;

    clientId = uuidv7();
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: "zz9K17 client suites",
        actif: true,
      },
    });
    siteId = uuidv7();
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: "zz9K17 site suites",
      },
    });

    aQualifierId = uuidv7();
    await client.intervention.create({
      data: {
        id: aQualifierId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        type: "curatif",
        priorite: "p3",
        statut: "cloturee",
        cloturee_le: new Date(`${jour}T08:00:00.000Z`),
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9K17-a-qualifier",
        suite_a_donner: "9K17 — compresseur à revoir, devis à faire",
      },
    });

    origineReplanifierId = uuidv7();
    await client.intervention.create({
      data: {
        id: origineReplanifierId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        type: "curatif",
        priorite: "p3",
        statut: "cloturee",
        cloturee_le: new Date(`${jour}T08:00:00.000Z`),
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9K17-a-replanifier",
        suite_a_donner: "9K17 — pièce reçue, reprise à poser",
      },
    });
    suiteReplanifierId = uuidv7();
    await client.suiteADonner.create({
      data: {
        id: suiteReplanifierId,
        societe_id: reperes.societeId,
        intervention_origine_id: origineReplanifierId,
        statut: "a_replanifier",
      },
    });

    clientTerrainId = uuidv7();
    await client.client.create({
      data: {
        id: clientTerrainId,
        societe_id: reperes.societeId,
        raison_sociale: "zz9K17 client terrain",
        actif: true,
      },
    });
    siteTerrainId = uuidv7();
    await client.site.create({
      data: {
        id: siteTerrainId,
        societe_id: reperes.societeId,
        client_id: clientTerrainId,
        agence_id: agence.id,
        libelle: "zz9K17 site terrain",
        adresse: { rue: ADRESSE_RUE },
        commune: ADRESSE_COMMUNE,
      },
    });
    ordinaireId = uuidv7();
    await client.intervention.create({
      data: {
        id: ordinaireId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientTerrainId,
        site_id: siteTerrainId,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9K17-ordinaire-deplacer-et-itineraire",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (suiteReplanifierId !== "") {
      await client.suiteADonner.deleteMany({
        where: { id: suiteReplanifierId },
      });
    }
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [aQualifierId, origineReplanifierId, ordinaireId].filter(
            (id) => id !== "",
          ),
        },
      },
    });
    await client.site.deleteMany({
      where: { id: { in: [siteId, siteTerrainId].filter((id) => id !== "") } },
    });
    await client.client.deleteMany({
      where: {
        id: { in: [clientId, clientTerrainId].filter((id) => id !== "") },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [375, 1280] as const) {
  test(`registre des suites à donner, à ${largeur}px — « Ouvrir le devis » et « À planifier »`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto("/interventions/suites-a-donner");
    await expect(
      page.getByRole("button", {
        name: fr["suites_a_donner.action.qualifier"],
      }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["suites_a_donner.statut.a_replanifier"], {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: fr["suites_a_donner.action.replanifier"],
      }),
    ).toBeVisible();
    await capturer(page, "registre", largeur);
  });

  test(`le dialogue « Planifier la reprise… » ouvert, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(
      `/interventions/suites-a-donner/${suiteReplanifierId}/replanifier`,
    );
    await expect(page).toHaveURL(/\/replanifier$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fr["suites_a_donner.replanifier.titre"],
      }),
    ).toBeVisible();
    await capturer(page, "planifier-la-reprise", largeur);
  });

  test(`la fiche d'une intervention ordinaire, à ${largeur}px — « Déplacer… » générique inchangé`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${ordinaireId}`);
    await expect(
      page.getByRole("button", { name: fr["intervention.action.deplacer"] }),
    ).toBeVisible();
    await capturer(page, "fiche-deplacer-generique", largeur);
  });
}

test("la fiche terrain à 375px — l'adresse et son bouton d'itinéraire", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${ordinaireId}`);
  await expect(
    page.getByRole("link", { name: fr["terrain.itineraire"] }),
  ).toBeVisible();
  await capturer(page, "terrain-itineraire", 375);
});
