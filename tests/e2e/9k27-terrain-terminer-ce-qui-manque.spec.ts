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
 * 9K27-TERRAIN-TERMINER-CE-QUI-MANQUE — décision « Inactif + commentaire
 * exigé » d'Alexis du 10/11/2026 (D242, amende D212 et D219).
 *
 * Trois manques dans la MÊME feuille (commentaire, signature, checklist),
 * chacun nommé et cliquable, « Confirmer la fin » inactif tant qu'il en
 * reste un — en ligne (point 1) et hors réseau, depuis la copie locale et
 * la file (point 2).
 *
 * ## LA CHECKLIST EST PINNÉE DIRECTEMENT, MÊME RAISON QUE 9K23
 *
 * Voir le docblock de `9k23-checklist-blocage-terminer.spec.ts` : un modèle
 * GÉNÉRIQUE actif serait visible de toute intervention curative de la
 * société, y compris celle d'un autre fichier lancé en même temps.
 *
 * ## LE TEMPS EST PRÉ-POSÉ FERMÉ, SAUF LE SEGMENT LIVE DE LA SCÈNE B
 *
 * Un segment déjà FERMÉ isole ce que ce fichier éprouve (les trois manques)
 * du refus « temps manquant », hors de son périmètre — déjà éprouvé par
 * `9f4-terrain-enregistrement-auto.spec.ts`. La scène B pose en plus un
 * segment OUVERT pour éprouver le temps qui défile (M3).
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K27-TERRAIN-TERMINER-CE-QUI-MANQUE/captures",
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
  segmentOuvert: boolean,
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
      raison_sociale: `zz${prefixe} client terminer ce qui manque`,
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
      libelle: `zz${prefixe} site terminer ce qui manque`,
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
      description: `zz${prefixe}-terminer-ce-qui-manque`,
      // AUCUN COMMENTAIRE — c'est le premier manque que cette scène éprouve.
      commentaire_technicien: null,
    },
  });

  // UN SEGMENT — fermé pour la scène A (seuls les trois manques comptent),
  // ENCORE OUVERT pour la scène B (M3 : le temps affiché doit défiler).
  const maintenant = new Date();
  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(maintenant.getTime() - 60 * 60_000),
      fin: segmentOuvert ? null : maintenant,
    },
  });

  // AUCUNE SIGNATURE — le second manque.

  // LE MODÈLE, LA VERSION, LE POINT OBLIGATOIRE — PINNÉ DIRECTEMENT, le
  // troisième manque.
  const libelleSection = "Freinage";
  const libellePoint = `zz${prefixe} Plaquettes`;
  const modeleId = uuidv7();
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: reperes.societeId,
      code: `ZZ${prefixe}-K27`,
      libelle: `zz${prefixe} modèle terminer ce qui manque`,
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

function libelleAttenduDuPoint(scene: Scene): string {
  return `${scene.libelleSection}${fr["ponctuation.separateur"]}${scene.libellePoint}`;
}

