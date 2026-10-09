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
 * (68-DEMANDES-2, SAV-11 ; au gabarit du 28/09 depuis QE-9, D176,
 * 9ED-TP-UX3-D2-DEMANDES).
 *
 * ## Ce que ce fichier prouve, par l'ÉCRAN
 *
 * 1. Le bloc « Transformer en intervention » de la fiche demande arrive
 *    PRÉREMPLI : lieu (champs cachés), machine, panne et urgence viennent de
 *    la demande, sans ressaisie, sans passer par `/interventions/nouvelle`
 *    (D176 : le lien primaire est devenu ce formulaire EN LIGNE).
 * 2. Une fois créée, l'intervention porte `demande_id`, la demande passe
 *    « Transformée » dans le MÊME geste (décision 14 d'Alexis du 05/10/2026),
 *    et la fiche de la demande LISTE cette intervention — référence et
 *    statut, avec un lien vers sa fiche.
 *
 * La confrontation module/base (societe/site, décision 14, capacité) vit dans
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

test("le bloc « Transformer en intervention » de la fiche arrive préremplie, et une fois créée la demande transformée liste l'intervention", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_DEM2}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByText(dictionnaire["demande.interventions_issues.aucune"]),
  ).toBeVisible();
  // LE TITRE EST LE COUPLE « <client> · <site> » (QE-9, D176) — déjà éprouvé
  // à l'écran par `demande-titre.spec.ts`, pas repris ici (sans-chaine-
  // visible-en-dur refuse une requête d'écran composée de constantes de
  // scène littérales, même scopées à cette fiche).

  mesure.ecrans.fiche_demande_avant = { url: `/demandes/${DEMANDE_DEM2}` };
  await capturer(page, "fiche-demande-avant");

  // AUCUN LIEN VERS /interventions/nouvelle (D176) : le formulaire est EN
  // LIGNE, directement dans le bloc « Transformer en intervention ».
  await expect(
    page.getByRole("link", {
      name: dictionnaire["demande.transformer.creer_intervention"],
    }),
  ).toHaveCount(0);

  const forme = page.locator('form[action="/api/interventions/creer"]');
  await expect(forme).toBeVisible();

  // LE LIEU EST PRÉREMPLI, EN CHAMP CACHÉ — plus de sélecteur sur cette
  // fiche : le site est déjà celui de la demande (D176).
  await expect(forme.locator('input[name="demande_id"]')).toHaveValue(
    DEMANDE_DEM2,
  );
  await expect(forme.locator('input[name="site"]')).toHaveValue(
    `${CLIENT_DEM2}:${SITE_DEM2}`,
  );

  // LA MACHINE EST PRÉREMPLIE.
  await expect(forme.locator('select[name="machine_ids"]')).toHaveValue(
    MACHINE_DEM2,
  );

  // LA PANNE EST PRÉREMPLIE depuis la demande.
  await expect(forme.locator('textarea[name="description"]')).toHaveValue(
    DESCRIPTION_DEM2,
  );

  // L'URGENCE DE LA DEMANDE PRÉSÉLECTIONNE LA PRIORITÉ — un bouton radio
  // (`components/ui/choix.tsx`), jamais un `<select>`, sur cet écran.
  await expect(
    forme.locator('input[name="priorite"][value="p2"]'),
  ).toBeChecked();

  mesure.ecrans.formulaire_prerempli = { url: `/demandes/${DEMANDE_DEM2}` };
  await capturer(page, "formulaire-prerempli");

  // LA NATURE N'EST PAS PRÉREMPLIE DEPUIS LA DEMANDE (99P-GR1-NATURE, D'après
  // l'audit du 26/09) — une demande ne porte pas de nature d'intervention, et
  // le `<select>` ouvre sur une option vide plutôt que la première de la
  // liste. La choisir explicitement fait partie de la MISE EN SCÈNE,
  // l'assertion de préremplissage ci-dessus (lieu, machine, panne, urgence)
  // ne change pas.
  await forme.locator('select[name="type"]').selectOption("curatif");

  // LE BOUTON PORTE DÉSORMAIS « Créer l'intervention » (D188, partie 4) —
  // toujours DANS ce même formulaire de création.
  await forme
    .getByRole("button", {
      name: dictionnaire["demandes.fiche.creer_intervention"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  interventionCreeeId = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(interventionCreeeId).toMatch(/^[0-9a-f-]{36}$/);

  // LA FICHE DE LA DEMANDE LISTE MAINTENANT CETTE INTERVENTION, ET LA
  // DEMANDE EST DEVENUE « TRANSFORMÉE » (décision 14 d'Alexis du 05/10/2026 ;
  // D176) — SANS avoir cliqué « Marquer comme transformée ».
  await page.goto(`/demandes/${DEMANDE_DEM2}`);
  await expect(
    page.getByText(dictionnaire["demande.statut.transformee"], {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('[data-bloc="demande-actions"] form')).toHaveCount(
    0,
  );
  const ligne = page.locator(
    `[data-intervention-issue="${interventionCreeeId}"]`,
  );
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(dictionnaire["statut.a_planifier"]);
  await ligne.getByRole("link").click();
  await expect(page).toHaveURL(
    `/interventions/${interventionCreeeId}?depuis=demande&depuis_id=${DEMANDE_DEM2}`,
  );

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
