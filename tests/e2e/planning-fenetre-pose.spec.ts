import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  MERCREDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FENÊTRE DE POSE (PG-B2-FENETRE-POSE, §3.10) — le dépôt d'une carte de la
 * file « À planifier » n'écrit plus rien avant que « Planifier » n'ait été
 * cliqué dans une fenêtre pré-remplie du jour et du technicien de la case.
 *
 * *Chaque scénario forge SA PROPRE intervention* (préfixe `PGB2-`, un
 * identifiant tiré au sort) et la retire en fin de test — jamais une fixture
 * `SCENE.*` partagée (voir `scene-glisser.ts`, même raison).
 */

async function creerInterventionAPlanifier(
  reperes: ReperesDeScene,
  codeAgence: "KONE" | "DUCOS",
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: codeAgence },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGB2 — intervention forgée par l'épreuve",
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

async function declarerAbsence(
  reperes: ReperesDeScene,
  technicienId: string,
  jour: { annee: number; mois: number; jour: number },
): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const date = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    const absence = await client.absence.create({
      data: {
        societe_id: reperes.societeId,
        utilisateur_id: technicienId,
        du: date,
        au: date,
      },
      select: { id: true },
    });
    return absence.id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerAbsence(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.absence.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("le dépôt d'une carte de la file ouvre la fenêtre de pose, sans écrire — puis planifie au créneau choisi", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  // ONZE SEMAINES PLUS LOIN, UN MARDI (multiple de 7, hors de portée des
  // créneaux passés — PG-B1) — hors des offsets déjà pris par les autres
  // scénarios qui visent le même technicien (technicienDucos) sur MARDI :
  // 21, 35, 49, 63, 70, 91 (voir `fiche-trouver-creneau.spec.ts`), et 92
  // (mardi de la semaine 13, `avertissements-1.spec.ts`, calculé depuis
  // `reperes.lundi` directement).
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), 77);
  const jourCle = cleDeJour(jour);
  const interventionId = await creerInterventionAPlanifier(reperes, "DUCOS");

  try {
    await ouvrirUneSession(page);

    let posteVersDeplacer = false;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        posteVersDeplacer = true;
      }
    });

    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const source = page.locator(`[data-bloc="${interventionId}"]`);
    const cible = page.locator(
      `[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienDucos}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    await glisser(page, source, cible);

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();
    await expect(fenetre).toHaveAttribute("data-jour", jourCle);
    await expect(fenetre).toHaveAttribute(
      "data-technicien",
      reperes.technicienDucos,
    );

    // AUCUN POST « DEPLACER » AVANT « PLANIFIER » — tout le sens du ticket :
    // la case n'a ni heure ni durée sûre, la fenêtre les complète d'abord.
    expect(posteVersDeplacer).toBe(false);

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_120"], exact: true })
      .click();

    const creneauxFieldset = fenetre
      .locator("fieldset")
      .filter({ hasText: fr["planning.pose.heure"] });
    const premierCreneau = creneauxFieldset.locator("button").first();
    await expect(premierCreneau).toBeVisible();
    await premierCreneau.click();

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeEnabled();

    // ATTENDRE LA RÉPONSE DU SERVEUR, PAS SEULEMENT LE CLIC : l'URL courante
    // est DÉJÀ `/planning` avant ce clic — `window.location.assign` y navigue
    // À NOUVEAU (un rechargement complet, jamais un changement de route), et
    // `page.waitForURL` ne verrait alors AUCUN changement à attendre.
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
        select: {
          statut: true,
          technicien_id: true,
          creneau_debut: true,
          creneau_fin: true,
        },
      });
      expect(apres.statut).toBe("planifiee");
      expect(apres.technicien_id).toBe(reperes.technicienDucos);
      expect(apres.creneau_debut).not.toBeNull();
      expect(apres.creneau_fin).not.toBeNull();
    } finally {
      await client.$disconnect();
    }
  } finally {
    await retirerIntervention(interventionId);
  }
});

test("un technicien absent ce jour-là : « Planifier » reste inactif, le motif est affiché", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  // DOUZE SEMAINES PLUS LOIN, UN MERCREDI (multiple de 7) — aucun autre
  // scénario de la suite ne vise MERCREDI avec un décalage, cette colonne est
  // donc libre de collision.
  const jour = jourSuivant(jourDeLaScene(reperes, MERCREDI), 84);
  const jourCle = cleDeJour(jour);
  const interventionId = await creerInterventionAPlanifier(reperes, "KONE");
  const absenceId = await declarerAbsence(
    reperes,
    reperes.technicienKone,
    jour,
  );

  try {
    await ouvrirUneSession(page);
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    const source = page.locator(`[data-bloc="${interventionId}"]`);
    const cible = page.locator(
      `[data-depot-jour="${jourCle}"][data-depot-technicien="${reperes.technicienKone}"]`,
    );
    await expect(source).toBeVisible();
    await expect(cible).toBeVisible();

    await glisser(page, source, cible);

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();

    await expect(
      fenetre.getByText(fr["planning.pose.technicien_absent"]),
    ).toBeVisible();

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeDisabled();
  } finally {
    await retirerAbsence(absenceId);
    await retirerIntervention(interventionId);
  }
});
