import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  SAMEDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * « TROUVER UN CRÉNEAU » DEPUIS LA FICHE (PG-B3-TROUVER-CRENEAU-FICHE,
 * spécification §3.10).
 *
 * La fiche d'une intervention `a_planifier` ouvre LA MÊME `FenetrePose` que
 * le planning (`planning-fenetre-pose.spec.ts`), mais avec le jour
 * CHOISISSABLE — la fiche n'a ni case ni glissé pour le fixer. Ce fichier
 * n'éprouve donc PAS ce que PG-B2 éprouve déjà (les créneaux, les verdicts,
 * la sonde d'absence) : il éprouve que le bouton ouvre la fenêtre depuis la
 * fiche, que le jour s'y choisit, et que l'écriture aboutit — ou se refuse,
 * nommée — par la MÊME route que « Déplacer ».
 *
 * *Chaque scénario forge SA PROPRE intervention* (préfixe `PGB3-`) et la
 * retire en fin de test — jamais une fixture `SCENE.*` partagée.
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
        description: "PGB3 — intervention forgée par l'épreuve",
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

test("« Trouver un créneau » ouvre la fenêtre depuis la fiche, laisse choisir le jour, et planifie", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  // DIX SEMAINES PLUS LOIN, UN MARDI — hors de portée des offsets déjà pris
  // par les autres scénarios qui visent le même technicien (0, 21, 35, 49,
  // 63, 91 : voir `intervention-technicien-select.spec.ts`,
  // `fiche-technicien-nomme.spec.ts`, `parcours-creer-puis-planifier.spec.ts`,
  // `avertissements-1.spec.ts`).
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), 70);
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

    await page.goto(`/interventions/${interventionId}`);

    const bouton = page.getByRole("button", {
      name: fr["intervention.action.trouver_creneau"],
    });
    await expect(bouton).toBeVisible();
    await bouton.click();

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();
    // AUCUNE ÉCRITURE AVANT « PLANIFIER » — même garantie que PG-B2.
    expect(posteVersDeplacer).toBe(false);

    // LE JOUR SE CHOISIT ICI (PG-B3) — la fiche n'a ni case ni glissé pour le
    // fixer, contrairement au planning.
    await fenetre.getByLabel(fr["planning.pose.date"]).fill(jourCle);
    await expect(fenetre).toHaveAttribute("data-jour", jourCle);

    await fenetre.locator("select").selectOption(reperes.technicienDucos);
    await expect(fenetre).toHaveAttribute(
      "data-technicien",
      reperes.technicienDucos,
    );

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
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

    // La confirmation ÉCRIT PAR LA MÊME ROUTE que « Déplacer » —
    // `posterDeplacement`, partagée avec `components/planning/pose.tsx`.
    const reponseDeplacer = page.waitForResponse(
      (reponse) =>
        reponse.url().includes("/deplacer") &&
        reponse.request().method() === "POST",
    );
    await boutonPlanifier.click();
    const reponse = await reponseDeplacer;
    expect(reponse.ok()).toBe(true);
    await page.waitForLoadState("load");

    // LA FICHE S'EST RECHARGÉE — le statut affiché est à jour.
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
    ).toBeVisible();

    const client = new PrismaClient({
      datasources: { db: { url: urlAdministration() } },
    });
    try {
      const apres = await client.intervention.findUniqueOrThrow({
        where: { id: interventionId },
        select: {
          statut: true,
          technicien_id: true,
          date_planifiee: true,
          creneau_debut: true,
          creneau_fin: true,
        },
      });
      expect(apres.statut).toBe("planifiee");
      expect(apres.technicien_id).toBe(reperes.technicienDucos);
      expect(apres.date_planifiee?.toISOString().slice(0, 10)).toBe(jourCle);
      expect(apres.creneau_debut).not.toBeNull();
      expect(apres.creneau_fin).not.toBeNull();
    } finally {
      await client.$disconnect();
    }
  } finally {
    await retirerIntervention(interventionId);
  }
});

test("un jour fermé, choisi dans la fenêtre depuis la fiche : le refus est nommé, « Planifier » reste inactif", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const samedi = jourDeLaScene(reperes, SAMEDI);
  const samediCle = cleDeJour(samedi);
  const interventionId = await creerInterventionAPlanifier(reperes, "KONE");

  try {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}`);

    await page
      .getByRole("button", { name: fr["intervention.action.trouver_creneau"] })
      .click();

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();

    // KONÉ EST FERMÉ LE SAMEDI — choisi ICI, dans la fenêtre, depuis la fiche.
    await fenetre.getByLabel(fr["planning.pose.date"]).fill(samediCle);
    await expect(fenetre).toHaveAttribute("data-jour", samediCle);

    await fenetre.locator("select").selectOption(reperes.technicienKone);

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();

    // AUCUN CRÉNEAU CE JOUR-LÀ (agence fermée) : le champ « Autre heure »
    // reste la seule voie pour soumettre un candidat complet au jugement du
    // serveur — même mécanique que `creation-jour-ferme.spec.ts`, mais vue
    // depuis les CONTRÔLES de la fenêtre plutôt qu'après un envoi.
    await fenetre.getByLabel(fr["planning.pose.heure_autre"]).fill("09:00");

    await expect(
      fenetre.getByText(fr["intervention.refus.jour_ferme"]),
    ).toBeVisible();

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeDisabled();
  } finally {
    await retirerIntervention(interventionId);
  }
});
