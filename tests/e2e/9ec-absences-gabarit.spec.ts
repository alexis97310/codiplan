import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  jourDe,
  jourSuivant,
  maintenant,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9EC-TP-UX3-E-ABSENCES (D175) — la page Absences au gabarit de la maquette
 * du 28/09, déclaration en volet : le bouton d'en-tête ouvre le volet, « Voir
 * l'impact » nomme ce qu'il déplanifie, et après « Déclarer l'absence » la
 * MÊME référence se retrouve dans la carte permanente « Interventions
 * rendues à la file à planifier » ET dans la colonne « Rendues à la
 * planification » de la ligne du tableau — deux lectures du même fait,
 * jamais deux calculs.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EC-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ, un client et un site à soi, UNE intervention
 * planifiée sur une date À L'INTÉRIEUR de la période déclarée via le volet
 * — la période elle-même couvre AUJOURD'HUI (à Nouméa), pour que « Absents
 * aujourd'hui » et l'onglet « Aujourd'hui » se lisent sur le MÊME fait.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const FUSEAU_NOUMEA: Fuseau = "Pacific/Noumea";

let utilisateur9ec = "";
let utilisateurSociete9ec = "";
let technicien9ec = "";
let client9ec = "";
let site9ec = "";
let intervention9ec = "";

/** `AAAA-MM-JJ`, jour civil À NOUMÉA, à N jours d'aujourd'hui (même garde que 9DK). */
function dansNJours(n: number): string {
  return cleJour(jourSuivant(jourDe(maintenant(FUSEAU_NOUMEA).local), n));
}

const DU = dansNJours(-1);
const AU = dansNJours(5);
const JOUR_INTERVENTION = dansNJours(2);