test("375/1280 px, EN LIGNE — les trois manques nommés et cliquables, Confirmer la fin inactif puis actif", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9K27A", false);

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    // « TERMINER » OUVRE TOUJOURS LA FEUILLE (D212 amendée).
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();

    const confirmer = page.getByRole("button", {
      name: fr["terrain.terminer.confirmation.oui"],
    });
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_commentaire"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_signature"]),
    ).toBeVisible();
    const lienChecklist = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lienChecklist).toBeVisible();
    await expect(confirmer).toBeDisabled();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.indisponible"]),
    ).toBeVisible();

    await capturer(page, "feuille-trois-manques", 375);
    await capturer(page, "feuille-trois-manques", 1280);

    // « ALLER AU COMMENTAIRE » — referme la feuille, y amène.
    await page
      .getByRole("button", {
        name: fr["terrain.terminer.confirmation.aller_commentaire"],
      })
      .click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.titre"]),
    ).toBeHidden();
    const champCommentaire = page.getByLabel(
      fr["terrain.rapport.commentaire_libelle"],
    );
    await expect(champCommentaire).toBeFocused();
    await champCommentaire.fill("zz9K27A Filtre remplacé.");
    await champCommentaire.blur();
    await expect(
      page.getByText(fr["terrain.rapport.enregistre"]),
    ).toBeVisible();

    // LE COMMENTAIRE NE MANQUE PLUS — signature et checklist, encore.
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_commentaire"]),
    ).toBeHidden();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_signature"]),
    ).toBeVisible();
    await expect(confirmer).toBeDisabled();

    // « ALLER À LA SIGNATURE ».
    await page
      .getByRole("button", {
        name: fr["terrain.terminer.confirmation.aller_signature"],
      })
      .click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.titre"]),
    ).toBeHidden();
    await page
      .getByRole("button", { name: fr["terrain.signature.option_absent"] })
      .click();
    const motif = page.getByLabel(fr["terrain.signature.motif_libelle"]);
    await motif.fill("zz9K27A client injoignable");
    await motif.blur();
    await expect(
      page.getByText(fr["terrain.signature.enregistre"]),
    ).toBeVisible();

    // NI LE COMMENTAIRE NI LA SIGNATURE NE MANQUENT PLUS — seule la
    // checklist bloque encore.
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    await expect(
      page.getByText(fr["terrain.terminer.confirmation.manque_signature"]),
    ).toBeHidden();
    await expect(lienChecklist).toBeVisible();
    await expect(confirmer).toBeDisabled();

    // LE LIEN REFERME LA FEUILLE, DÉPLIE LA TUILE ET Y SAUTE.
    await lienChecklist.click();
    await expect(
      page.getByRole("button", {
        name: fr["checklist.terrain.masquer_detail"],
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
        exact: true,
      })
      .click();

    // PLUS AUCUN MANQUE — « Confirmer la fin » se débloque.
    await cliquerTerminer(page);
    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();

    await capturer(page, "termine-apres-les-trois-manques", 375);
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, MODE AVION — les mêmes manques depuis la copie locale, temps qui défile (M3)", async ({
  page,
  context,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9K27B", true);

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    // CHARGÉE EN LIGNE D'ABORD (même patron que 9k23) : le mode avion coupe
    // le réseau sur une page déjà servie.
    await page.goto(`/terrain/${scene.interventionId}`);
    await expect(
      page.getByRole("button", { name: fr["terrain.terminer.bouton"] }),
    ).toBeVisible();

    await context.setOffline(true);

    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();

    // M3 — LE TEMPS DÉFILE (HH:MM:SS), JAMAIS UNE VALEUR FIGÉE : le segment
    // posé par `creerScene` est encore OUVERT.
    await expect(
      page.getByText(
        new RegExp(
          `${fr["terrain.terminer.confirmation.temps"]} \\d{2}:\\d{2}:\\d{2}`,
        ),
      ),
    ).toBeVisible();

    const confirmer = page.getByRole("button", {
      name: fr["terrain.terminer.confirmation.oui"],
    });
    await expect(confirmer).toBeDisabled();
    const lienChecklist = page.getByRole("button", {
      name: libelleAttenduDuPoint(scene),
    });
    await expect(lienChecklist).toBeVisible();

    await capturer(page, "mode-avion-trois-manques", 375);

    // REFERME LA FEUILLE SANS COMMENTAIRE NI SIGNATURE — vérifie que le
    // verdict LOCAL hors réseau (pas seulement l'écran) bloque aussi.
    await page
      .getByRole("button", { name: fr["terrain.terminer.confirmation.non"] })
      .click();

    await page
      .getByLabel(fr["terrain.rapport.commentaire_libelle"])
      .fill("zz9K27B Filtre remplacé.");
    await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
    await page
      .getByRole("button", { name: fr["terrain.signature.option_absent"] })
      .click();
    await page
      .getByLabel(fr["terrain.signature.motif_libelle"])
      .fill("zz9K27B client injoignable");
    await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();

    await page
      .getByRole("button", {
        name: fr["checklist.terrain.afficher_detail"],
      })
      .click();
    await page
      .getByRole("button", {
        name: fr["checklist.terrain.option_conforme"],
        exact: true,
      })
      .click();

    // PLUS AUCUN MANQUE — mis en file, hors réseau.
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
