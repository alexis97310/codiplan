import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, jourDeLaScene, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * D123 D'ALEXIS (19/10/2026, Projet ; revue du pilote sur 04465603, 22/10
 * 02:10) — LE GLISSER-DÉPOSER ET LA FENÊTRE DE POSE N'APPRENAIENT PAS À
 * CONFIRMER UNE DATE PASSÉE.
 *
 * `tests/e2e/9f5b-date-passee.spec.ts` éprouve déjà la confirmation par les
 * FORMULAIRES de la fiche (`DialoguePlanifier`, `DialogueDeplacer`) — jamais
 * le glisser-déposer ni la fenêtre de pose du planning, qui postaient un
 * refus confirmable `date_passee` sans jamais proposer la case qui le lève
 * (`components/planning/pose.tsx`, `components/planning/fenetre-pose.tsx`).
 *
 * **SA PROPRE SCÈNE, PAR SCÉNARIO** (même raison que `glisser-deposer.spec.ts`
 * et `planning-fenetre-pose.spec.ts`, 99XA-STAB-GLISSER) : chaque test forge
 * SON intervention (et, pour le second, SON client et SON site), au préfixe
 * `9F5C-`, retirés en fin de test — jamais une fixture partagée.
 *
 * **UN JOUR PASSÉ, RELATIF À AUJOURD'HUI, JAMAIS UNE DATE FIXE** — `reperes.
 * lundi` (`reperesDeLaScene`) vaut toujours AUJOURD'HUI OU UN JOUR FUTUR
 * (`lundiSansJourPasse`, `setup/scene.ts`), au plus `aujourdhui + 6` : sept
 * jours plus tôt (`JOUR_PASSE`) tombe donc TOUJOURS strictement avant
 * aujourd'hui, quelle que soit la date d'exécution — et reste un LUNDI,
 * jour ouvert des deux agences, pour qu'aucun refus `hors_ouverture` ne se
 * mélange au seul motif éprouvé ici.
 */

test.describe.configure({ mode: "serial" });

let reperes: ReperesDeScene;

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const JOUR_PASSE = -7;

function dialogueConfirmationDatePassee(page: Page) {
  return page.locator("[data-confirmation-date-passee]");
}

function caseDHeure(page: Page, technicienId: string, minutes: number) {
  return page.locator(
    `[data-depot-heure="${minutes}"][data-depot-technicien="${technicienId}"]`,
  );
}

async function allerAuPlanningJour(page: Page, rang: number): Promise<void> {
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, rang))}`,
  );
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F5C-DATE-PASSEE-PLANNING/captures",
);

/** Capture EN VIEWPORT (jamais `fullPage`) — point 6 du lot. */
async function capturer(
  page: Page,
  nom: string,
  largeur: 375 | 1280,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

/* ── 1. LE GLISSER-DÉPOSER, SUR UN JOUR DÉJÀ PASSÉ ───────────────────────── */

async function poserInterventionPassee(): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    const jour = jourDeLaScene(reperes, JOUR_PASSE);
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(
          Date.UTC(jour.annee, jour.mois - 1, jour.jour),
        ),
        creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
        creneau_fin: instantAMinutes(jour, 10 * 60, reperes.fuseau),
        duree_estimee_min: 120,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F5C — glisser-déposer sur un jour déjà passé",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("glisser une intervention sur un jour déjà passé propose de confirmer ; Annuler ne pose rien, Confirmer aboutit (D123)", async ({
  page,
}) => {
  const id = await poserInterventionPassee();
  try {
    await allerAuPlanningJour(page, JOUR_PASSE);

    const origine = caseDHeure(page, reperes.technicienDucos, 8 * 60);
    const cible = caseDHeure(page, reperes.technicienDucos, 13 * 60);
    const source = page.locator(`[data-bloc="${id}"]`);
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    await glisser(page, source, cible);

    // LA QUESTION APPARAÎT — avant toute écriture (PG-B5) : la minuterie
    // « Annuler » n'a pas encore démarré.
    const dialogue = dialogueConfirmationDatePassee(page);
    await expect(dialogue).toBeVisible();
    await expect(dialogue).toContainText(
      fr["intervention.avertissement.date_passee"],
    );
    await capturer(page, "9f5c-glisser-deposer-dialogue", 375);
    // LA CAPTURE CHANGE LA TAILLE DE LA FENÊTRE — restaurée avant de
    // continuer : sous 901 px, la grille du planning laisse place à une
    // mise en page qui ne porte plus les mêmes cases de dépôt.
    await page.setViewportSize({ width: 1280, height: 900 });

    // « ANNULER » N'ÉCRIT RIEN.
    await dialogue
      .getByRole("button", { name: fr["planning.pose.annuler"] })
      .click();
    await expect(dialogue).toBeHidden();
    await expect(cible.locator(`[data-bloc="${id}"]`)).toHaveCount(0);
    await expect(origine.locator(`[data-bloc="${id}"]`)).toBeVisible();

    // REJOUÉ, PUIS CONFIRMÉ : la carte se pose, avec son avertissement.
    await glisser(page, source, cible);
    const second = dialogueConfirmationDatePassee(page);
    await expect(second).toBeVisible();
    await second
      .getByRole("button", {
        name: fr["planning.pose.confirmer_hors_ouverture_bouton"],
      })
      .click();

    await page.waitForResponse(
      (reponse) =>
        reponse.request().method() === "POST" &&
        reponse.url().includes("/deplacer"),
      { timeout: 16_000 },
    );
    await page.waitForLoadState("load");

    await expect(cible.locator(`[data-bloc="${id}"]`)).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.avertissement.date_passee"] }),
    ).toBeVisible();
    await capturer(page, "9f5c-glisser-deposer-accepte", 1280);
  } finally {
    await retirerIntervention(id);
  }
});

