import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * 9F4H6D-PRESTATIONS-SANS-PERTE — LIVRABLES MANQUANTS DE 9F4H6C, DE BOUT EN
 * BOUT (passation : « aucune e2e du décocher-après-envoi ni de la réponse
 * perdue (point 1), aucune e2e ni capture du bouton « Retirer cette
 * saisie » (D142) »).
 *
 * ## POINT 4(a) — COCHER PUIS ENVOYER, PUIS DÉCOCHER
 *
 * Hors réseau, cocher C puis « Envoyer » (réseau revenu) écrit C sur le
 * serveur. Décocher C ensuite doit retirer C du serveur — que ce second
 * aller-retour aboutisse normalement ou que sa RÉPONSE SE PERDE après avoir
 * atteint le serveur (`route.fetch()` puis `route.abort()` : le serveur a
 * bien traité la requête, le navigateur n'en voit jamais la réponse).
 *
 * ## POINT 4(b) — D142, DE BOUT EN BOUT
 *
 * Une prestation cochée hors réseau, retirée du CATALOGUE pendant que la
 * fiche était ouverte (le scénario même du point 1 de ce lot) : l'envoi la
 * refuse, « Retirer cette saisie » apparaît, « Revenir » ne change rien,
 * « Retirer » la retire — et la SIGNATURE et « TERMINER », restées en file
 * DERRIÈRE elle dans le pipeline (compteur < rapport < prestations < photo
 * < signature < terminer), partent enfin au prochain « Envoyer ». Une
 * saisie SEULEMENT en attente (jamais encore refusée) n'a PAS ce bouton.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H6D = uuidv7();
const SITE_9F4H6D = uuidv7();
const INTERVENTION_COCHER_ENVOYER_DECOCHER = uuidv7();
const INTERVENTION_DECOCHER_REPONSE_PERDUE = uuidv7();
const INTERVENTION_D142 = uuidv7();
const INTERVENTION_RAFRAICHISSEMENT = uuidv7();
const PRESTATION_C = uuidv7();
const PRESTATION_C2 = uuidv7();
const PRESTATION_EPHEMERE = uuidv7();
const PRESTATION_PROPRE = uuidv7();
const PRESTATION_AJOUTEE_PAR_LE_BUREAU = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9F4H6D,
        societe_id: societeId,
        raison_sociale: "9F4H6D client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H6D,
        societe_id: societeId,
        client_id: CLIENT_9F4H6D,
        agence_id: agence.id,
        libelle: "9F4H6D site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_C,
        societe_id: societeId,
        code: "9F4H6D-C",
        libelle: fr["terrain9f4h6d.e2e.prestation_c"],
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_C2,
        societe_id: societeId,
        code: "9F4H6D-C2",
        libelle: fr["terrain9f4h6d.e2e.prestation_c2"],
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_EPHEMERE,
        societe_id: societeId,
        code: "9F4H6D-EPH",
        libelle: fr["terrain9f4h6d.e2e.prestation_ephemere"],
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_PROPRE,
        societe_id: societeId,
        code: "9F4H6D-PROPRE",
        libelle: fr["terrain9f4h6d.e2e.prestation_propre"],
        actif: true,
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_AJOUTEE_PAR_LE_BUREAU,
        societe_id: societeId,
        code: "9F4H6D-BUREAU",
        libelle: fr["terrain9f4h6d.e2e.prestation_bureau"],
        actif: true,
      },
    });

    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9F4H6D,
      site_id: SITE_9F4H6D,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9F4H6D — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_COCHER_ENVOYER_DECOCHER, ...commun },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_DECOCHER_REPONSE_PERDUE, ...commun },
    });
    // D142 — EN COURS, avec un segment déjà fermé (temps mesuré > 0), pour
    // que « Terminer » soit localement acceptable dès la signature saisie.
    await client.intervention.create({
      data: { id: INTERVENTION_D142, ...commun, statut: "en_cours" },
    });
    await client.segmentTravail.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_D142,
        utilisateur_id: technicienId,
        debut: new Date(Date.now() - 60 * 60_000),
        fin: new Date(),
      },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_RAFRAICHISSEMENT, ...commun },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [
        INTERVENTION_COCHER_ENVOYER_DECOCHER,
        INTERVENTION_DECOCHER_REPONSE_PERDUE,
        INTERVENTION_D142,
        INTERVENTION_RAFRAICHISSEMENT,
      ],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9F4H6D,
    );
    await client.prestation.deleteMany({
      where: {
        id: {
          in: [
            PRESTATION_C,
            PRESTATION_C2,
            PRESTATION_EPHEMERE,
            PRESTATION_PROPRE,
            PRESTATION_AJOUTEE_PAR_LE_BUREAU,
          ],
        },
      },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H6D } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H6D } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H6D-PRESTATIONS-SANS-PERTE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

