import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K21-CHECKLIST-TERRAIN-SAISIE — CK5, la tuile de saisie sur la fiche
 * terrain EN LIGNE.
 *
 * Chaque test pose sa PROPRE fiche jetable (client, site, intervention
 * `en_cours`) et son PROPRE modèle de checklist — jamais une lecture de
 * `SCENE.*` qu'un autre fichier écrit (§9), même discipline que
 * `9k13-terrain-attente-piece.spec.ts`. SÉRIEL : un modèle GÉNÉRIQUE
 * (sans rattachement, sans nature) s'applique à TOUTE intervention de la
 * société — sous `fullyParallel`, le modèle posé par le premier test
 * résoudrait aussi la checklist de l'intervention du second s'ils
 * tournaient en même temps.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K21-CHECKLIST-TERRAIN-SAISIE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
  readonly modeleId: string | null;
};

async function creerInterventionEnCours(
  client: PrismaClient,
  prefixe: string,
): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: `zz${prefixe} client checklist terrain`,
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: `zz${prefixe} site checklist terrain`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
  const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
    reperes.lundi.mois,
  ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      date_planifiee: new Date(`${jour}T00:00:00.000Z`),
      creneau_debut: new Date(`${jour}T08:00:00.000Z`),
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-checklist-terrain`,
    },
  });

  return { clientId, siteId, interventionId, modeleId: null };
}

/**
 * UN MODÈLE GÉNÉRIQUE, LES CINQ TYPES DE RÉPONSE — un point par type, un
 * seul obligatoire (`Freins`, pour éprouver le badge sans jamais bloquer
 * « Terminer », D235).
 */
async function creerChecklistCinqTypes(
  client: PrismaClient,
  societeId: string,
  prefixe: string,
): Promise<{
  readonly modeleId: string;
  readonly libelle: string;
  readonly pointConformeId: string;
  readonly pointMesureId: string;
  readonly pointFaitId: string;
  readonly pointChoixId: string;
  readonly pointTexteId: string;
}> {
  const modeleId = uuidv7();
  const libelle = `zz${prefixe} checklist générique`;
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: societeId,
      code: `ZZ${prefixe}-GENERIQUE`,
      libelle,
      actif: true,
    },
  });
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: societeId,
      checklist_modele_id: modeleId,
      numero: 1,
    },
  });
  const pointConformeId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointConformeId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 1,
      libelle: "Freins",
      obligatoire: true,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  const pointMesureId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointMesureId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 2,
      libelle: fr["checklist.terrain.e2e.point_mesure"],
      obligatoire: false,
      type_reponse: "valeur_mesuree",
      unite: "bar",
    },
  });
  const pointFaitId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointFaitId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Entretien",
      ordre: 3,
      libelle: "Nettoyage effectué",
      obligatoire: false,
      type_reponse: "case_faite",
    },
  });
  const pointChoixId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointChoixId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Entretien",
      ordre: 4,
      libelle: fr["checklist.terrain.e2e.point_choix"],
      obligatoire: false,
      type_reponse: "choix_dans_une_liste",
      choix: ["Bon", "Moyen", "Mauvais"],
    },
  });
  const pointTexteId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointTexteId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Entretien",
      ordre: 5,
      libelle: fr["checklist.terrain.e2e.point_texte"],
      obligatoire: false,
      type_reponse: "texte_libre",
    },
  });
  return {
    modeleId,
    libelle,
    pointConformeId,
    pointMesureId,
    pointFaitId,
    pointChoixId,
    pointTexteId,
  };
}

async function nettoyer(
  client: PrismaClient,
  scene: Scene | null,
): Promise<void> {
  if (scene !== null) {
    // L'INTERVENTION D'ABORD (cascade `checklist_reponse`, et lève le pin
    // `checklist_version_id` AVANT que la version elle-même ne soit
    // supprimée — `Restrict` refuserait sinon tant qu'une intervention la
    // référence encore).
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    if (scene.modeleId !== null) {
      await client.checklistVersion.deleteMany({
        where: { checklist_modele_id: scene.modeleId },
      });
      await client.checklistModele.deleteMany({
        where: { id: scene.modeleId },
      });
    }
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375/1280 px, en ligne — les cinq types, le résumé, et la ligne préremplie sur un point non conforme", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    const base = await creerInterventionEnCours(client, "9K21A");
    const checklist = await creerChecklistCinqTypes(
      client,
      (await reperesDeLaScene()).societeId,
      "9K21A",
    );
    scene = { ...base, modeleId: checklist.modeleId };

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const titre = page.getByRole("heading", {
      name: `${fr["checklist.terrain.provenance_prefixe"]}${fr["ponctuation.deux_points"]}${checklist.libelle}`,
    });
    await expect(titre).toBeVisible();
    // LE RÉSUMÉ — `.filter({hasText})` PLUTÔT QU'UN NOM DE `getByRole`
    // (gardien L0-11) : `filter` n'est pas une requête d'écran instrumentée,
    // donc le compte (une donnée, jamais un texte produit) peut y figurer
    // sans détour. Comparaison exacte par `textContent()` + `toBe`, jamais
    // `toHaveText` (lui, instrumenté).
    const resume = page
      .getByRole("status")
      .filter({ hasText: fr["checklist.terrain.points"] });
    await expect(resume).toBeVisible();
    expect(await resume.textContent()).toBe(
      `0/5 ${fr["checklist.terrain.points"]}`,
    );
    await capturer(page, "terrain-fiche-avant", 375);
    await capturer(page, "terrain-fiche-avant", 1280);

    await page
      .getByRole("button", { name: fr["checklist.terrain.afficher_detail"] })
      .click();

    // CONFORME_NON_CONFORME_SANS_OBJET — « Freins », rendu NON CONFORME pour
    // éprouver la ligne préremplie (point 3 du ticket).
    await page
      .getByRole("button", {
        name: fr["checklist.terrain.non_conforme"],
        exact: true,
      })
      .click();

    // VALEUR_MESUREE — `getByRole`, jamais `getByLabel` (le gardien L0-11
    // instrumente `getByLabel` mais pas le NOM d'une `getByRole` ailleurs
    // qu'à travers `name`/`description` ; ici le libellé du point vient du
    // dictionnaire, comme sa propre saisie ci-dessus).
    await page
      .getByRole("spinbutton", {
        name: fr["checklist.terrain.e2e.point_mesure"],
      })
      .fill("2.3");

    // CASE_FAITE
    await page
      .getByLabel(fr["checklist.parametrage.type_reponse.case_faite"])
      .check();

    // CHOIX_DANS_UNE_LISTE
    await page
      .getByRole("combobox", {
        name: fr["checklist.terrain.e2e.point_choix"],
      })
      .selectOption("Bon");

    // TEXTE_LIBRE
    await page
      .getByRole("textbox", {
        name: fr["checklist.terrain.e2e.point_texte"],
      })
      .fill("Rien à signaler par ailleurs.");

    expect(await resume.textContent()).toBe(
      `5/5 ${fr["checklist.terrain.points"]}${fr["ponctuation.virgule"]}1 ${fr["checklist.terrain.non_conforme"]}`,
    );

    // LA LIGNE PRÉREMPLIE, DANS « SUITE À DONNER » (point 3) — composée par
    // `ligneNonConforme` (lib/checklists/suite-preremplie.ts).
    const suite = page.getByLabel(fr["terrain.rapport.suite_libelle"]);
    await expect(suite).toHaveValue(
      `Sécurité${fr["ponctuation.separateur"]}Freins${fr["ponctuation.deux_points"]}${fr["checklist.terrain.non_conforme"]}`,
    );

    await capturer(page, "terrain-fiche-depliee", 375);
    await capturer(page, "terrain-fiche-depliee", 1280);

    // L'ENVOI — LE GESTE A ÉTÉ GARDÉ EN FILE, JAMAIS TENTÉ EN LIGNE PAR LA
    // TUILE ELLE-MÊME (voir l'en-tête de `checklist-terrain.tsx`).
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    await capturer(page, "terrain-fiche-apres", 375);
    await capturer(page, "terrain-fiche-apres", 1280);

    const reponses = await client.checklistReponse.findMany({
      where: { intervention_id: scene.interventionId },
      orderBy: { libelle: "asc" },
    });
    expect(reponses).toHaveLength(5);
    const parPoint = new Map(
      reponses.map((r) => [r.checklist_point_id, r] as const),
    );
    expect(parPoint.get(checklist.pointConformeId)?.valeur_conforme).toBe(
      "non_conforme",
    );
    expect(
      Number(parPoint.get(checklist.pointMesureId)?.valeur_mesuree),
    ).toBeCloseTo(2.3);
    expect(parPoint.get(checklist.pointFaitId)?.valeur_fait).toBe(true);
    expect(parPoint.get(checklist.pointChoixId)?.valeur_choix).toBe("Bon");
    expect(parPoint.get(checklist.pointTexteId)?.valeur_texte).toBe(
      "Rien à signaler par ailleurs.",
    );

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { checklist_version_id: true },
    });
    expect(ligne.checklist_version_id).not.toBeNull();
  } finally {
    await nettoyer(client, scene);
  }
});

test("une intervention sans gabarit résolu n'affiche AUCUNE tuile", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9K21B");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    // LA TUILE NE SE RÉDUIT PAS, ELLE NE SE REND PAS DU TOUT — un seul
    // contrôle, mais DÉFINITIF : ce bouton n'existe que dans
    // `ChecklistTerrain` elle-même (aucun autre écran ne porte ce libellé).
    await expect(
      page.getByRole("button", {
        name: fr["checklist.terrain.afficher_detail"],
      }),
    ).toHaveCount(0);
  } finally {
    await nettoyer(client, scene);
  }
});
