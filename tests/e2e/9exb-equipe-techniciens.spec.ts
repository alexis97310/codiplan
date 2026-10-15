import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9EXB-EQUIPE-EPREUVES-CAPTURES, point 5 — LES ÉPREUVES E2E QUE 9EXA N'A PAS
 * ÉCRITES (passation de 9EX-EQUIPE-TECHNICIENS-MAQUETTE, « ce qui reste pour
 * 9EY », point 5).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `zz9EXB-` — un technicien créé en `beforeAll`,
 * ses habilitations, son compte ; tout est supprimé en `afterAll`. Aucune
 * ligne de `SCENE.*` n'est modifiée — seules les captures (point 1) et les
 * scénarios ADV/bureau réutilisent les comptes ACTIFS déjà ouverts par la
 * scène globale, en LECTURE seule.
 *
 * ## CE QUE CE FICHIER NE COUVRE PAS, ET POURQUOI (budget de temps)
 *
 * Le scénario (b) du point 5 (« À venir » : 0 → aucune, N avec accès non
 * actif → orange + sans accès à l'application) exige une scène
 * client/site/intervention complète en plus du technicien — hors du budget
 * de ce lot. Voir la passation.
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "zz9EXB-";
const EMAIL_ETATS = `${PREFIXE.toLowerCase()}etats@codima.test`;
const NOM_ETATS = `${PREFIXE}Technicien états`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let societeId = "";
let agenceId = "";
let utilisateurId = "";
const habilitationIds: string[] = [];

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, actif: true },
      select: { id: true },
    });
    agenceId = agence.id;

    const utilisateur = await client.utilisateur.create({
      data: { id: uuidv7(), nom: NOM_ETATS, email: EMAIL_ETATS },
      select: { id: true },
    });
    utilisateurId = utilisateur.id;

    await client.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        societe_id: societeId,
        role: "technicien",
      },
    });
    await client.technicien.create({
      data: {
        id: uuidv7(),
        societe_id: societeId,
        utilisateur_id: utilisateurId,
        agence_id: agenceId,
        actif: true,
        statut_ressource: "salarie",
      },
    });

    const maintenant = new Date();
    const hier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
    const dans30Jours = new Date(
      maintenant.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const dans400Jours = new Date(
      maintenant.getTime() + 400 * 24 * 60 * 60 * 1000,
    );
    const habilitations = [
      { code: `${PREFIXE}AAA`, date_expiration: hier },
      { code: `${PREFIXE}BBB`, date_expiration: dans30Jours },
      { code: `${PREFIXE}CCC`, date_expiration: dans400Jours },
    ];
    for (const h of habilitations) {
      const habilitation = await client.habilitation.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          code: h.code,
          libelle: `Habilitation ${h.code}`,
          actif: true,
        },
        select: { id: true },
      });
      habilitationIds.push(habilitation.id);
      await client.technicienHabilitation.create({
        data: {
          id: uuidv7(),
          societe_id: societeId,
          utilisateur_id: utilisateurId,
          habilitation_id: habilitation.id,
          date_obtention: hier,
          date_expiration: h.date_expiration,
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") return;
  const client = admin();
  try {
    await client.technicienHabilitation.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    for (const id of habilitationIds) {
      await client.habilitation.deleteMany({ where: { id } });
    }
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1 OR utilisateur_id = $1::uuid`,
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
    await client.technicien.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await client.$disconnect();
  }
});

test("(a) les trois tags d'habilitation, triés par code, avec leur couleur", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  const ligne = page.locator("tr", { hasText: NOM_ETATS });
  await expect(ligne).toBeVisible();
  const texte = await ligne.innerText();
  const rangAAA = texte.indexOf(`${PREFIXE}AAA`);
  const rangBBB = texte.indexOf(`${PREFIXE}BBB`);
  const rangCCC = texte.indexOf(`${PREFIXE}CCC`);
  expect(rangAAA).toBeGreaterThan(-1);
  expect(rangBBB).toBeGreaterThan(rangAAA);
  expect(rangCCC).toBeGreaterThan(rangBBB);
  expect(texte).toContain(fr["equipe.tableau.habilitation.expiree_prefixe"]);
  expect(texte).toContain(fr["equipe.tableau.habilitation.expire_prefixe"]);
  expect(texte).toContain(fr["equipe.tableau.habilitation.jusquau_prefixe"]);
});

test("(c) les quatre états d'accès, dont « Lien expiré » (journal antidaté)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  // ── AUCUN ─────────────────────────────────────────────────────────────
  let ligne = page.locator("tr", { hasText: NOM_ETATS });
  await expect(
    ligne.getByText(fr["equipe.acces.badge.aucun"], { exact: true }),
  ).toBeVisible();

  // ── LIEN ENVOYÉ — le bouton « Envoyer le lien d'accès » le déclenche ───
  await ligne
    .locator(`form[action="/api/equipe/${utilisateurId}/envoyer-acces"]`)
    .getByRole("button")
    .click();
  await page.waitForLoadState("networkidle");
  await page.goto("/parametres/equipe");
  ligne = page.locator("tr", { hasText: NOM_ETATS });
  await expect(
    ligne.getByText(fr["equipe.acces.badge.lien_envoye"], { exact: true }),
  ).toBeVisible();

  // ── LIEN EXPIRÉ — antidater le compte ET le journal (> 1 heure) ────────
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `UPDATE "compte" SET cree_le = now() - interval '2 hours' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
    await client.$executeRawUnsafe(
      `UPDATE "journal_acces" SET horodatage = now() - interval '2 hours' WHERE detail LIKE '%cible:' || $1`,
      utilisateurId,
    );
  } finally {
    await client.$disconnect();
  }
  await page.goto("/parametres/equipe");
  ligne = page.locator("tr", { hasText: NOM_ETATS });
  await expect(
    ligne.getByText(fr["equipe.acces.badge.lien_expire"], { exact: true }),
  ).toBeVisible();

  // ── ACTIF — poser un mot de passe directement (court-circuite Better
  //    Auth, seul le JUGEMENT D'ÉCRAN sur `mot_de_passe IS NOT NULL` est
  //    visé ici, pas la chaîne de premier accès déjà éprouvée ailleurs) ───
  const client2 = admin();
  try {
    await client2.$executeRawUnsafe(
      `UPDATE "compte" SET mot_de_passe = 'empreinte-9exb' WHERE utilisateur_id = $1::uuid`,
      utilisateurId,
    );
  } finally {
    await client2.$disconnect();
  }
  await page.goto("/parametres/equipe");
  ligne = page.locator("tr", { hasText: NOM_ETATS });
  await expect(
    ligne.getByText(fr["equipe.acces.badge.actif"], { exact: true }),
  ).toBeVisible();

  // ── (d, VOLET TECHNICIEN) — LE MENU « … » ENVOIE UN NOUVEAU LIEN, LE
  //    BANDEAU NOMME LE DESTINATAIRE ───────────────────────────────────────
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await page
    .getByRole("menuitem", { name: fr["equipe.menu.nouveau_lien"] })
    .click();
  const dialogue = page.getByRole("dialog");
  await dialogue
    .getByRole("button", { name: fr["equipe.dialogue.envoyer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(`${fr["equipe.acces.envoye"]} ${EMAIL_ETATS}`),
  ).toBeVisible();
});

test("(d, VOLET BUREAU) — le menu « … » d'un compte de bureau ACTIF envoie un nouveau lien, le bandeau nomme le destinataire", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe?onglet=bureau");
  await expect(
    page.getByRole("columnheader", {
      name: fr["equipe.bureau.colonne.personne"],
    }),
  ).toBeVisible();

  // Le compte de l'administrateur lui-même — déjà ACTIF (scène globale) :
  // sa ligne porte le menu « … », jamais le bouton « Envoyer »/« Renvoyer ».
  const ligne = page.locator("tr", { hasText: COMPTE_ADMIN_SOCIETE_EPREUVE });
  await ligne.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await page
    .getByRole("menuitem", { name: fr["equipe.menu.nouveau_lien"] })
    .click();
  const dialogue = page.getByRole("dialog");
  await dialogue
    .getByRole("button", { name: fr["equipe.dialogue.envoyer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(
      `${fr["equipe.acces.envoye"]} ${COMPTE_ADMIN_SOCIETE_EPREUVE}`,
    ),
  ).toBeVisible();
});

test("(e) à 375px : les cartes sont visibles, le tableau est caché, aucun débordement horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1200 });
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");

  await expect(page.locator("ul[aria-label]").first()).toBeVisible();
  await expect(page.locator("table").first()).toBeHidden();

  const largeurDocument = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(largeurDocument).toBeLessThanOrEqual(375);
});

test("(f) l'ADV n'a ni bouton ni route : l'écran Équipe refuse entièrement", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/equipe");
  await expect(page.getByText(fr["auth.refus_droit"])).toBeVisible();

  // ET AU SERVEUR, DIRECTEMENT — la route elle-même refuse, pas seulement
  // l'écran qui la cache (même mesure que `droits-rm-rs.spec.ts`).
  const reponse = await page.request.post(
    `/api/equipe/${utilisateurId}/nouveau-lien`,
  );
  expect(reponse.url()).toContain("motif=auth.refus_droit");
});
