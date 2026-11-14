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
 * 9L04G-TERRAIN-BARRE-FIXE-TERMINER — la barre d'action fixe en bas de la
 * fiche (décision d'Alexis du 13/11/2026) et l'ajustement de la feuille
 * « Terminer » (9K27, D242) : chaque manque mène au point précis, rubrique
 * dépliée, FOCUS posé (pas seulement un défilement).
 *
 * **La signature reste bloquante quand elle est totalement ABSENTE** — seul
 * un MOTIF (« client absent »/« refus ») la lève, exactement comme avant ce
 * lot (D-S5, D242) : voir la passation sur le désaccord entre le ticket
 * (« avertissement, pas un blocage ») et ces deux décisions de rang 1, que
 * ce fichier ne tranche pas.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L04G-TERRAIN-BARRE-FIXE-TERMINER/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-375.png`),
    fullPage: true,
  });
}

type SceneTerminer = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
  readonly modeleId: string;
  readonly pointId: string;
  readonly libelleSection: string;
  readonly libellePoint: string;
};

async function creerSceneTerminer(
  client: PrismaClient,
  prefixe: string,
): Promise<SceneTerminer> {
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
      raison_sociale: `zz${prefixe} client barre fixe`,
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
      libelle: `zz${prefixe} site barre fixe`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
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
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-barre-fixe-terminer`,
      // LE COMMENTAIRE EST DÉJÀ ÉCRIT — seuls DEUX manques, pas trois : la
      // signature et la checklist, pour que « 2 manques » dans la feuille
      // ne dépende pas d'un troisième qui masquerait le compte.
      commentaire_technicien: `zz${prefixe} déjà rempli.`,
    },
  });

  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(Date.now() - 60 * 60_000),
      fin: new Date(),
    },
  });

  const libelleSection = "Freinage";
  const libellePoint = `zz${prefixe} Plaquettes`;
  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-L04G`,
      libelle: `zz${prefixe} modèle barre fixe`,
      actif: false,
    },
  });
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: reperes.societeId,
      checklist_modele_id: modeleId,
      numero: 1,
    },
  });
  const pointId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointId,
      societe_id: reperes.societeId,
      checklist_version_id: versionId,
      section: libelleSection,
      ordre: 1,
      libelle: libellePoint,
      obligatoire: true,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  await client.intervention.update({
    where: { id: interventionId },
    data: { checklist_version_id: versionId },
  });

  return {
    clientId,
    siteId,
    interventionId,
    modeleId,
    pointId,
    libelleSection,
    libellePoint,
  };
}

async function nettoyerSceneTerminer(
  client: PrismaClient,
  scene: SceneTerminer | null,
): Promise<void> {
  if (scene !== null) {
    await client.checklistReponse.deleteMany({
      where: { intervention_id: scene.interventionId },
    });
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "checklist_version_id" = NULL WHERE "id" = $1::uuid`,
      scene.interventionId,
    );
    await client.checklistVersion.deleteMany({
      where: { checklist_modele_id: scene.modeleId },
    });
    await client.checklistModele.deleteMany({ where: { id: scene.modeleId } });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

function libelleAttenduDuPoint(scene: SceneTerminer): string {
  return `${scene.libelleSection}${fr["ponctuation.separateur"]}${scene.libellePoint}`;
}

