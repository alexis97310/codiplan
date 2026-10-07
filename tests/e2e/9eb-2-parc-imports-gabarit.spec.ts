import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EB-TP-UX3-2-LISTES-2 — LE GABARIT DU 28/09 SUR UNE FIXTURE PROPRE.
 *
 * ## Ce que ce fichier éprouve, et ce qu'il laisse aux autres
 *
 * Les isolations (`tests/isolation/parc-vues-gabarit.test.ts`,
 * `imports-vues-gabarit.test.ts`) prouvent déjà, contre la vraie base, que
 * les quatre vues du parc rendent la bonne population et que l'export
 * partage les mêmes identifiants. Ce fichier-ci prouve ce qu'eux ne
 * peuvent pas : qu'un VRAI navigateur affiche les bons chiffres sur les
 * tuiles et les puces, que cliquer une tuile ouvre une liste de MÊME
 * longueur que son chiffre, et que l'aperçu montre les huit champs.
 *
 * ## La scène — préfixée `GAB9EB2`, créée et supprimée par l'épreuve
 *
 * Même discipline que `parc-tri.spec.ts` : un client, un site, une famille,
 * un modèle, aucune ligne ajoutée au semis. Quatre machines : une EN
 * SERVICE, une EN PANNE avec une intervention OUVERTE, une EN SERVICE dont
 * la garantie finit dans 30 jours, une REMPLACÉE (sortie du parc). Deux
 * lots d'import : un CONTRÔLÉ avec des rejets, un APPLIQUÉ sans rejet.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "GAB9EB2";

let admin: PrismaClient;
let clientId: string;
let siteId: string;
let familleId: string;
let modeleId: string;
let machineServiceId: string;
let machinePanneOuverteId: string;
let machineGarantieId: string;
let machineSortieId: string;
let interventionId: string;
let lotRejetsId: string;
let lotAppliqueId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });
  const utilisateur = await admin.utilisateur.findFirstOrThrow({
    where: { societes: { some: { societe_id: societe.id } } },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: fr["gab9eb2.e2e.client"],
      actif: true,
    },
  });
  clientId = client.id;

  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: fr["gab9eb2.e2e.site"],
    },
  });
  siteId = site.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `${PREFIXE}FAM`,
      libelle: fr["gab9eb2.e2e.famille"],
    },
  });
  familleId = famille.id;

  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: fr["gab9eb2.e2e.marque"],
      reference: fr["gab9eb2.e2e.reference"],
    },
  });
  modeleId = modele.id;

  const MAINTENANT = new Date();
  const JOUR = 24 * 60 * 60 * 1000;

  const machineService = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `${PREFIXE}-QR-SERVICE`,
      numero_serie: `${PREFIXE}-SN-SERVICE`,
      statut: "en_service",
    },
  });
  machineServiceId = machineService.id;

  const machinePanneOuverte = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `${PREFIXE}-QR-PANNE`,
      numero_serie: `${PREFIXE}-SN-PANNE`,
      statut: "en_panne",
    },
  });
  machinePanneOuverteId = machinePanneOuverte.id;

  const machineGarantie = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `${PREFIXE}-QR-GARANTIE`,
      numero_serie: `${PREFIXE}-SN-GARANTIE`,
      statut: "en_service",
      garantie_fin: new Date(MAINTENANT.getTime() + 30 * JOUR),
    },
  });
  machineGarantieId = machineGarantie.id;

  const machineSortie = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `${PREFIXE}-QR-SORTIE`,
      numero_serie: `${PREFIXE}-SN-SORTIE`,
      statut: "remplacee",
    },
  });
  machineSortieId = machineSortie.id;

  const intervention = await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      type: "curatif",
    },
  });
  interventionId = intervention.id;
  await admin.interventionMachine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      intervention_id: interventionId,
      machine_id: machinePanneOuverteId,
    },
  });

  const lotRejets = await admin.importLot.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      type_import: "clients",
      version_modele: 1,
      utilisateur_id: utilisateur.id,
      nom_fichier: `${PREFIXE}-controle-rejets.xlsx`,
      statut: "controle",
      lignes_rejets: 1,
    },
  });
  lotRejetsId = lotRejets.id;

  const lotApplique = await admin.importLot.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      type_import: "clients",
      version_modele: 1,
      utilisateur_id: utilisateur.id,
      nom_fichier: `${PREFIXE}-applique.xlsx`,
      statut: "applique",
      applique_le: new Date(),
      lignes_rejets: 0,
    },
  });
  lotAppliqueId = lotApplique.id;
});

