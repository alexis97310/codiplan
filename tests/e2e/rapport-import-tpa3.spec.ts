import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { libelleVoirLesLignes } from "@/app/(back-office)/imports/presentation";
import { fr } from "@/lib/i18n";

import {
  NOMBRE_REJETS_GROUPES,
  PREFIXE_TPA3,
  fabriquerLeClasseurTpa3LigneValide,
  fabriquerLeClasseurTpa3RejetsGroupes,
} from "./setup/classeur-tpa3";
import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE RAPPORT D'UN LOT, RÉÉCRIT PAR TP-A3-RAPPORT-IMPORT (audit du 28/09/2026).
 *
 * Quatre faits, que les scénarios existants ne pouvaient pas mesurer :
 *   - vingt rejets du même motif se regroupent en UN SEUL groupe replié
 *     (PA-55), avec le lien de téléchargement toujours présent ;
 *   - l'annulation passe par un dialogue : « Revenir » ne change rien,
 *     confirmer annule réellement (PA-56) ;
 *   - « Imports disponibles » ne montre plus ni le bouton de modèle inerte,
 *     ni le type Contacts (PA-48, PA-51) ;
 *   - un lot introuvable rend le gabarit `Page` complet (PA-58).
 *
 * **Aucune fixture `SCENE.*`** : chaque classeur est fabriqué (I9), les
 * codes externes sont préfixés `TPA3-` ; le client du scénario d'annulation
 * porte le préfixe `TPA3-annulation-`, propre à ce fichier (le jumeau
 * `captures-tpa3-rapport-import.spec.ts` tourne en parallèle sous
 * `fullyParallel`, avec son propre préfixe `TPA3-capture-applique-` — un
 * nettoyage sur `TPA3-` seul effacerait aussi ses fiches). Les lots créés
 * par CE fichier sont nettoyés par leur PROPRE id, et la fiche client créée
 * puis appliquée (que l'annulation ne défait pas toujours) par son préfixe.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE_ANNULATION = `${PREFIXE_TPA3}annulation-`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let idsDesLots: string[] = [];

test.afterEach(async () => {
  const client = admin();
  try {
    if (idsDesLots.length > 0) {
      // Cascade sur `import_lot_ligne` (schema.prisma, `onDelete: Cascade`).
      await client.importLot.deleteMany({ where: { id: { in: idsDesLots } } });
    }
    await client.client.deleteMany({
      where: { code_externe: { startsWith: PREFIXE_ANNULATION } },
    });
  } finally {
    await client.$disconnect();
  }
  idsDesLots = [];
});

test("vingt rejets du même motif font UN groupe replié, avec le lien de téléchargement", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "tpa3-rejets-groupes.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurTpa3RejetsGroupes(),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();

  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
  idsDesLots.push(/\/imports\/([0-9a-f-]{36})$/.exec(page.url())![1]);

  const groupes = page.locator("[data-groupe-motif]");
  await expect(groupes).toHaveCount(1);
  const groupe = groupes.first();
  await expect(groupe).toContainText(fr["imports.motif.saisie_refusee"]);
  await expect(groupe).toContainText(
    libelleVoirLesLignes(NOMBRE_REJETS_GROUPES),
  );

  // REPLIÉ : les vingt lignes sont dans le DOM (le tableau ne se reconstruit
  // pas à l'ouverture) mais ne sont PAS visibles avant qu'on ouvre le groupe.
  await expect(groupe.locator("tr[data-rang]").first()).toBeHidden();

  await groupe.locator("summary").click();
  await expect(groupe.locator("tr[data-rang]").first()).toBeVisible();
  await expect(page.locator("tr[data-rang]:visible")).toHaveCount(
    NOMBRE_REJETS_GROUPES,
  );

  await expect(
    page.getByRole("link", { name: fr["imports.telecharger_rejets"] }),
  ).toBeVisible();
});

test("« Annuler ce lot » ouvre un dialogue ; « Revenir » ne change rien, confirmer annule", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const code = `${PREFIXE_ANNULATION}${Date.now()}`;
  await page.goto("/imports");
  await page.locator('input[name="classeur"]').setInputFiles({
    name: "tpa3-ligne-valide.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await fabriquerLeClasseurTpa3LigneValide(code),
  });
  await page.getByRole("button", { name: fr["imports.controler"] }).click();
  await expect(page).toHaveURL(/\/imports\/[0-9a-f-]{36}$/);
  idsDesLots.push(/\/imports\/([0-9a-f-]{36})$/.exec(page.url())![1]);

  await page.getByRole("button", { name: fr["imports.appliquer"] }).click();
  await expect(page.getByText(fr["imports.applique"])).toBeVisible();
  const statutApplique = page.locator('[data-statut="applique"]');
  await expect(statutApplique).toBeVisible();

  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  const dialogue = page.getByRole("dialog");
  await expect(dialogue).toBeVisible();

  // « Revenir » ferme le dialogue SANS rien annuler.
  await page
    .getByRole("button", { name: fr["imports.annuler_revenir"] })
    .click();
  await expect(dialogue).toBeHidden();
  await expect(statutApplique).toBeVisible();

  // Confirmer annule réellement.
  await page.getByRole("button", { name: fr["imports.annuler"] }).click();
  await page
    .getByRole("button", { name: fr["imports.annuler_confirmer"] })
    .click();
  await expect(page.getByText(fr["imports.annule"])).toBeVisible();
});

test("« Imports disponibles » ne montre plus le modèle inerte ni le type Contacts", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/imports");
  await expect(page.locator('li[data-type="contacts"]')).toHaveCount(0);
  await expect(page.locator('li[data-complet="0"]')).toHaveCount(0);
  await expect(page.getByText(fr["imports.modele_indisponible"])).toHaveCount(
    0,
  );
});

test("un lot introuvable rend le gabarit complet — titre, retour, message", async ({
  page,
}) => {
  await ouvrirUneSession(page);

  await page.goto("/imports/00000000-0000-0000-0000-000000000000");
  await expect(
    page.getByRole("heading", { name: fr["imports.lot_titre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["imports.lot_retour"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["imports.lot_introuvable"])).toBeVisible();
  await expect(page.locator("main#contenu")).toBeVisible();

  await page.goto("/imports/pas-un-id");
  await expect(
    page.getByRole("heading", { name: fr["imports.lot_titre"] }),
  ).toBeVisible();
  await expect(page.getByText(fr["imports.lot_introuvable"])).toBeVisible();
});
