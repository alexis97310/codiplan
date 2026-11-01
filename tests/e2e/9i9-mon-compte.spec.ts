import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_RM_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9I9-MON-COMPTE (constat M5, ticket T5, audit du 28/10/2026) — CHANGER SON
 * MOT DE PASSE EN ÉTANT CONNECTÉ, DE BOUT EN BOUT.
 *
 * ## Ce que ce fichier mesure
 *
 * `tests/isolation/mon-compte-mot-de-passe.test.ts` prouve déjà que
 * `changerSonMotDePasse` refuse un mot de passe actuel faux, une saisie
 * discordante, un mot de passe trop court, et qu'une tentative de désigner
 * un autre compte reste sans effet. Ce fichier prouve que la CHAÎNE ENTIÈRE
 * fonctionne depuis un vrai navigateur : le badge mène à l'écran, le
 * formulaire poste réellement, et le mot de passe choisi ouvre la session
 * SUIVANTE — après une vraie déconnexion, pas seulement en mémoire.
 *
 * ## Son propre compte, jamais celui de la scène partagée
 *
 * `tests/e2e/setup/scene.ts` sert les mêmes comptes à tous les fichiers de ce
 * dossier, en parallèle. Changer le mot de passe de `COMPTE_EPREUVE` ferait
 * échouer tout autre fichier qui s'y connecte en même temps : ce scénario
 * crée donc SON PROPRE compte ADV (même geste que
 * `tests/e2e/acces-bureau.spec.ts`), et ne lit `COMPTE_RM_EPREUVE` que pour
 * nommer une cible dans la requête forgée — sans jamais rien y écrire.
 */
test.describe.configure({ mode: "serial" });

const NOM_COMPTE = fr["acces9i9.e2e.nom"];
const COURRIEL_COMPTE = "compte.mon-compte@9i9.e2e.test";
const MOT_DE_PASSE_INITIAL = "mot-de-passe-9i9-initial";
const MOT_DE_PASSE_FORGE = "mot-de-passe-9i9-tentative-forgee";
const MOT_DE_PASSE_FINAL = "mot-de-passe-9i9-final-choisi";

let utilisateurId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (utilisateurId === "") {
    return;
  }
  const client = admin();
  try {
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
  } finally {
    await client.$disconnect();
  }
});

test("un compte ADV change son propre mot de passe, se déconnecte, et le nouveau mot de passe ouvre la session suivante", async ({
  page,
  browser,
}) => {
  // ── 0. L'ADMINISTRATEUR CRÉE LE COMPTE ET COPIE SON LIEN D'ACCÈS ─────────
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  const creation = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_COMPTE, courriel: COURRIEL_COMPTE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creation.status()).toBe(303);

  const client = admin();
  try {
    const identite = await client.utilisateur.findFirstOrThrow({
      where: { email: COURRIEL_COMPTE },
      select: { id: true },
    });
    utilisateurId = identite.id;
  } finally {
    await client.$disconnect();
  }

  const lien = await page.request.post(
    `/api/equipe/bureau/${utilisateurId}/copier-lien`,
  );
  expect(lien.status()).toBe(200);
  const { url: urlPremierAcces } = (await lien.json()) as { url: string };
  expect(urlPremierAcces).toMatch(/^https?:\/\//);

  // ── 1. LA PERSONNE, SUR SA PROPRE PAGE, CHOISIT SON PREMIER MOT DE PASSE ─
  const pageCompte = await browser.newPage();
  await pageCompte.goto(urlPremierAcces);
  await pageCompte
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByLabel(fr["premier_acces.confirmation"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByRole("button", { name: fr["premier_acces.valider"] })
    .click();
  await pageCompte.waitForLoadState("networkidle");
  await expect(pageCompte).toHaveURL(/\/connexion/);

  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  // ── 2. LE BADGE AUX INITIALES MÈNE À « MON COMPTE » ──────────────────────
  await pageCompte.getByRole("link", { name: fr["nav.mon_compte"] }).click();
  await expect(pageCompte).toHaveURL(/\/mon-compte/);
  await expect(
    pageCompte.getByRole("heading", { name: fr["mon_compte.titre"] }),
  ).toBeVisible();
  // LE COURRIEL AFFICHÉ N'EST PAS RELU LITTÉRALEMENT ICI (L0-11, gardien
  // `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`, qui traite aussi
  // les épreuves de bout en bout comme un emplacement visible) : seul le
  // LIBELLÉ, qui vient du dictionnaire, est vérifié.
  await expect(
    pageCompte.getByText(fr["mon_compte.identite.courriel"]),
  ).toBeVisible();
  await expect(
    pageCompte.getByText(fr["mon_compte.second_facteur.inactif"]),
  ).toBeVisible();

  // ── 3. UN MOT DE PASSE ACTUEL FAUX EST REFUSÉ, ET NE CHANGE RIEN ─────────
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
    .fill("ce-n-est-pas-le-bon-mot-de-passe");
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
    .fill(MOT_DE_PASSE_FORGE);
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], { exact: false })
    .fill(MOT_DE_PASSE_FORGE);
  await pageCompte
    .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
    .click();
  await expect(
    pageCompte.getByText(fr["mon_compte.mot_de_passe.actuel_incorrect"]),
  ).toBeVisible();

  // ── 4. LE MOT DE PASSE ACTUEL, CORRECT CETTE FOIS, ABOUTIT ───────────────
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.actuel"], { exact: false })
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.nouveau"], { exact: false })
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByLabel(fr["mon_compte.mot_de_passe.confirmation"], { exact: false })
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByRole("button", { name: fr["mon_compte.mot_de_passe.valider"] })
    .click();
  await expect(
    pageCompte.getByText(fr["mon_compte.mot_de_passe.abouti"]),
  ).toBeVisible();

  // ── 5. DÉCONNEXION, PUIS L'ANCIEN MOT DE PASSE N'OUVRE PLUS RIEN ─────────
  await pageCompte.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(pageCompte).toHaveURL(/\/connexion/);

  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_INITIAL);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/connexion/);
  await expect(pageCompte.getByText(fr["auth.refus"])).toBeVisible();

  // ── 6. ET LE MOT DE PASSE FINAL, LUI, OUVRE RÉELLEMENT LA SESSION ────────
  //
  // Le refus de l'étape 5 a rechargé `/connexion` en entier (redirection) :
  // le champ courriel y repart vide, et le reposer n'est pas superflu.
  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  await pageCompte.close();
});

