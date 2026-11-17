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
 * 9L08E-NON-CONFORME-SUITE-OBLIGATOIRE (D264, amende D254) — un point répondu
 * « non conforme » SANS suite à donner bloque « Terminer », NOMMÉ, avec un
 * lien qui déplie la rubrique et y saute — en ligne et hors réseau, même
 * patron que `9k23-checklist-blocage-terminer.spec.ts` (CK7) pour le point
 * obligatoire sans réponse.
 *
 * Le point n'est pas OBLIGATOIRE (`obligatoire: false`) : la décision ne
 * dépend pas de ce drapeau, seulement de la conformité de la réponse.
 *
 * Un COMMENTAIRE est déjà posé sur la réponse (sans suite) pour que la
 * ligne rouge soit REPLIÉE dès le chargement (`detailNonConformeVide` est
 * faux dès qu'une des deux informations est déjà écrite) — sinon elle
 * s'ouvrirait seule, et la capture « ligne rouge » n'aurait rien à montrer.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L08E-NON-CONFORME-SUITE-OBLIGATOIRE/captures",
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
      raison_sociale: `zz${prefixe} client suite obligatoire`,
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
      libelle: `zz${prefixe} site suite obligatoire`,
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
      description: `zz${prefixe}-suite-obligatoire`,
      // UN COMMENTAIRE DÉJÀ ÉCRIT — ce fichier éprouve le blocage « suite
      // manquante », pas le commentaire du rapport (9K27).
      commentaire_technicien: `zz${prefixe} Filtre remplacé.`,
    },
  });

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

  // LE MODÈLE, LA VERSION, LE POINT — PINNÉ DIRECTEMENT (même raison que
  // 9k23 : isoler l'épreuve d'un modèle générique partagé).
  const libelleSection = "Sécurité";
  const libellePoint = `zz${prefixe} Pneus`;
  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-D264`,
      libelle: `zz${prefixe} modèle D264`,
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
      // NON OBLIGATOIRE — D264 bloque sur la CONFORMITÉ de la réponse,
      // jamais sur le drapeau `obligatoire` (CK7 reste une garde distincte).
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  await client.checklistReponse.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      checklist_point_id: pointId,
      libelle: libellePoint,
      section: libelleSection,
      obligatoire: false,
      valeur_conforme: "non_conforme",
      // AUCUNE SUITE — le commentaire est posé pour que la ligne reste
      // REPLIÉE au chargement (voir le docblock du fichier).
      non_conformite_commentaire: `zz${prefixe} trace d'usure.`,
      auteur_id: reperes.technicienDucos,
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

test("375 px, EN LIGNE — refus nommé « suite manquante », lien qui déplie et saute à la ligne rouge, puis Terminer passe une fois la suite posée", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L08EA");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await expect(
      page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeVisible();

    // « TERMINER » OUVRE TOUJOURS LA FEUILLE (D212 amendée) — « Confirmer
    // la fin » reste inactif tant que la suite manque, NOMMÉE (D264).
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    const lien = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lien).toBeVisible();
    await expect(
      page.getByText(
        fr["terrain.terminer.confirmation.manque_suite_non_conforme"],
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["terrain.terminer.confirmation.oui"],
      }),
    ).toBeDisabled();

    await capturer(page, "feuille-terminer-suite-manquante", 375);

    // LE LIEN REFERME LA FEUILLE, DÉPLIE LA RUBRIQUE ET Y SAUTE — la ligne
    // rouge repliée devient visible, et nomme le même manque.
    await lien.click();
    const ligneRouge = page.getByRole("button", {
      name: new RegExp(
        fr["checklist.non_conformite.suite_manquante"].replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
      ),
    });
    await expect(ligneRouge).toBeVisible();

    await capturer(page, "point-atteint-ligne-rouge-suite-manquante", 375);

    // LA LIGNE ROUGE SE ROUVRE AU TOUCHER — choisir la suite la referme à
    // nouveau avec le nouveau résumé.
    await ligneRouge.click();
    await page
      .getByRole("radio", { name: fr["checklist.non_conformite.a_revoir"] })
      .click();

    await capturer(page, "suite-posee", 375);

    // RÉPONDUE — « Confirmer la fin » se débloque, « Terminer » passe.
    await cliquerTerminer(page);
    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, MODE AVION — même refus nommé depuis la copie locale, suite posée hors réseau puis Terminer mis en file", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L08EB");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);
    await expect(
      page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeVisible();

    await context.setOffline(true);

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

    await lien.click();
    const ligneRouge = page.getByRole("button", {
      name: new RegExp(
        fr["checklist.non_conformite.suite_manquante"].replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
      ),
    });
    await expect(ligneRouge).toBeVisible();
    await ligneRouge.click();
    // RÉPONDUE HORS RÉSEAU — rejoint la file (geste `checklist`, rang 2),
    // AVANT que « terminer » n'y soit mis à son tour (même patron que 9k23).
    await page
      .getByRole("radio", { name: fr["checklist.non_conformite.a_revoir"] })
      .click();

    await cliquerTerminer(page);
    await expect(
      page.getByText(fr["terrain.terminer.en_attente_envoi"]),
    ).toBeVisible();

    await capturer(page, "mode-avion-suite-posee-termine-en-attente", 375);

    await context.setOffline(false);
  } finally {
    await nettoyer(client, scene);
  }
});