async function prestationsServeur(
  interventionId: string,
): Promise<readonly string[]> {
  const client = admin();
  try {
    const lignes = await client.interventionPrestation.findMany({
      where: { intervention_id: interventionId },
      select: { prestation_id: true },
    });
    return lignes.map((l) => l.prestation_id);
  } finally {
    await client.$disconnect();
  }
}

test("point 4(a) — hors réseau cocher C, Envoyer, puis décocher C : C est retirée du serveur", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_COCHER_ENVOYER_DECOCHER}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  const caseC = page.getByRole("checkbox", {
    name: fr["terrain9f4h6d.e2e.prestation_c"],
    exact: true,
  });

  await context.setOffline(true);
  await caseC.check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  await context.setOffline(false);
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  expect(
    await prestationsServeur(INTERVENTION_COCHER_ENVOYER_DECOCHER),
  ).toEqual([PRESTATION_C]);

  // DÉCOCHER C, EN LIGNE — doit retirer C du serveur, jamais rester silencieux.
  await caseC.uncheck();
  await expect
    .poll(() => prestationsServeur(INTERVENTION_COCHER_ENVOYER_DECOCHER))
    .toEqual([]);
});

test("point 4(a) — décocher une prestation DÉJÀ sur le serveur, réponse perdue : elle est quand même retirée", async ({
  page,
}) => {
  await connecterLeTechnicien(page);

  // C2 EST DÉJÀ SUR LE SERVEUR AVANT MÊME L'OUVERTURE DE LA FICHE.
  const bureau = admin();
  try {
    await bureau.interventionPrestation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_DECOCHER_REPONSE_PERDUE,
        prestation_id: PRESTATION_C2,
      },
    });
  } finally {
    await bureau.$disconnect();
  }

  await page.goto(`/terrain/${INTERVENTION_DECOCHER_REPONSE_PERDUE}`);
  const caseC2 = page.getByRole("checkbox", {
    name: fr["terrain9f4h6d.e2e.prestation_c2"],
    exact: true,
  });
  await expect(caseC2).toBeChecked();

  // LA RÉPONSE SE PERD, APRÈS QUE LE SERVEUR A BIEN TRAITÉ LA REQUÊTE — le
  // retrait part réellement (`route.fetch()`), seule sa RÉPONSE est avortée
  // avant d'atteindre le navigateur.
  await page.route(
    `**/api/terrain/${INTERVENTION_DECOCHER_REPONSE_PERDUE}/prestations`,
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
  );
  await caseC2.uncheck();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // LE RETRAIT A POURTANT ATTEINT LE SERVEUR.
  expect(
    await prestationsServeur(INTERVENTION_DECOCHER_REPONSE_PERDUE),
  ).toEqual([]);

  // LA FILE GARDE UNE SAISIE — JAMAIS LE SILENCE (point 1, 9F4H6C). Le
  // réseau revient, « Envoyer » la rejoue : même un retrait déjà abouti ne
  // doit rien casser au rejeu (« retirer une prestation absente est sans
  // effet »).
  await page.unroute(
    `**/api/terrain/${INTERVENTION_DECOCHER_REPONSE_PERDUE}/prestations`,
  );
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();
  expect(
    await prestationsServeur(INTERVENTION_DECOCHER_REPONSE_PERDUE),
  ).toEqual([]);
});

