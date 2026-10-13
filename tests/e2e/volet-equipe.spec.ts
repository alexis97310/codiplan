import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9ET-COMPTES-BUREAU-2 — LE VOLET « AJOUTER UNE PERSONNE », DE L'ÉCRAN AU
 * TABLEAU DES COMPTES DE BUREAU.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/e2e/acces-bureau.spec.ts` (9ET-COMPTES-BUREAU-1) prouve les deux
 * routes par requête directe — aucun écran n'existait encore. Celui-ci
 * prouve l'ÉCRAN : le volet s'ouvre, le choix « Compte de bureau » révèle
 * les bons champs, la soumission crée réellement le compte et le fait
 * apparaître dans l'onglet « Comptes de bureau », avec le bon badge d'accès.
 *
 * ## Ce que ce fichier NE mesure PAS (passation, « ce qui reste »)
 *
 * Le rattachement d'un courriel déjà connu dans une AUTRE société, et le
 * rendu à 375 px : non couverts par ce lot, faute de temps — voir la
 * passation.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9ET-`
 *
 * Deux comptes de bureau créés PAR L'ÉCRAN (jamais par requête directe,
 * jamais par `SCENE.*`), supprimés en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const NOM_SANS_LIEN = fr["volet9et.e2e.nom_sans_lien"];
const COURRIEL_SANS_LIEN = "compte.sans.lien@9etvolet.e2e.test";
const NOM_AVEC_LIEN = fr["volet9et.e2e.nom_avec_lien"];
const COURRIEL_AVEC_LIEN = "compte.avec.lien@9etvolet.e2e.test";

const UTILISATEUR_IDS: string[] = [];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (UTILISATEUR_IDS.length === 0) return;
  const client = admin();
  try {
    for (const utilisateurId of UTILISATEUR_IDS) {
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.utilisateurSociete.deleteMany({
        where: { utilisateur_id: utilisateurId },
      });
      await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
    }
  } finally {
    await client.$disconnect();
  }
});

test("le volet crée un compte de bureau ADV, qui apparaît dans l'onglet avec « Pas d'accès »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  await page.getByRole("link", { name: fr["equipe.ajouter_personne"] }).click();
  await page
    .getByRole("link", { name: fr["equipe.volet.compte_bureau"] })
    .click();

  const formulaire = page.locator('form[action="/api/equipe/bureau/creer"]');
  await expect(formulaire).toBeVisible();
  await formulaire.getByLabel(fr["equipe.nom"]).fill(NOM_SANS_LIEN);
  await formulaire.getByLabel(fr["equipe.email"]).fill(COURRIEL_SANS_LIEN);
  await formulaire.locator('select[name="role"]').selectOption(Role.adv);
  await formulaire
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/onglet=bureau/);
  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_SANS_LIEN },
      select: { id: true },
    });
    UTILISATEUR_IDS.push(identite.id);
  } finally {
    await client.$disconnect();
  }

  const ligne = page.getByRole("row").filter({ hasText: NOM_SANS_LIEN });
  await expect(ligne).toBeVisible();
  await expect(
    ligne.getByText(fr["equipe.acces.badge.aucun"], { exact: true }),
  ).toBeVisible();
});

test("l'interrupteur « envoyer le lien en l'ajoutant » fait apparaître le compte avec « Lien envoyé »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau");

  await page.getByRole("link", { name: fr["equipe.ajouter_personne"] }).click();
  await page
    .getByRole("link", { name: fr["equipe.volet.compte_bureau"] })
    .click();

  const formulaire = page.locator('form[action="/api/equipe/bureau/creer"]');
  await formulaire.getByLabel(fr["equipe.nom"]).fill(NOM_AVEC_LIEN);
  await formulaire.getByLabel(fr["equipe.email"]).fill(COURRIEL_AVEC_LIEN);
  await formulaire.locator('select[name="role"]').selectOption(Role.adv);
  await formulaire.getByLabel(fr["equipe.volet.envoyer_en_ajoutant"]).check();
  await formulaire
    .getByRole("button", { name: fr["equipe.creer_action"] })
    .click();
  await page.waitForLoadState("networkidle");

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_AVEC_LIEN },
      select: { id: true },
    });
    UTILISATEUR_IDS.push(identite.id);
  } finally {
    await client.$disconnect();
  }

  const ligne = page.getByRole("row").filter({ hasText: NOM_AVEC_LIEN });
  await expect(ligne).toBeVisible();
  await expect(
    ligne.getByText(fr["equipe.acces.badge.lien_envoye"], { exact: true }),
  ).toBeVisible();
});

test("un rôle sans « administrer_utilisateurs » (ADV) ne voit pas l'écran, et la route refuse", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/equipe");
  await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();

  const courrielTente = "tentative@9etvolet.e2e.test";
  const refus = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: "Tentative refusée", courriel: courrielTente, role: Role.adv },
    maxRedirects: 0,
  });
  expect(refus.status()).toBe(303);
  expect(refus.headers()["location"] ?? "").toContain("motif=auth.refus_droit");

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirst({
      where: { email: courrielTente },
      select: { id: true },
    });
    expect(identite).toBeNull();
  } finally {
    await client.$disconnect();
  }
});
