import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { lireClasseur } from "@/lib/excel/classeur";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9DS-TP-MOD1-EXPORTER (MO-9, D169) — LE BOUTON « EXPORTER », DE BOUT EN
 * BOUT, SUR LES TROIS ÉCRANS.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `EXPORT9DS-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — jamais une ligne du semis
 * ni de `SCENE.*` (piège connu du lot). Un seul client, un seul site, une
 * seule intervention, une seule machine : chaque export n'a qu'UNE ligne à
 * rendre, ce qui suffit à prouver les en-têtes ET le contenu, sans jamais
 * compter la base partagée entière.
 */

test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT = uuidv7();
const SITE = uuidv7();
const INTERVENTION = uuidv7();
const FAMILLE = uuidv7();
const MODELE = uuidv7();
const MACHINE = uuidv7();

const NUMERO_SERIE = fr["export9ds.e2e.numero_serie"];
const PREFIXE_RECHERCHE = "EXPORT9DS";

test.beforeAll(async () => {
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { code: "DUCOS" },
      select: { id: true, societe_id: true },
    });
    const societeId = agence.societe_id;

    await client.client.create({
      data: {
        id: CLIENT,
        societe_id: societeId,
        raison_sociale: fr["export9ds.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE,
        societe_id: societeId,
        client_id: CLIENT,
        agence_id: agence.id,
        libelle: fr["export9ds.e2e.lieu"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION,
        societe_id: societeId,
        client_id: CLIENT,
        site_id: SITE,
        agence_id: agence.id,
        type: "recensement",
        statut: "a_planifier",
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societeId,
        code: "EXPORT9DS-FAM",
        libelle: fr["export9ds.e2e.famille"],
        assujettissement_vgp: "soumis",
        vgp_periodicite_mois: 12,
        vgp_reference_texte: "Texte d'épreuve EXPORT9DS",
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societeId,
        famille_id: FAMILLE,
        marque: fr["export9ds.e2e.marque"],
        reference: fr["export9ds.e2e.reference"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT,
        site_id: SITE,
        numero_serie: NUMERO_SERIE,
        qr_token: engendrerJetonQr(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.machine.deleteMany({ where: { id: MACHINE } });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
    await client.intervention.deleteMany({ where: { id: INTERVENTION } });
    await client.site.deleteMany({ where: { id: SITE } });
    await client.client.deleteMany({ where: { id: CLIENT } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("« Exporter » sur /interventions télécharge un .xlsx aux mêmes colonnes que l'écran, sur le filtre courant (MO-9)", async ({
  page,
}) => {
  await page.goto(`/interventions?q=${PREFIXE_RECHERCHE}`);
  // `.first()` (TP-UX3-1-REGISTRE-2) — la cellule « Client · Site » compose
  // désormais le client ET le site dans un même conteneur : le texte du
  // client y apparaît deux fois pour une recherche par sous-chaîne (la
  // feuille interne, puis son enveloppe), jamais deux CLIENTS distincts.
  await expect(
    page.getByText(fr["export9ds.e2e.client"]).first(),
  ).toBeVisible();

  const lien = page.getByRole("link", { name: fr["export.bouton"] });
  await expect(lien).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    lien.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^interventions-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );

  const chemin = await download.path();
  if (chemin === null) {
    throw new Error("Le fichier téléchargé n'a pas de chemin local.");
  }
  const feuilles = await lireClasseur(readFileSync(chemin));
  const lignes = feuilles[0]?.lignes ?? [];
  expect(lignes[0]?.map((c) => c?.texte)).toEqual([
    fr["intervention.reference"],
    fr["intervention.client"],
    fr["intervention.machine"],
    fr["vocabulaire.site"],
    fr["intervention.technicien"],
    fr["intervention.date"],
    fr["intervention.priorite"],
    fr["intervention.statut"],
  ]);
  const ligneEpreuve = lignes.find(
    (l) => l[1]?.texte === fr["export9ds.e2e.client"],
  );
  expect(
    ligneEpreuve,
    "la ligne de l'épreuve n'est pas dans l'export",
  ).toBeDefined();
  expect(ligneEpreuve?.[3]?.texte).toBe(fr["export9ds.e2e.lieu"]);
});

test("« Exporter » sur /parc télécharge un .xlsx aux mêmes colonnes que l'écran, sur le filtre courant (MO-9)", async ({
  page,
}) => {
  await page.goto(`/parc?q=${PREFIXE_RECHERCHE}`);
  await expect(page.getByText(NUMERO_SERIE).first()).toBeVisible();

  const lien = page.getByRole("link", { name: fr["export.bouton"] });
  await expect(lien).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    lien.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^parc-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );

  const chemin = await download.path();
  if (chemin === null) {
    throw new Error("Le fichier téléchargé n'a pas de chemin local.");
  }
  const feuilles = await lireClasseur(readFileSync(chemin));
  const lignes = feuilles[0]?.lignes ?? [];
  expect(lignes[0]?.map((c) => c?.texte)).toEqual([
    fr["parc.export_colonne_reference"],
    fr["parc.kv_client"],
    fr["vocabulaire.site"],
    fr["vocabulaire.agence"],
    fr["parc.kv_famille"],
    fr["parc.export_colonne_marque"],
    fr["parc.export_colonne_reference_modele"],
    fr["parc.kv_serie"],
    fr["parc.export_colonne_annee_vente"],
    fr["parc.export_colonne_statut"],
  ]);
  const ligneEpreuve = lignes.find((l) => l[7]?.texte === NUMERO_SERIE);
  expect(
    ligneEpreuve,
    "la ligne de l'épreuve n'est pas dans l'export",
  ).toBeDefined();
  expect(ligneEpreuve?.[1]?.texte).toBe(fr["export9ds.e2e.client"]);
});

test("« Exporter » sur /vgp télécharge un .xlsx aux mêmes colonnes que l'écran, sur le filtre courant (MO-9)", async ({
  page,
}) => {
  await page.goto(`/vgp?q=${PREFIXE_RECHERCHE}`);
  await expect(page.getByText(NUMERO_SERIE).first()).toBeVisible();

  const lien = page.getByRole("link", { name: fr["export.bouton"] });
  await expect(lien).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    lien.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^vgp-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const chemin = await download.path();
  if (chemin === null) {
    throw new Error("Le fichier téléchargé n'a pas de chemin local.");
  }
  const feuilles = await lireClasseur(readFileSync(chemin));
  const lignes = feuilles[0]?.lignes ?? [];
  expect(lignes[0]?.map((c) => c?.texte)).toEqual([
    fr["vgp.colonne_machine"],
    fr["vgp.colonne_client"],
    fr["vgp.colonne_dernier_controle"],
    fr["vgp.colonne_echeance"],
    fr["vgp.colonne_etat"],
  ]);
  const ligneEpreuve = lignes.find((l) =>
    (l[0]?.texte ?? "").includes(NUMERO_SERIE),
  );
  expect(
    ligneEpreuve,
    "la ligne de l'épreuve n'est pas dans l'export",
  ).toBeDefined();
  expect(ligneEpreuve?.[1]?.texte).toBe(
    `${fr["export9ds.e2e.client"]} · ${fr["export9ds.e2e.lieu"]}`,
  );
});
