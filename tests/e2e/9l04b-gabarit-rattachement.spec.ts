import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L04B-GABARIT-RATTACHEMENT, DE BOUT EN BOUT.
 *
 * Ce que les épreuves unitaires et d'isolation ne peuvent pas prouver : que
 * l'ÉCRAN « Partir d'un gabarit de départ » porte réellement le même
 * rattachement que la création directe, qu'il se relit dans le tableau
 * (`rattachementLisible`), et que la CASCADE (`resoudreGabarit`) choisit
 * bien ce modèle pour une machine du sous-type choisi — jamais devinée du
 * texte de suggestion.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9L04B` : famille, sous-type, modèle de
 * matériel, client, site et machine jetables, posés en `beforeAll`, effacés
 * en `afterAll`. Le modèle de checklist, lui, naît PAR le test (volet
 * gabarit) et est effacé par son code — même patron que 9K30A.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER = join(
  process.cwd(),
  "docs/propositions/9L04B-GABARIT-RATTACHEMENT/captures",
);

/** EN VIEWPORT, jamais `fullPage` — la capture montre ce qui se voit sans défiler. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`) });
}

const FAMILLE_ID = uuidv7();
const SOUS_TYPE_ID = uuidv7();
const MODELE_MATERIEL_ID = uuidv7();
const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const MACHINE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const INTERVENTION_MACHINE_ID = uuidv7();

const LIBELLE_SOUS_TYPE = "9L04B-Pont 2 colonnes électromécanique";
const CODE_MODELE = "9L04B-GABARIT-ST";
const LIBELLE_MODELE = "9L04B — Entretien, rattaché au sous-type";

let societeId = "";

test.beforeAll(async () => {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    societeId = reperes.societeId;
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.familleMateriel.create({
      data: {
        id: FAMILLE_ID,
        societe_id: societeId,
        code: "9L04BFAM",
        libelle: "9L04B-Famille",
      },
    });
    await client.sousTypeMateriel.create({
      data: {
        id: SOUS_TYPE_ID,
        societe_id: societeId,
        famille_id: FAMILLE_ID,
        code: "9L04BST",
        libelle: LIBELLE_SOUS_TYPE,
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_MATERIEL_ID,
        societe_id: societeId,
        famille_id: FAMILLE_ID,
        sous_type_id: SOUS_TYPE_ID,
        marque: "9L04B",
        reference: "MOD-ST",
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "9L04B client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9L04B site",
        adresse: { rue: "1 rue de l'épreuve" },
        commune: "Nouméa",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: societeId,
        modele_id: MODELE_MATERIEL_ID,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: "9L04B-SN",
        qr_token: uuidv7(),
      },
    });

    const reperesJour = await reperesDeLaScene();
    const jour = `${String(reperesJour.lundi.annee).padStart(4, "0")}-${String(
      reperesJour.lundi.mois,
    ).padStart(2, "0")}-${String(reperesJour.lundi.jour).padStart(2, "0")}`;
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9L04B-cascade-sous-type",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_ID,
        societe_id: societeId,
        intervention_id: INTERVENTION_ID,
        machine_id: MACHINE_ID,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    const modele = await client.checklistModele.findFirst({
      where: { code: CODE_MODELE },
      select: { id: true },
    });
    if (modele !== null) {
      await client.checklistModeleTypeIntervention.deleteMany({
        where: { checklist_modele_id: modele.id },
      });
      await client.checklistVersion.deleteMany({
        where: { checklist_modele_id: modele.id },
      });
      await client.checklistModele.deleteMany({ where: { id: modele.id } });
    }
    await client.interventionMachine.deleteMany({
      where: { id: INTERVENTION_MACHINE_ID },
    });
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.machine.deleteMany({ where: { id: MACHINE_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
    await client.modeleMateriel.deleteMany({
      where: { id: MODELE_MATERIEL_ID },
    });
    await client.sousTypeMateriel.deleteMany({ where: { id: SOUS_TYPE_ID } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_ID } });
  } finally {
    await client.$disconnect();
  }
});

async function connexionAdmin(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
}

test("« Partir d'un gabarit de départ » rattaché au sous-type — relu dans le tableau, exactement comme la création directe", async ({
  page,
}) => {
  await connexionAdmin(page);
  await page.goto("/parametres/checklists?volet=gabarit");

  const volet = page.getByRole("dialog");
  await volet
    .getByLabel(fr["checklist.parametrage.gabarit"])
    .selectOption({
      label:
        "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
    });
  await volet
    .getByLabel(fr["checklist.parametrage.sous_type"])
    .selectOption({ label: LIBELLE_SOUS_TYPE });
  await volet.getByLabel(fr["checklist.parametrage.code"]).fill(CODE_MODELE);
  await volet
    .getByLabel(fr["checklist.parametrage.libelle"])
    .fill(LIBELLE_MODELE);
  await volet
    .getByRole("button", {
      name: fr["checklist.parametrage.partir_gabarit_action"],
    })
    .click();

  await expect(page).toHaveURL(/\/parametres\/checklists$/);
  const ligne = page
    .locator("table")
    .first()
    .locator("tr", { hasText: CODE_MODELE });
  await expect(ligne).toHaveCount(1);
  await expect(ligne.filter({ hasText: LIBELLE_SOUS_TYPE })).toHaveCount(1);
});

test("la cascade résout ce modèle pour une machine du sous-type — le technicien le voit sur sa fiche terrain", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${INTERVENTION_ID}`);

  await expect(
    page.getByRole("heading", {
      name: `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.deux_points"]}${LIBELLE_MODELE}`,
    }),
  ).toBeVisible();
});

test("captures — le volet « gabarit de départ », rattaché à un sous-type, à 1280 et 375 px", async ({
  page,
}) => {
  await connexionAdmin(page);

  async function ouvrirEtRattacher(): Promise<void> {
    await page.goto("/parametres/checklists?volet=gabarit");
    const volet = page.getByRole("dialog");
    await volet
      .getByLabel(fr["checklist.parametrage.gabarit"])
      .selectOption({
        label:
          "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
      });
    await volet
      .getByLabel(fr["checklist.parametrage.sous_type"])
      .selectOption({ label: LIBELLE_SOUS_TYPE });
  }

  await page.setViewportSize({ width: 1280, height: 1200 });
  await ouvrirEtRattacher();
  await capturer(page, "volet-gabarit-rattachement-apres-1280");

  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirEtRattacher();
  await capturer(page, "volet-gabarit-rattachement-apres-375");
});