test.afterAll(async () => {
  try {
    await admin.importLot.deleteMany({
      where: { id: { in: [lotRejetsId, lotAppliqueId] } },
    });
    await admin.interventionMachine.deleteMany({
      where: { intervention_id: interventionId },
    });
    await admin.intervention.delete({ where: { id: interventionId } });
    await admin.machine.deleteMany({
      where: {
        id: {
          in: [
            machineServiceId,
            machinePanneOuverteId,
            machineGarantieId,
            machineSortieId,
          ],
        },
      },
    });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.delete({ where: { id: siteId } });
    await admin.client.delete({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Le lien de la tuile elle-même — son premier enfant direct. */
function lienDeLaTuile(tuile: ReturnType<Page["locator"]>) {
  return tuile.locator("> a").first();
}

/** Le premier nombre isolé sur sa propre ligne, dans un texte rendu multi-lignes. */
function premierNombreIsole(texte: string): number | null {
  const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
  return correspondance === null ? null : Number(correspondance[1]);
}

test("chaque tuile du parc — son chiffre == le nombre de lignes que son lien ouvre, dans le périmètre du client de l'épreuve", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/parc?client=${clientId}`);
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  for (const bloc of ["kpi-affichees", "kpi-en-panne", "kpi-garantie"]) {
    const tuile = page.locator(`[data-bloc="${bloc}"]`);
    await expect(tuile).toBeVisible();
    const lien = lienDeLaTuile(tuile);
    const valeur = premierNombreIsole(await tuile.innerText());
    expect(valeur).not.toBeNull();

    const href = await lien.getAttribute("href");
    expect(href).not.toBeNull();
    await page.goto(href!);
    await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();
    const lignes = page.locator('[data-bloc="liste-machines"] a');
    await expect(lignes).toHaveCount(valeur!);

    // Revenir à la page de départ pour la tuile suivante.
    await page.goto(`/parc?client=${clientId}`);
  }
});

test("les quatre puces de vue — compteur == lignes de la liste qu'elles ouvrent, et « Sorties du parc » isole la machine remplacée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/parc?client=${clientId}`);
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  // SCOPÉ AU BANDEAU DE PUCES (aria-label dédié) — le lien « Exporter » de
  // l'en-tête porte LUI AUSSI `vue=` et `client=` dans son adresse
  // (hrefExportParc recopie tous les critères actifs) et matchait sinon le
  // même sélecteur, sans jamais porter de `[data-n]`.
  const puces = page
    .locator(`[aria-label="${fr["parc.filtre_vue_libelle"]}"]`)
    .locator(`a[href*="vue="][href*="client=${clientId}"]`);
  const nombreDePuces = await puces.count();
  expect(nombreDePuces).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < nombreDePuces; i += 1) {
    const puce = puces.nth(i);
    const compteur = Number(
      (await puce.locator("[data-n]").getAttribute("data-n")) ?? "-1",
    );
    const href = await puce.getAttribute("href");
    expect(href).not.toBeNull();
    await page.goto(href!);
    const lignes = page.locator('[data-bloc="liste-machines"] a');
    if (compteur === 0) {
      await expect(page.locator('[data-bloc="etat-vide"]')).toBeVisible();
    } else {
      await expect(lignes).toHaveCount(compteur);
    }
  }

  await page.goto(`/parc?client=${clientId}&vue=sorties`);
  const lignesSorties = page.locator('[data-bloc="liste-machines"] a');
  await expect(lignesSorties).toHaveCount(1);
  await expect(lignesSorties.first()).toHaveAttribute(
    "href",
    new RegExp(machineSortieId),
  );
});

test("l'aperçu d'une machine montre les huit champs du gabarit, et « Dernières interventions » mène à la fiche", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    `/parc?client=${clientId}&vue=panne&machine=${machinePanneOuverteId}`,
  );
  await expect(page.locator('[data-bloc="apercu-hero"]')).toBeVisible();

  const kv = page.locator('[data-bloc="apercu-kv"] dt');
  await expect(kv).toHaveCount(8);

  const evenements = page.locator('[data-bloc="apercu-timeline"] > a');
  await expect(evenements.first()).toHaveAttribute(
    "href",
    new RegExp(`/interventions/${interventionId}`),
  );
});

test("imports — les trois puces comptent exactement ce que le tableau montre pour leur vue", async ({
  page,
}) => {
  await page.goto("/imports");
  await expect(page.locator('[data-bloc="puces-imports"]')).toBeVisible();

  await page.goto("/imports?vue=rejets");
  const lignesRejets = page.locator(`tr[data-lot="${lotRejetsId}"]`);
  await expect(lignesRejets).toHaveCount(1);
  await expect(page.locator(`tr[data-lot="${lotAppliqueId}"]`)).toHaveCount(0);

  await page.goto("/imports?vue=a-appliquer");
  await expect(page.locator(`tr[data-lot="${lotRejetsId}"]`)).toHaveCount(1);
  await expect(page.locator(`tr[data-lot="${lotAppliqueId}"]`)).toHaveCount(0);
});
