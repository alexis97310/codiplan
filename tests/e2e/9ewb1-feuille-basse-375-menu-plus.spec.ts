import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { prochainJourOuvert, type Calendrier } from "@/lib/calendar";
import {
  instantAMinutes,
  jourDe,
  jourSuivant,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { Role } from "@/lib/auth/roles";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EWB1-FEUILLE-BASSE-375-MENU-PLUS — LA GÉOMÉTRIE DE CHAQUE DIALOGUE EN
 * FEUILLE BASSE, AU PIXEL, À 375 PX.
 *
 * `fiche-dialogue-focus.spec.ts` capturait déjà le dialogue « Annuler… » à
 * 375 px (capture visuelle, jamais mesurée) — ce fichier mesure la boîte de
 * CHAQUE dialogue en feuille basse atteignable depuis la fiche, le menu « ⋯ »,
 * un `BoutonAvecConfirmation` (`/absences`) et « Transmettre demain »
 * (`/planning`), et vérifie qu'aucun des deux ne déborde de l'écran.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9EWB1-`
 *
 * Un client, un site (agence Ducos), quatre interventions (`a_planifier`,
 * `planifiee`, `en_cours`, `terminee`) pour la fiche ; un technicien et une
 * absence forgés pour `/absences` ; une planifiee prête pour DEMAIN, pour
 * `/planning` — créés en `beforeAll`, supprimés en `afterAll`, aucune ligne
 * ajoutée au semis. Le jour choisi pour la fiche, +238 depuis le lundi de la
 * semaine courante, est à l'écart de tous les décalages déjà pris par les
 * fichiers voisins (7, 14, 70, 71, 77, 84, 91, 92, 140, 147, 168, 210, 224).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_TERMINEE = uuidv7();
const SITE_DEMAIN_ID = uuidv7();
const INTERVENTION_DEMAIN = uuidv7();

const UTILISATEUR_ABSENCE = uuidv7();
const UTILISATEUR_SOCIETE_ABSENCE = uuidv7();
const ABSENCE_ID = uuidv7();
const SOCIETE_CODE = "CODIMA-NC";

function dansNJours(n: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
const JOUR_DU_BLOCAGE = dansNJours(60);
const NOM_PERSONNE = "zz9EWB1-FEUILLE-BASSE — technicien forgé";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(reperes.lundi, 238);
  const dateSurveyee = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EWB1-FEUILLE-BASSE — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EWB1-FEUILLE-BASSE — site forgé",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_A_PLANIFIER,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        type: "curatif",
        statut: "a_planifier",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: dateSurveyee,
        creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 9 * 60, reperes.fuseau),
        duree_estimee_min: 60,
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'en_cours', 60, now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
    );
    await client.intervention.create({
      data: {
        id: INTERVENTION_TERMINEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: dateSurveyee,
        duree_estimee_min: 60,
      },
    });

    // ── /absences — UN BLOCAGE À LEVER (BoutonAvecConfirmation) ───────────
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true },
    });
    await client.utilisateur.create({
      data: {
        id: UTILISATEUR_ABSENCE,
        nom: NOM_PERSONNE,
        email: "zz9ewb1-feuille-basse@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: UTILISATEUR_SOCIETE_ABSENCE,
        utilisateur_id: UTILISATEUR_ABSENCE,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.absence.create({
      data: {
        id: ABSENCE_ID,
        societe_id: societe.id,
        utilisateur_id: UTILISATEUR_ABSENCE,
        du: new Date(`${JOUR_DU_BLOCAGE}T00:00:00.000Z`),
        au: new Date(`${JOUR_DU_BLOCAGE}T00:00:00.000Z`),
      },
    });

    // ── /planning — UNE PLANIFIÉE PRÊTE POUR DEMAIN (Transmettre demain) ──
    // Même oracle que `pg-g14b-transmettre-groupe.spec.ts` : « demain » est
    // calculé par `prochainJourOuvert`, jamais un décalage fixe.
    const aujourdhui = jourDe(maintenant(reperes.fuseau).local);
    const fenetre = {
      du: jourSuivant(aujourdhui),
      au: jourSuivant(aujourdhui, 16),
    };
    const calendrier = await chargerCalendrierAgence(client, {
      societeId: reperes.societeId,
      agenceId: agence.id,
      fenetre,
    });
    const demain = prochainJourOuvert(
      [calendrier].filter((c): c is Calendrier => c !== null),
      fenetre.du,
    );
    const demainDate = new Date(
      Date.UTC(demain.annee, demain.mois - 1, demain.jour),
    );

    await client.site.create({
      data: {
        id: SITE_DEMAIN_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9EWB1-FEUILLE-BASSE — site demain forgé",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_DEMAIN,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_DEMAIN_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: demainDate,
        creneau_debut: instantAMinutes(demain, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(demain, 9 * 60, reperes.fuseau),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EWB1-FEUILLE-BASSE — intervention forgée",
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
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ID,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
    await client.absence.deleteMany({
      where: { utilisateur_id: UTILISATEUR_ABSENCE },
    });
    await client.utilisateurSociete.deleteMany({
      where: { id: UTILISATEUR_SOCIETE_ABSENCE },
    });
    await client.utilisateur.deleteMany({ where: { id: UTILISATEUR_ABSENCE } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EWB1-FEUILLE-BASSE-375-MENU-PLUS/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/**
 * LA GARDE COMMUNE — le `<dialog>` ouvert, et chaque bouton de son pied,
 * restent DANS la largeur de l'écran ; le dialogue occupe (quasiment) toute
 * la largeur utile sous 901 px (I1 : ce test ne vérifie qu'un comportement
 * d'écran, aucune donnée de société).
 */
async function verifierGeometrieDialogue(
  page: Page,
  largeur: number,
): Promise<void> {
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  const boiteDialogue = await dialogue.boundingBox();
  if (boiteDialogue === null) {
    throw new Error("Le dialogue ouvert n'a pas de boîte de dimension.");
  }
  expect(boiteDialogue.x).toBeGreaterThanOrEqual(0);
  expect(boiteDialogue.x + boiteDialogue.width).toBeLessThanOrEqual(largeur);
  if (largeur < 901) {
    expect(boiteDialogue.width).toBeGreaterThanOrEqual(largeur - 5);
  }

  const boutons = dialogue.locator("button");
  const nombreBoutons = await boutons.count();
  for (let i = 0; i < nombreBoutons; i += 1) {
    const boite = await boutons.nth(i).boundingBox();
    if (boite === null) {
      continue;
    }
    expect(boite.x).toBeGreaterThanOrEqual(0);
    expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
  }
}

async function verifierGeometrieMenu(
  page: Page,
  largeur: number,
): Promise<void> {
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const boite = await menu.boundingBox();
  if (boite === null) {
    throw new Error("Le menu ouvert n'a pas de boîte de dimension.");
  }
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
}

async function garderLargeurDePage(page: Page, largeur: number): Promise<void> {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(largeur);
}

for (const largeur of [375, 1280] as const) {
  test(`« Planifier à la main » reste dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);

    await ouvrirSaisieManuelle(page);
    await verifierGeometrieDialogue(page, largeur);
    await page
      .locator("dialog[open]")
      .getByRole("button", {
        name: fr["ui.dialogue.fermer"],
      })
      .click();
    await garderLargeurDePage(page, largeur);
  });

  test(`« Transmettre » reste dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await page
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`« Déplacer » reste dans l'écran (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await ouvrirSaisieManuelle(page);
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`menu « ⋯ » et « Changer de technicien… » restent dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
    await verifierGeometrieMenu(page, largeur);
    await capturer(page, "menu-plus-ouvert", largeur);
    await page
      .getByRole("menuitem", {
        name: fr["intervention.action.changer_technicien"],
      })
      .click();
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`« Annuler… » avec un motif reste dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

    await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
    await page
      .getByRole("menuitem", { name: fr["intervention.action.annuler"] })
      .click();
    const dialogue = page.locator("dialog[open]");
    await dialogue
      .getByLabel(fr["intervention.annulation.motif"])
      .fill("Changement de programme client\nReplanification demandée");
    await verifierGeometrieDialogue(page, largeur);
    await capturer(page, "dialogue-annuler-motif", largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`« Suspendre… » reste dans l'écran (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

    await page
      .getByRole("button", { name: fr["intervention.action.suspendre"] })
      .click();
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`« Clôturer… » reste dans l'écran (${largeur}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto(`/interventions/${INTERVENTION_TERMINEE}`);

    await page
      .getByRole("button", { name: fr["intervention.action.cloturer"] })
      .click();
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });

  test(`un « BoutonAvecConfirmation » (« Lever » un blocage) reste dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/absences");

    await page.getByRole("button", { name: fr["absences.lever"] }).click();
    await verifierGeometrieDialogue(page, largeur);
    await capturer(page, "dialogue-bouton-confirmation", largeur);
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: fr["absences.levee_revenir"] })
      .click();
    await garderLargeurDePage(page, largeur);
  });

  test(`« Transmettre demain » reste dans l'écran (${largeur}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/planning");

    // LE COMPTE N'EST JAMAIS FIGÉ (démonstration comprise) — seul le
    // préfixe du libellé identifie ce bouton, pas `libelleTransmettreDemain(1)`.
    await page
      .getByRole("button", {
        name: new RegExp(`^${fr["planning.transmettre_demain"]} \\(\\d+\\)$`),
      })
      .click();
    await verifierGeometrieDialogue(page, largeur);
    await garderLargeurDePage(page, largeur);
  });
}
