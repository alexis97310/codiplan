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
import { cliquerTerminer } from "./setup/terrain-gestes";

/**
 * 9K23-CHECKLIST-BLOCAGE-TERMINER — CK7 : un point obligatoire de checklist
 * sans réponse bloque « Terminer », NOMMÉ (section — libellé), avec un lien
 * qui déplie la tuile et y saute — en ligne (point 1) et hors réseau,
 * depuis la copie locale et la file (point 2).
 *
 * ## LA CHECKLIST EST PINNÉE DIRECTEMENT, JAMAIS RÉSOLUE PAR LA CASCADE
 *
 * Même raison que `tests/isolation/terminer-intervention.test.ts` : un
 * modèle GÉNÉRIQUE actif serait visible de toute intervention curative de
 * la société, y compris celle d'un autre fichier de ce lancement. Poser
 * `intervention.checklist_version_id` directement sur CHAQUE scène jetable
 * isole l'épreuve sans exiger le mode sériel.
 *
 * ## LE TEMPS MESURÉ ET LA SIGNATURE SONT PRÉ-POSÉS, JAMAIS MIMÉS À L'ÉCRAN
 *
 * Un segment déjà FERMÉ et une signature déjà enregistrée, posés par le
 * client admin avant que la page ne charge — ce que ce fichier éprouve est
 * le BLOCAGE CHECKLIST, pas le compteur ni la signature, déjà éprouvés par
 * `9de-terminer-signature.spec.ts`.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K23-CHECKLIST-BLOCAGE-TERMINER/captures",
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
  readonly modeleId: string;
  readonly pointId: string;
  readonly libelleSection: string;
  readonly libellePoint: string;
};

async function creerScene(
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
      raison_sociale: `zz${prefixe} client blocage terminer`,
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
      libelle: `zz${prefixe} site blocage terminer`,
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
      description: `zz${prefixe}-blocage-terminer`,
      // UN COMMENTAIRE DÉJÀ ÉCRIT (RG-INT-02 amendée, 9K27-TERRAIN-TERMINER-
      // CE-QUI-MANQUE) — ce fichier éprouve le blocage CHECKLIST, pas le
      // commentaire, déjà éprouvé par 9k27-terrain-terminer-ce-qui-manque.
      commentaire_technicien: `zz${prefixe} Filtre remplacé.`,
    },
  });

  // UN SEGMENT DÉJÀ FERMÉ — 60 minutes mesurées, sans attendre ni démarrer
  // de compteur à l'écran (hors territoire de ce ticket).
  const maintenant = new Date();
  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(maintenant.getTime() - 60 * 60_000),
      fin: maintenant,
    },
  });

  // UNE SIGNATURE DÉJÀ ENREGISTRÉE — l'issue « signee ».
  await client.interventionSignature.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      issue: "signee",
      image_base64: "data:image/png;base64,AAAA",
      signataire_nom: "Jean Dupont",
    },
  });

  // LE MODÈLE, LA VERSION, LE POINT OBLIGATOIRE — PINNÉ DIRECTEMENT.
  const libelleSection = "Freinage";
  const libellePoint = `zz${prefixe} Plaquettes`;
  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-CK7`,
      libelle: `zz${prefixe} modèle CK7`,
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

async function nettoyer(client: PrismaClient, scene: Scene | null) {
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
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
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

function libelleAttenduDuPoint(scene: Scene): string {
  return `${scene.libelleSection}${fr["ponctuation.separateur"]}${scene.libellePoint}`;
}

test("375/1280 px, EN LIGNE — refus nommé, lien qui déplie et saute, puis Terminer passe une fois répondu", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9K23A");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await expect(
      page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeVisible();

    // « TERMINER » OUVRE TOUJOURS LA FEUILLE (D212 amendée, 9K27-TERRAIN-
    // TERMINER-CE-QUI-MANQUE) — c'est « Confirmer la fin », à l'intérieur,
    // qui reste INACTIF tant que le point obligatoire manque, NOMMÉ.
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    const lien = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lien).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["terrain.terminer.confirmation.oui"],
      }),
    ).toBeDisabled();

    await capturer(page, "refus-nomme-en-ligne", 375);
    await capturer(page, "refus-nomme-en-ligne", 1280);

    // LE LIEN REFERME LA FEUILLE, DÉPLIE LA TUILE ET Y SAUTE.
    await page.setViewportSize({ width: 375, height: 900 });
    await lien.click();
    await expect(
      page.getByRole("button", {
        name: fr["checklist.terrain.masquer_detail"],
      }),
    ).toBeVisible();
    const boutonConforme = page.getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    });
    await expect(boutonConforme).toBeVisible();

    await capturer(page, "tuile-depliee-sur-le-point", 375);

    // RÉPONDU — « Confirmer la fin » se débloque, « Terminer » passe.
    await boutonConforme.click();
    await cliquerTerminer(page);
    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();

    await capturer(page, "termine-apres-reponse", 375);
    await capturer(page, "termine-apres-reponse", 1280);
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, MODE AVION — même refus nommé depuis la copie locale, répondu hors réseau puis mis en file", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9K23B");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    // CHARGÉE EN LIGNE D'ABORD (même patron que 9f4h3-mode-avion.spec.ts) :
    // le mode avion coupe le réseau sur une page déjà servie.
    await page.goto(`/terrain/${scene.interventionId}`);
    await expect(
      page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeVisible();

    await context.setOffline(true);

    // « TERMINER » OUVRE TOUJOURS LA FEUILLE, MÊME HORS RÉSEAU (D212
    // amendée, 9K27-TERRAIN-TERMINER-CE-QUI-MANQUE) — purement locale, elle
    // nomme le point obligatoire manquant et laisse « Confirmer la fin »
    // inactif, sans aucun appel réseau.
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    const lien = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lien).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["terrain.terminer.confirmation.oui"],
      }),
    ).toBeDisabled();

    await capturer(page, "refus-nomme-mode-avion", 375);

    await lien.click();
    const boutonConforme = page.getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    });
    await expect(boutonConforme).toBeVisible();
    // RÉPONDU HORS RÉSEAU — rejoint la file (geste `checklist`, rang 2),
    // AVANT que « terminer » n'y soit mis à son tour.
    await boutonConforme.click();

    await cliquerTerminer(page);
    await expect(
      page.getByText(fr["terrain.terminer.en_attente_envoi"]),
    ).toBeVisible();

    await capturer(page, "mode-avion-termine-en-attente", 375);

    await context.setOffline(false);
  } finally {
    await nettoyer(client, scene);
  }
});
