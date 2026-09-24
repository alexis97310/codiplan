import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * UNE INTERVENTION SE CRÉE DEPUIS UNE DEMANDE, ET GARDE LE LIEN
 * (68-DEMANDES-2, SAV-11).
 *
 * ## Ce que ce fichier prouve, par l'ÉCRAN
 *
 * 1. Depuis la fiche d'une demande, « Créer une intervention depuis cette
 *    demande » mène à `/interventions/nouvelle?demande=<id>` — et l'écran
 *    arrive PRÉREMPLI : lieu, machine, panne et urgence viennent de la
 *    demande, sans ressaisie.
 * 2. Une fois créée, l'intervention porte `demande_id`, et la fiche de la
 *    demande la LISTE — référence et statut, avec un lien vers sa fiche.
 *
 * La confrontation module/base (societe/site) vit dans
 * `tests/isolation/demandes-2.test.ts` et n'est pas reprise ici.
 *
 * `CAPTURES_DEMANDES_2=<dossier>` fait écrire les captures à 1280 px.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_DEMANDES_2 ?? "";

const dictionnaire = fr as Record<string, string>;
const DESCRIPTION_DEM2 = dictionnaire["demandes.e2e.description_dem2"]!;

// Sa propre scène, jamais empruntée au semis partagé (mémoire du poste : « un
// spec qui compte pose SON site »).
const CLIENT_DEM2 = "e2e00000-0000-7000-8000-00000000d2a0";
const SITE_DEM2 = "e2e00000-0000-7000-8000-00000000d2a1";
const FAMILLE_DEM2 = "e2e00000-0000-7000-8000-00000000d2a2";
const MODELE_DEM2 = "e2e00000-0000-7000-8000-00000000d2a3";
const MACHINE_DEM2 = "e2e00000-0000-7000-8000-00000000d2a4";
const DEMANDE_DEM2 = "e2e00000-0000-7000-8000-00000000d2a5";

const RAISON_SOCIALE_DEM2 = "Client de la scène DEMANDES-2 (épreuve)";
const LIBELLE_SITE_DEM2 = "Lieu de la scène DEMANDES-2 (épreuve)";

let interventionCreeeId = "";

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  ecrans: Record<string, Record<string, unknown>>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  ecrans: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { demande_id: DEMANDE_DEM2 },
  });
  await client.demande.deleteMany({ where: { id: DEMANDE_DEM2 } });
  await client.machine.deleteMany({ where: { id: MACHINE_DEM2 } });
  await client.modeleMateriel.deleteMany({ where: { id: MODELE_DEM2 } });
  await client.familleMateriel.deleteMany({ where: { id: FAMILLE_DEM2 } });
  await client.site.deleteMany({ where: { id: SITE_DEM2 } });
  await client.client.deleteMany({ where: { id: CLIENT_DEM2 } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.client.create({
      data: {
        id: CLIENT_DEM2,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_DEM2,
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEM2,
        societe_id: societe.id,
        client_id: CLIENT_DEM2,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_DEM2,
        temps_trajet_min: 10,
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_DEM2,
        societe_id: societe.id,
        code: "DEM2-EPREUVE",
        libelle: "Famille de la scène DEMANDES-2 (épreuve)",
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_DEM2,
        societe_id: societe.id,
        famille_id: FAMILLE_DEM2,
        marque: "Épreuve",
        reference: "DEMANDES-2",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_DEM2,
        societe_id: societe.id,
        modele_id: MODELE_DEM2,
        client_id: CLIENT_DEM2,
        site_id: SITE_DEM2,
        numero_serie: "SN-DEM2-EPREUVE",
        qr_token: "DEM2QRTOKENEPREUVE0000000001",
      },
    });

    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_DEM2,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_DEM2,
        site_id: SITE_DEM2,
        machine_id: MACHINE_DEM2,
        agence_id: agence.id,
        description: DESCRIPTION_DEM2,
        urgence: "p2",
        // QUALIFIÉE DÈS LA CRÉATION — le déclencheur `demande_cycle_de_vie`
        // ne garde que les transitions (`BEFORE UPDATE`), jamais l'état de
        // naissance : « Transformer », donc le lien vers la création d'une
        // intervention, n'existe que depuis ce statut (`peutTransformer`).
        statut: "qualifiee",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("depuis la fiche de la demande, « Créer une intervention » arrive préremplie, et une fois créée la demande la liste", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_DEM2}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByText(dictionnaire["demande.interventions_issues.aucune"]),
  ).toBeVisible();

  mesure.ecrans.fiche_demande_avant = { url: `/demandes/${DEMANDE_DEM2}` };
  await capturer(page, "fiche-demande-avant");

  const lien = page.getByRole("link", {
    name: dictionnaire["demande.transformer.creer_intervention"],
  });
  await expect(lien).toHaveAttribute(
    "href",
    `/interventions/nouvelle?demande=${DEMANDE_DEM2}`,
  );
  await lien.click();
  await expect(page).toHaveURL(
    `/interventions/nouvelle?demande=${DEMANDE_DEM2}`,
  );

  // LE LIEU EST PRÉREMPLI — le sélecteur affiche le site de la demande.
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(`${RAISON_SOCIALE_DEM2} — ${LIBELLE_SITE_DEM2}`);

  // LA MACHINE EST PRÉREMPLIE — chargée de manière asynchrone une fois le
  // site connu (`ChampSiteEtMachines`) : l'assertion attend la valeur.
  await expect(page.locator('select[name="machine_ids"]')).toHaveValue(
    MACHINE_DEM2,
  );

  // LA PANNE ET L'URGENCE SONT PRÉREMPLIES depuis la demande.
  await expect(page.locator('textarea[name="description"]')).toHaveValue(
    DESCRIPTION_DEM2,
  );
  await expect(page.locator('select[name="priorite"]')).toHaveValue("p2");

  await expect(
    page.getByText(dictionnaire["intervention.depuis_demande"]),
  ).toBeVisible();

  mesure.ecrans.formulaire_prerempli = {
    url: `/interventions/nouvelle?demande=${DEMANDE_DEM2}`,
  };
  await capturer(page, "formulaire-prerempli");

  await page
    .getByRole("button", { name: dictionnaire["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  interventionCreeeId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(interventionCreeeId).toMatch(/^[0-9a-f-]{36}$/);

  // LA FICHE DE LA DEMANDE LISTE MAINTENANT CETTE INTERVENTION.
  await page.goto(`/demandes/${DEMANDE_DEM2}`);
  const ligne = page.locator(
    `[data-intervention-issue="${interventionCreeeId}"]`,
  );
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(dictionnaire["statut.a_planifier"]);
  await ligne.getByRole("link").click();
  await expect(page).toHaveURL(`/interventions/${interventionCreeeId}`);

  mesure.ecrans.fiche_demande_apres = { url: `/demandes/${DEMANDE_DEM2}` };
  await page.goto(`/demandes/${DEMANDE_DEM2}`);
  await capturer(page, "fiche-demande-apres");

  // EN BASE : LE LIEN EST BIEN CELUI DE CETTE DEMANDE.
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const intervention = await client.intervention.findUniqueOrThrow({
      where: { id: interventionCreeeId },
      select: { demande_id: true },
    });
    expect(intervention.demande_id).toBe(DEMANDE_DEM2);
  } finally {
    await client.$disconnect();
  }
});
