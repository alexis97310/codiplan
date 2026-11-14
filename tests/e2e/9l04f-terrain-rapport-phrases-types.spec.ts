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
 * 9L04F-TERRAIN-RAPPORT-PHRASES-TYPES — « Phrases types » (4 phrases
 * validées par Alexis le 13/11/2026) et « Reprendre la non-conformité de la
 * checklist ».
 *
 * Chaque test pose sa PROPRE fiche jetable (client, site, intervention
 * `en_cours`) et son PROPRE modèle de checklist, même discipline que
 * `9k21-checklist-terrain-saisie.spec.ts` — SÉRIEL, un modèle GÉNÉRIQUE
 * s'applique à toute intervention de la société.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04F-TERRAIN-RAPPORT-PHRASES-TYPES/captures",
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
      raison_sociale: `zz${prefixe} client rapport phrases types`,
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
      libelle: `zz${prefixe} site rapport phrases types`,
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
      description: `zz${prefixe}-rapport-phrases-types`,
    },
  });

  return { clientId, siteId, interventionId, modeleId: null };
}

/** Deux points `conforme_non_conforme_sans_objet`, aucun obligatoire — la
 * reprise ne doit rien devoir à l'avancement de la checklist. */
async function creerChecklistDeuxPointsConformite(
  client: PrismaClient,
  societeId: string,
  prefixe: string,
): Promise<{
  readonly modeleId: string;
  readonly libelle: string;
  readonly pointFreinsId: string;
  readonly pointPneusId: string;
}> {
  const modeleId = uuidv7();
  const libelle = `zz${prefixe} checklist conformité`;
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: societeId,
      code: `ZZ${prefixe}-CONFORMITE`,
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
  const pointFreinsId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointFreinsId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 1,
      libelle: "Freins",
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  const pointPneusId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointPneusId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 2,
      libelle: "Pneus",
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  return { modeleId, libelle, pointFreinsId, pointPneusId };
}

async function nettoyer(
  client: PrismaClient,
  scene: Scene | null,
): Promise<void> {
  if (scene !== null) {
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

test("375 px — « Phrases types » insère la phrase choisie dans le commentaire, qui reste modifiable", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerInterventionEnCours(client, "9L04FA");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const commentaire = page.getByLabel(
      fr["terrain.rapport.commentaire_libelle"],
    );
    await expect(commentaire).toBeVisible();
    await capturer(page, "rapport-vide", 375);

    await page
      .getByRole("button", { name: fr["terrain.rapport.phrases_types.lien"] })
      .click();
    const dialogue = page.getByRole("dialog", {
      name: fr["terrain.rapport.phrases_types.titre"],
    });
    await expect(dialogue).toBeVisible();
    await capturer(page, "phrases-types-ouvertes", 375);

    await dialogue
      .getByRole("button", {
        name: fr["terrain.rapport.phrases_types.phrase_1"],
        exact: true,
      })
      .click();
    await expect(dialogue).toBeHidden();
    await expect(commentaire).toHaveValue(
      fr["terrain.rapport.phrases_types.phrase_1"],
    );

    // LE TEXTE RESTE MODIFIABLE — une saisie ordinaire, jamais verrouillée.
    await commentaire.fill(
      `${fr["terrain.rapport.phrases_types.phrase_1"]} vérifié deux fois.`,
    );
    await expect(commentaire).toHaveValue(
      `${fr["terrain.rapport.phrases_types.phrase_1"]} vérifié deux fois.`,
    );
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px — « Reprendre la non-conformité de la checklist » : absent sans non-conformité, insère une ligne par point", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    const base = await creerInterventionEnCours(client, "9L04FB");
    const checklist = await creerChecklistDeuxPointsConformite(
      client,
      (await reperesDeLaScene()).societeId,
      "9L04FB",
    );
    scene = { ...base, modeleId: checklist.modeleId };

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const lienReprise = page.getByRole("button", {
      name: fr["terrain.rapport.reprendre_non_conformites"],
    });
    const suite = page.getByLabel(fr["terrain.rapport.suite_libelle"]);

    // AUCUNE NON-CONFORMITÉ ENCORE SAISIE — le lien n'existe pas.
    await expect(lienReprise).toHaveCount(0);

    // « Freins » ET « Pneus » passent NON CONFORME.
    const pastillesNonConforme = page.getByRole("button", {
      name: fr["checklist.terrain.non_conforme"],
      exact: true,
    });
    await pastillesNonConforme.nth(0).click();
    await pastillesNonConforme.nth(1).click();

    await expect(lienReprise).toBeVisible();
    await capturer(page, "rapport-non-conformites-a-reprendre", 375);

    await lienReprise.click();
    await expect(suite).toHaveValue(
      [
        `Sécurité${fr["ponctuation.separateur"]}Freins${fr["ponctuation.deux_points"]}${fr["checklist.terrain.non_conforme"]}`,
        `Sécurité${fr["ponctuation.separateur"]}Pneus${fr["ponctuation.deux_points"]}${fr["checklist.terrain.non_conforme"]}`,
      ].join("\n"),
    );

    // UN SECOND CLIC N'AJOUTE RIEN EN DOUBLE (même garde que `suiteAvecLigne`).
    await lienReprise.click();
    await expect(suite).toHaveValue(
      [
        `Sécurité${fr["ponctuation.separateur"]}Freins${fr["ponctuation.deux_points"]}${fr["checklist.terrain.non_conforme"]}`,
        `Sécurité${fr["ponctuation.separateur"]}Pneus${fr["ponctuation.deux_points"]}${fr["checklist.terrain.non_conforme"]}`,
      ].join("\n"),
    );

    // LA RUBRIQUE COMPLÈTE S'EST REPLIÉE D'ELLE-MÊME (9L04D, point 4) — la
    // rouvrir avant d'y resaisir, par son bouton-titre, jamais par son nom
    // (compteur de fixture, pas une clé du dictionnaire).
    await page.getByRole("button").filter({ hasText: "Sécurité" }).click();

    // « Freins » REDEVIENT CONFORME — une seule non-conformité restante,
    // le lien reste visible (texte déjà écrit laissé tel quel).
    await page
      .getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
        exact: true,
      })
      .first()
      .click();
    await expect(lienReprise).toBeVisible();

    await capturer(page, "rapport-remplie", 375);
  } finally {
    await nettoyer(client, scene);
  }
});