test("point 4(b) — D142 de bout en bout : une saisie en attente n'a pas le bouton, un refus l'a, « Revenir » ne change rien, « Retirer » libère la signature et Terminer", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_D142}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  await context.setOffline(true);

  // 1 — LA PRESTATION ÉPHÉMÈRE, COCHÉE HORS RÉSEAU : SEULEMENT EN ATTENTE,
  // AUCUN BOUTON « RETIRER CETTE SAISIE » (point 4(b) — ce bouton n'existe
  // que pour un REFUS, jamais pour une simple attente).
  await page
    .getByRole("checkbox", { name: fr["terrain9f4h6d.e2e.prestation_ephemere"] })
    .check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.file.retirer_bouton"] }),
  ).not.toBeVisible();

  // 2 — LA SIGNATURE, « CLIENT ABSENT », HORS RÉSEAU — DERRIÈRE LES
  // PRESTATIONS DANS LE PIPELINE.
  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("Client non présent sur site.");
  await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();

  // 3 — « TERMINER », HORS RÉSEAU — TOUT AU BOUT DU PIPELINE.
  await page
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    page.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();

  // LE BUREAU RETIRE LA PRESTATION DU CATALOGUE PENDANT QUE LA FICHE EST
  // OUVERTE — exactement le scénario du point 1 de ce lot.
  const bureau = admin();
  try {
    await bureau.prestation.delete({ where: { id: PRESTATION_EPHEMERE } });
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(false);
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();

  // 4 — LE REFUS, EN CLAIR, AVEC SON BOUTON.
  await expect(page.getByText(fr["terrain.prestations.refus"])).toBeVisible();
  const boutonRetirer = page.getByRole("button", {
    name: fr["terrain.file.retirer_bouton"],
  });
  await expect(boutonRetirer).toBeVisible();
  await capturer(page, "d142-refus-avec-bouton", 375);
  await capturer(page, "d142-refus-avec-bouton", 1280);

  // LA SIGNATURE ET « TERMINER » N'ONT PAS ÉTÉ TENTÉS — restés en file
  // derrière le refus (le pipeline s'est arrêté à « prestations »).
  await expect
    .poll(async () => {
      const client = admin();
      try {
        return await client.intervention.findUniqueOrThrow({
          where: { id: INTERVENTION_D142 },
          select: { statut: true },
        });
      } finally {
        await client.$disconnect();
      }
    })
    .toEqual({ statut: "en_cours" });

  // 5 — « RETIRER CETTE SAISIE », LA QUESTION.
  await boutonRetirer.click();
  await expect(
    page.getByText(fr["terrain.file.retirer_confirmation"]),
  ).toBeVisible();
  await capturer(page, "d142-confirmation-retrait", 375);
  await capturer(page, "d142-confirmation-retrait", 1280);

  // 6 — « REVENIR » NE CHANGE RIEN : le refus est toujours là.
  await page
    .getByRole("button", { name: fr["terrain.file.retirer_revenir"] })
    .click();
  await expect(page.getByText(fr["terrain.prestations.refus"])).toBeVisible();

  // 7 — « RETIRER », CONFIRMÉ CETTE FOIS.
  await page
    .getByRole("button", { name: fr["terrain.file.retirer_bouton"] })
    .click();
  await page
    .getByRole("button", { name: fr["terrain.file.retirer_confirmer"] })
    .click();
  await expect(
    page.getByText(fr["terrain.prestations.refus"]),
  ).not.toBeVisible();

  // 8 — AU PROCHAIN « ENVOYER », LA SIGNATURE ET « TERMINER » PARTENT.
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_D142 },
      select: { statut: true },
    });
    expect(intervention.statut).toBe("terminee");
    const signatures = await verif.interventionSignature.findMany({
      where: { intervention_id: INTERVENTION_D142 },
      select: { issue: true },
    });
    expect(signatures.map((s) => s.issue)).toEqual(["client_absent"]);
    // LA PRESTATION REFUSÉE N'A JAMAIS ÉTÉ ÉCRITE.
    expect(await prestationsServeur(INTERVENTION_D142)).toEqual([]);
  } finally {
    await verif.$disconnect();
  }

  await capturer(page, "d142-liste-apres-envoi", 375);
  await capturer(page, "d142-liste-apres-envoi", 1280);
});

test("point 2 — l'écran suit le serveur : un ajout du bureau, pendant que la fiche est ouverte, apparaît coché après rafraîchissement", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_RAFRAICHISSEMENT}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  const caseBureau = page.getByRole("checkbox", {
    name: fr["terrain9f4h6d.e2e.prestation_bureau"],
    exact: true,
  });
  const casePropre = page.getByRole("checkbox", {
    name: fr["terrain9f4h6d.e2e.prestation_propre"],
    exact: true,
  });
  await expect(caseBureau).not.toBeChecked();

  // LE BUREAU AJOUTE SA PRESTATION PENDANT QUE LA FICHE EST DÉJÀ OUVERTE —
  // cette fiche n'a RIEN fait localement pour elle.
  const bureau = admin();
  try {
    await bureau.interventionPrestation.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        intervention_id: INTERVENTION_RAFRAICHISSEMENT,
        prestation_id: PRESTATION_AJOUTEE_PAR_LE_BUREAU,
      },
    });
  } finally {
    await bureau.$disconnect();
  }

  await context.setOffline(true);
  await casePropre.check();
  await expect(
    page.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // RÉSEAU REVENU — « Envoyer » envoie la propre saisie du technicien ET
  // rafraîchit les props serveur (`router.refresh()`), SANS remonter ce
  // composant : l'ajout du bureau doit apparaître coché par ce seul
  // rafraîchissement.
  await context.setOffline(false);
  const boutonEnvoyer = page.getByRole("button", {
    name: /^Envoyer \(\d+\)$/,
  });
  await expect(boutonEnvoyer).toBeVisible();
  await boutonEnvoyer.click();
  await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

  await expect(caseBureau).toBeChecked();
  await expect(casePropre).toBeChecked();
  expect(
    new Set(await prestationsServeur(INTERVENTION_RAFRAICHISSEMENT)),
  ).toEqual(new Set([PRESTATION_PROPRE, PRESTATION_AJOUTEE_PAR_LE_BUREAU]));

  // LA LISTE DES PRESTATIONS ELLE-MÊME, PAS SEULEMENT LE HAUT DE LA FICHE —
  // ce que ce point éprouve est l'état des cases, jamais le bandeau « Tout
  // est envoyé. ».
  await caseBureau.scrollIntoViewIfNeeded();
  await capturer(page, "liste-prestations-apres-rafraichissement", 375);
  await capturer(page, "liste-prestations-apres-rafraichissement", 1280);
});