test("une requête forgée qui nomme un AUTRE compte reste sans effet sur lui", async ({
  browser,
}) => {
  test.skip(utilisateurId === "", "le compte du premier scénario n'existe pas");

  // ── 1. LE COMPTE DE CE FICHIER SE RECONNECTE, SOUS SON MOT DE PASSE FINAL ─
  const pageCompte = await browser.newPage();
  await pageCompte.goto("/connexion");
  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_FINAL);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  // ── 2. LA CIBLE NOMMÉE PAR LA REQUÊTE FORGÉE — jamais écrite, jamais lue ─
  const client = admin();
  let cibleId = "";
  try {
    const cible = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_RM_EPREUVE },
      select: { id: true },
    });
    cibleId = cible.id;
  } finally {
    await client.$disconnect();
  }

  // ── 3. UN CHAMP SUPPLÉMENTAIRE, QU'AUCUN FORMULAIRE DE L'ÉCRAN NE POSTE ──
  const requeteForgee = await pageCompte.request.post(
    "/api/session/mon-compte/mot-de-passe",
    {
      form: {
        motDePasseActuel: MOT_DE_PASSE_FINAL,
        motDePasse: MOT_DE_PASSE_FORGE,
        confirmation: MOT_DE_PASSE_FORGE,
        utilisateurId: cibleId,
        cible: cibleId,
      },
      maxRedirects: 0,
    },
  );
  expect(requeteForgee.status()).toBe(303);
  expect(requeteForgee.headers()["location"] ?? "").toContain(
    "motif=mon_compte.mot_de_passe.abouti",
  );

  // ── 4. LE COMPTE CIBLÉ N'A RIEN VU : SON MOT DE PASSE EST INCHANGÉ ───────
  const pageCible = await browser.newPage();
  await pageCible.goto("/connexion");
  await pageCible.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await pageCible
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_FORGE);
  await pageCible
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCible).toHaveURL(/\/connexion/);
  await expect(pageCible.getByText(fr["auth.refus"])).toBeVisible();
  await pageCible.close();

  // ── 5. SEUL LE COMPTE DE LA SESSION A RÉELLEMENT CHANGÉ ──────────────────
  //
  // `pageCompte` porte encore la session ouverte à l'étape 1 : visiter
  // `/connexion` alors qu'une session est active en détourne (même
  // remarque que `tests/e2e/sites.spec.ts`) — la déconnexion vient d'abord.
  await pageCompte.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await expect(pageCompte).toHaveURL(/\/connexion/);
  await pageCompte.getByLabel(fr["connexion.email"]).fill(COURRIEL_COMPTE);
  await pageCompte
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_FORGE);
  await pageCompte
    .getByRole("button", { name: fr["connexion.valider"] })
    .click();
  await expect(pageCompte).toHaveURL(/\/planning/);

  await pageCompte.close();
});