/* ── 2. LA FENÊTRE DE POSE, SUR UN JOUR DÉJÀ PASSÉ ───────────────────────── */

type InterventionAPlanifier = {
  readonly interventionId: string;
  readonly clientId: string;
  readonly siteId: string;
  /**
   * SON PROPRE TECHNICIEN (jamais `reperes.technicienDucos`) — le semis de
   * démonstration pose des interventions sur une large fenêtre de dates,
   * passées comprises ; viser le technicien partagé un jour déjà passé
   * risquait de retomber sur une journée qu'il occupe déjà, et de faire
   * échouer la sonde de créneaux pour une raison étrangère à D123.
   */
  readonly technicienId: string;
};

async function creerInterventionAPlanifierPassee(): Promise<InterventionAPlanifier> {
  const interventionId = uuidv7();
  const clientId = uuidv7();
  const siteId = uuidv7();
  const utilisateurId = uuidv7();
  const utilisateurSocieteId = uuidv7();
  const technicienId = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.utilisateur.create({
      data: {
        id: utilisateurId,
        nom: `9F5C-${utilisateurId}`,
        email: `9f5c-${utilisateurId}@codiplan.test`,
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteId,
        utilisateur_id: utilisateurId,
        societe_id: reperes.societeId,
        role: "technicien",
      },
    });
    await client.technicien.create({
      data: {
        id: technicienId,
        societe_id: reperes.societeId,
        utilisateur_id: utilisateurId,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: `9F5C-${clientId}`,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: `9F5C-${siteId}`,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p1",
        cree_le: new Date("2000-01-01T00:00:00Z"),
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F5C — fenêtre de pose sur un jour déjà passé",
      },
    });
    return { interventionId, clientId, siteId, technicienId: utilisateurId };
  } finally {
    await client.$disconnect();
  }
}

async function retirerInterventionAPlanifier(
  intervention: InterventionAPlanifier,
): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      intervention.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: intervention.interventionId },
    });
    await client.site.deleteMany({ where: { id: intervention.siteId } });
    await client.client.deleteMany({ where: { id: intervention.clientId } });
    await client.technicien.deleteMany({
      where: { utilisateur_id: intervention.technicienId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: intervention.technicienId },
    });
    await client.utilisateur.deleteMany({
      where: { id: intervention.technicienId },
    });
  } finally {
    await client.$disconnect();
  }
}

test("la fenêtre de pose, sur un jour déjà passé, propose la même confirmation avant de planifier (D123)", async ({
  page,
}) => {
  const intervention = await creerInterventionAPlanifierPassee();
  const { interventionId, technicienId } = intervention;
  const jourCle = cleDeJour(jourDeLaScene(reperes, JOUR_PASSE));
  try {
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(jourDeLaScene(reperes, JOUR_PASSE))}`,
    );

    const source = page.locator(`[data-bloc="${interventionId}"]`);
    const cible = page.locator(
      `[data-depot-jour="${jourCle}"][data-depot-technicien="${technicienId}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    await glisser(page, source, cible);

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_120"], exact: true })
      .click();

    // L'HEURE SAISIE À LA MAIN — jamais un créneau proposé par la sonde
    // (`creneauxDisponibles`) : ce technicien, créé pour ce seul scénario,
    // n'a aucune autre intervention ce jour-là, mais rien n'empêche de
    // l'éprouver sans dépendre de la sonde qui, elle, dépend du calendrier.
    await fenetre.getByLabel(fr["planning.pose.heure_autre"]).fill("08:00");

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    // SANS LA CASE COCHÉE, LA DATE PASSÉE BLOQUE « PLANIFIER » (D123) — même
    // discipline que le jour fermé confirmable (9F3B point 3).
    await expect(boutonPlanifier).toBeDisabled();

    const caseConfirmation = fenetre.getByLabel(
      fr["intervention.confirmer_date_passee"],
    );
    await expect(caseConfirmation).toBeVisible();
    await capturer(page, "9f5c-fenetre-pose-dialogue", 375);
    await caseConfirmation.check();
    await expect(boutonPlanifier).toBeEnabled();

    const reponseDeplacer = page.waitForResponse(
      (reponse) =>
        reponse.url().includes("/deplacer") &&
        reponse.request().method() === "POST",
    );
    await boutonPlanifier.click();
    const reponse = await reponseDeplacer;
    expect(reponse.ok()).toBe(true);
    await page.waitForLoadState("load");

    const client = new PrismaClient({
      datasources: { db: { url: urlAdministration() } },
    });
    try {
      const apres = await client.intervention.findUniqueOrThrow({
        where: { id: interventionId },
        select: { statut: true, technicien_id: true },
      });
      expect(apres.statut).toBe("planifiee");
      expect(apres.technicien_id).toBe(technicienId);
    } finally {
      await client.$disconnect();
    }
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.avertissement.date_passee"] }),
    ).toBeVisible();
    await capturer(page, "9f5c-fenetre-pose-accepte", 1280);
  } finally {
    await retirerInterventionAPlanifier(intervention);
  }
});