/** La référence affichée, LUE depuis la même fonction que l'écran (I10). */
function reference(id: string): string {
  return referenceAffichee({ id, numero: null });
}

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateur9ec === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateur9ec },
    });
    await client.intervention.deleteMany({
      where: { id: intervention9ec },
    });
    await client.site.deleteMany({ where: { id: site9ec } });
    await client.client.deleteMany({ where: { id: client9ec } });
    await client.technicien.deleteMany({ where: { id: technicien9ec } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSociete9ec },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateur9ec } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateur9ec = uuidv7();
  utilisateurSociete9ec = uuidv7();
  technicien9ec = uuidv7();
  client9ec = uuidv7();
  site9ec = uuidv7();
  intervention9ec = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.utilisateur.create({
      data: {
        id: utilisateur9ec,
        nom: "Technicien 9EC- (épreuve 9EC-TP-UX3-E-ABSENCES)",
        email: "9ec-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSociete9ec,
        utilisateur_id: utilisateur9ec,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicien9ec,
        societe_id: societe.id,
        utilisateur_id: utilisateur9ec,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: client9ec,
        societe_id: societe.id,
        raison_sociale: "Client 9EC- (épreuve 9EC-TP-UX3-E-ABSENCES)",
      },
    });
    await client.site.create({
      data: {
        id: site9ec,
        societe_id: societe.id,
        client_id: client9ec,
        agence_id: agence.id,
        libelle: "Lieu 9EC- (épreuve 9EC-TP-UX3-E-ABSENCES)",
        temps_trajet_min: 10,
      },
    });
    await client.intervention.create({
      data: {
        id: intervention9ec,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: client9ec,
        site_id: site9ec,
        technicien_id: utilisateur9ec,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        date_planifiee: new Date(`${JOUR_INTERVENTION}T00:00:00.000Z`),
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EC-TP-UX3-E-ABSENCES/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test("le bouton d'en-tête ouvre le volet, à 440 px sur bureau, pleine largeur au téléphone", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/absences");
  await capturer(page, "absences-avant", 1280);
  await page
    .getByRole("link", { name: fr["absences.declarer_entete"] })
    .click();
  await expect(page).toHaveURL(/\?declarer=1/);
  const volet = page.getByRole("dialog");
  await expect(volet).toBeVisible();
  const boite = await volet.boundingBox();
  expect(boite?.width).toBeGreaterThan(400);
  expect(boite?.width).toBeLessThan(480);
  await capturer(page, "absences-volet-vide", 1280);

  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/absences?declarer=1");
  const voletTelephone = page.getByRole("dialog");
  const boiteTelephone = await voletTelephone.boundingBox();
  expect(boiteTelephone?.width).toBeGreaterThan(350);
  await capturer(page, "absences-volet-vide", 375);
});

test("« Voir l'impact » nomme l'intervention, et après déclaration la même référence apparaît dans la carte et la colonne", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/absences?declarer=1");
  await page.locator("#absence-personne").selectOption(utilisateur9ec);
  await page.locator("#absence-du").fill(DU);
  await page.locator("#absence-au").fill(AU);
  await page
    .getByRole("button", { name: fr["absences.apercu_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  const panneauImpact = page.getByRole("status");
  await expect(panneauImpact).toContainText(reference(intervention9ec));
  await capturer(page, "absences-volet-impact", 1280);

  await panneauImpact
    .getByRole("button", { name: fr["absences.declarer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  // LA CARTE PERMANENTE (D175) — distincte du bandeau éphémère de la pose,
  // jamais `role="status"` (absences-2 le garde déjà sur le bandeau).
  const carteRendues = page
    .locator("section")
    .filter({ hasText: fr["absences.rendues_titre"] })
    .first();
  await expect(carteRendues).toContainText(reference(intervention9ec));

  // LA MÊME RÉFÉRENCE, DANS LA COLONNE DE LA LIGNE DU TABLEAU — l'absence
  // couvre aujourd'hui, donc sur l'onglet par défaut.
  const ligne = page
    .locator("tr")
    .filter({ hasText: reference(intervention9ec) });
  await expect(ligne).toHaveCount(1);
  await capturer(page, "absences-apres", 1280);
  await capturer(page, "absences-apres", 375);
});

test("chaque compteur d'onglet égale les lignes de l'onglet ouvert, et « Absents aujourd'hui » lit le même rendu", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/absences?vue=aujourdhui");

  // SCOPÉ À LA NAVIGATION DES ONGLETS (`Onglets`, `aria-label` = le titre de
  // la page) — la navigation du calendrier porte aussi un lien « Aujourd'hui »,
  // qui matcherait sinon le même nom accessible (`calendrier-nav`).
  const ongletAujourdhui = page
    .getByRole("navigation", { name: fr["absences.titre"] })
    .getByRole("link", { name: new RegExp(fr["absences.onglet_aujourdhui"]) });
  const texteOnglet = await ongletAujourdhui.innerText();
  const compteOnglet = Number(texteOnglet.replace(/\D/g, ""));
  expect(compteOnglet).toBeGreaterThan(0);

  const lignes = page
    .locator("tr")
    .filter({ hasText: fr["absences.etat_en_cours"] });
  await expect(lignes).toHaveCount(compteOnglet);

  const tuile = page.locator('[data-bloc="kpi-demandes-valider"]');
  const texteTuile = await tuile.innerText();
  const compteTuile = Number(texteTuile.match(/\d+/)?.[0] ?? "-1");
  expect(compteTuile).toBe(compteOnglet);
});

test("capture — la page par défaut, puis l'onglet « Terminées »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  for (const largeur of [1280, 375] as const) {
    await page.goto("/absences");
    await capturer(page, "absences-defaut", largeur);
    await page.goto("/absences?vue=terminees");
    await capturer(page, "absences-terminees", largeur);
  }
});

test("capture — la vue du compte technicien, limitée à sa propre déclaration (TR-5)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  for (const largeur of [1280, 375] as const) {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await page.goto("/absences?declarer=1");
    await capturer(page, "absences-vue-technicien", largeur);
  }
});
