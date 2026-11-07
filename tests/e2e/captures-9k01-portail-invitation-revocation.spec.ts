import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, Role as RolePrisma } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * LES CAPTURES DE 9K01-PORTAIL-INVITATION-REVOCATION (point 5) — LA CARTE
 * « ACCÈS PORTAIL », TROIS ISSUES D'UNE IDENTITÉ CONNUE D'UNE AUTRE SOCIÉTÉ
 * (C1, étude du 08/11, décision d'Alexis du 08/11 ~09:00).
 *
 * **APRÈS seulement** (mémoire « captures-avant-apres-e2e ») : les trois
 * scénarios n'existaient PAS avant ce ticket — `inviterClientAuPortail` ne
 * consultait alors que la société ACTIVE, jamais une autre (C1). Il n'y a
 * donc rien à capturer « avant » : les deux premières scènes (b)/(c) auraient
 * été ACCEPTÉES par l'ancien code, pas refusées — une capture AVANT
 * montrerait l'écran de succès, pas celui qu'on documente ici.
 *
 * Trois scènes, sur la société CODIMA-EU (« B ») pour ne jamais confondre
 * avec la société active de l'épreuve, CODIMA-NC (« A ») :
 *
 *   (a) EMAIL_CLIENT_ACTIF — un compte CLIENT de B, mot de passe déjà posé —
 *       invité depuis A : ACCEPTÉ, « accès immédiat » (`clients.acces.deja_actif`).
 *   (b) EMAIL_CLIENT_EN_ATTENTE — un compte CLIENT de B, PAS encore activé —
 *       invité depuis A : REFUSÉ (`clients.acces.refus.compte_connu_autre_societe`).
 *   (c) EMAIL_EMPLOYE — un compte EMPLOYÉ (interne) de B — invité depuis A :
 *       REFUSÉ, avec le MÊME message que (b) — `identiteExclusiveALaSociete`
 *       (D226) ne rend qu'un booléen, jamais LAQUELLE des deux tables a
 *       répondu (voir l'en-tête de `inviterClientAuPortail`,
 *       `lib/auth/lien-d-acces.ts`, et la passation de ce lot). Les deux
 *       captures existent néanmoins séparément : le champ courriel, lui,
 *       reste visible et distingue les deux tentatives à l'écran.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K01 ?? "";
const EMAIL_CLIENT_ACTIF = "9k01-client-actif-eu@codima.test";
const EMAIL_CLIENT_EN_ATTENTE = "9k01-client-attente-eu@codima.test";
const EMAIL_EMPLOYE = "9k01-employe-eu@codima.test";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function cibleDeLEpreuve(
  admin: PrismaClient,
): Promise<{ clientId: string; societeId: string }> {
  const utilisateur = await admin.utilisateur.findFirstOrThrow({
    where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
    select: { id: true },
  });
  const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
    where: { utilisateur_id: utilisateur.id },
    select: { societe_id: true },
  });
  const client = await admin.client.findFirstOrThrow({
    where: { societe_id: utilisateurSociete.societe_id },
    select: { id: true },
  });
  return { clientId: client.id, societeId: utilisateurSociete.societe_id };
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const { societeId: societeEuId } = await (async () => {
      const societe = await admin.societe.findFirstOrThrow({
        where: { code: "CODIMA-EU" },
        select: { id: true },
      });
      return { societeId: societe.id };
    })();
    const clientEu = await admin.client.findFirstOrThrow({
      where: { societe_id: societeEuId },
      select: { id: true },
    });

    const emails = [EMAIL_CLIENT_ACTIF, EMAIL_CLIENT_EN_ATTENTE, EMAIL_EMPLOYE];

    // IDEMPOTENT — un relancement retrouve les mêmes identités plutôt que de
    // buter sur l'unicité du courriel (même recette que 9J21).
    await admin.utilisateurClient.deleteMany({
      where: { utilisateur: { email: { in: emails } } },
    });
    await admin.utilisateurSociete.deleteMany({
      where: { utilisateur: { email: EMAIL_EMPLOYE } },
    });
    await admin.compte.deleteMany({
      where: { utilisateur: { email: { in: emails } } },
    });
    await admin.utilisateur.deleteMany({ where: { email: { in: emails } } });

    // ── (a) UN COMPTE CLIENT DE B, DÉJÀ ACTIF (mot de passe posé) ───────────
    const clientActifId = uuidv7();
    await admin.utilisateur.create({
      data: {
        id: clientActifId,
        nom: "Client EU déjà actif",
        email: EMAIL_CLIENT_ACTIF,
      },
    });
    await admin.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: clientActifId,
        emetteur: "local:credential",
        compte_externe_id: clientActifId,
        fournisseur_id: "credential",
        mot_de_passe: "empreinte-de-capture",
      },
    });
    await admin.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: clientActifId,
        client_id: clientEu.id,
        societe_id: societeEuId,
        actif: true,
      },
    });

    // ── (b) UN COMPTE CLIENT DE B, PAS ENCORE ACTIVÉ (compte au repos) ──────
    const clientEnAttenteId = uuidv7();
    await admin.utilisateur.create({
      data: {
        id: clientEnAttenteId,
        nom: "Client EU en attente",
        email: EMAIL_CLIENT_EN_ATTENTE,
      },
    });
    await admin.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: clientEnAttenteId,
        emetteur: "local:credential",
        compte_externe_id: clientEnAttenteId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await admin.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: clientEnAttenteId,
        client_id: clientEu.id,
        societe_id: societeEuId,
        actif: true,
      },
    });

    // ── (c) UN COMPTE EMPLOYÉ (INTERNE) DE B ────────────────────────────────
    const employeId = uuidv7();
    await admin.utilisateur.create({
      data: { id: employeId, nom: "Employé EU", email: EMAIL_EMPLOYE },
    });
    await admin.utilisateurSociete.create({
      data: {
        id: uuidv7(),
        utilisateur_id: employeId,
        societe_id: societeEuId,
        role: RolePrisma.adv,
      },
    });
  } finally {
    await admin.$disconnect();
  }
}