test("375 px — la barre reste fixe au défilement, la feuille a 2 manques, un lien y mène et y pose le focus, le motif suffit à lever la signature", async ({
  page,
}) => {
  const client = admin();
  let scene: SceneTerminer | null = null;
  try {
    scene = await creerSceneTerminer(client, "9L04GA");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const suspendre = page.getByRole("button", {
      name: fr["terrain.suspendre.bouton"],
    });
    const terminer = page.getByRole("button", {
      name: fr["terrain.terminer.bouton"],
    });
    await expect(suspendre).toBeVisible();
    await expect(terminer).toBeVisible();
    await capturer(page, "barre-fixe-en-cours-haut");

    // LA BARRE RESTE FIXE AU DÉFILEMENT — même position à l'écran avant et
    // après un grand défilement du contenu (point 1).
    const positionAvant = await terminer.boundingBox();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(100);
    const positionApres = await terminer.boundingBox();
    expect(positionApres?.y).toBe(positionAvant?.y);
    await capturer(page, "barre-fixe-en-cours-bas");

    // LA FEUILLE A EXACTEMENT DEUX MANQUES (signature, checklist) — le
    // commentaire, déjà écrit par la scène, n'en est pas un (point 2, 9K27
    // amendé).
    await terminer.click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_commentaire"]),
    ).toBeHidden();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_signature"]),
    ).toBeVisible();
    const lienChecklist = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lienChecklist).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["terrain.terminer.confirmation.oui"],
      }),
    ).toBeDisabled();
    await capturer(page, "feuille-deux-manques");

    // LE LIEN REFERME LA FEUILLE, DÉPLIE LA RUBRIQUE ET Y POSE LE FOCUS —
    // pas seulement un défilement (point 2, 9L04G).
    await lienChecklist.click();
    const pointChecklist = page.locator(`#checklist-point-${scene.pointId}`);
    await expect(pointChecklist).toBeVisible();
    await expect(pointChecklist).toBeFocused();
    await capturer(page, "checklist-point-atteint");

    const boutonConforme = page.getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    });
    await boutonConforme.click();

    // « ALLER À LA SIGNATURE » POSE AUSSI LE FOCUS — sur la section, pas
    // seulement un défilement.
    await terminer.click();
    await page
      .getByRole("button", {
        name: fr["terrain.terminer.confirmation.aller_signature"],
      })
      .click();
    const sectionSignature = page
      .getByRole("heading", { name: fr["terrain.signature.titre"] })
      .locator("..");
    await expect(sectionSignature).toBeFocused();

    // LE MOTIF SUFFIT — « client absent », SANS trait dessiné, lève le
    // manque « signature » : ce que 9K27/D242 exigeaient déjà avant ce lot,
    // et que ce lot n'assouplit ni ne durcit (voir la passation).
    await page
      .getByRole("button", { name: fr["terrain.signature.option_absent"] })
      .click();
    const motif = page.getByLabel(fr["terrain.signature.motif_libelle"]);
    await motif.fill("zz9L04GA client injoignable");
    await motif.blur();
    await expect(
      page.getByText(fr["terrain.signature.enregistre"]),
    ).toBeVisible();

    await terminer.click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_signature"]),
    ).toBeHidden();
    const confirmer = page.getByRole("button", {
      name: fr["terrain.terminer.confirmation.oui"],
    });
    await expect(confirmer).toBeEnabled();
    await confirmer.click();

    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();
    await capturer(page, "termine-sans-trait-avec-motif");
  } finally {
    await nettoyerSceneTerminer(client, scene);
  }
});

type SceneSuspendre = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
};

async function creerSceneSuspendre(
  client: PrismaClient,
  prefixe: string,
): Promise<SceneSuspendre> {
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
      raison_sociale: `zz${prefixe} client barre fixe suspendre`,
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
      libelle: `zz${prefixe} site barre fixe suspendre`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
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
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-barre-fixe-suspendre`,
    },
  });

  return { clientId, siteId, interventionId };
}

async function nettoyerSceneSuspendre(
  client: PrismaClient,
  scene: SceneSuspendre | null,
): Promise<void> {
  if (scene !== null) {
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px — « Suspendre » depuis la barre fixe, avec pièce ; la barre se vide ensuite", async ({
  page,
}) => {
  const client = admin();
  let scene: SceneSuspendre | null = null;
  try {
    scene = await creerSceneSuspendre(client, "9L04GB");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    const suspendre = page.getByRole("button", {
      name: fr["terrain.suspendre.bouton"],
    });
    await expect(suspendre).toBeVisible();
    await suspendre.click();

    await page
      .getByLabel(fr["intervention.suspension.piece"])
      .fill("zz9L04GB-REF-42");
    await page
      .getByLabel(fr["intervention.suspension.date_dispo"])
      .fill("2026-12-20");
    await capturer(page, "suspendre-feuille-remplie");
    await page
      .getByRole("button", { name: fr["terrain.suspendre.enregistrer"] })
      .click();

    await expect(page.getByText("zz9L04GB-REF-42")).toBeVisible();

    // LA BARRE SE VIDE — « Suspendue » n'a aujourd'hui aucun geste terrain
    // à y proposer (voir la passation : « Reprendre » depuis le terrain
    // reste à construire, même patron que D236 pour « Suspendre »).
    await expect(
      page.getByRole("group", { name: fr["terrain.barre_action.libelle"] }),
    ).toBeHidden();
    await capturer(page, "suspendre-barre-vide");

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true, piece_attendue_ref: true },
    });
    expect(ligne.statut).toBe("suspendue");
    expect(ligne.piece_attendue_ref).toBe("zz9L04GB-REF-42");
  } finally {
    await nettoyerSceneSuspendre(client, scene);
  }
});