let clientId = "";

test.beforeAll(async () => {
  await preparerLaScene();
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    ({ clientId } = await cibleDeLEpreuve(admin));
  } finally {
    await admin.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    // ── (b) REFUS — compte client de B, pas encore activé ────────────────
    test(`capture — refus : compte connu d'une autre société, pas encore activé, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await page
        .getByLabel(fr["clients.acces.email_libelle"])
        .fill(EMAIL_CLIENT_EN_ATTENTE);
      await page
        .getByRole("button", { name: fr["clients.acces.inviter"] })
        .click();
      await expect(
        page.getByText(
          (fr as Record<string, string>)[
            "clients.acces.refus.compte_connu_autre_societe"
          ],
        ),
      ).toBeVisible();
      await capturer(
        page,
        "apres-refus-connu-autre-societe-en-attente",
        largeur,
      );
    });

    // ── (c) REFUS — compte employé (interne) de B ────────────────────────
    test(`capture — refus : compte employé d'une autre société, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await page
        .getByLabel(fr["clients.acces.email_libelle"])
        .fill(EMAIL_EMPLOYE);
      await page
        .getByRole("button", { name: fr["clients.acces.inviter"] })
        .click();
      await expect(
        page.getByText(
          (fr as Record<string, string>)[
            "clients.acces.refus.compte_connu_autre_societe"
          ],
        ),
      ).toBeVisible();
      await capturer(page, "apres-refus-connu-autre-societe-employe", largeur);
    });

    // ── (a) ACCEPTÉ — compte client de B, déjà actif ─────────────────────
    test(`capture — invitation acceptée : compte client déjà actif d'une autre société, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await page
        .getByLabel(fr["clients.acces.email_libelle"])
        .fill(EMAIL_CLIENT_ACTIF);
      await page
        .getByRole("button", { name: fr["clients.acces.inviter"] })
        .click();
      await expect(
        page.getByText(fr["clients.acces.deja_actif"]),
      ).toBeVisible();
      await capturer(page, "apres-accepte-client-actif-autre-societe", largeur);
    });
  });
}
