import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";

/**
 * LE MENU À CINQ ENTRÉES ET LES DEUX TUILES DE L'ACCUEIL
 * (9K02-PORTAIL-MENU-ACCUEIL) — chaque entrée et chaque tuile mène au bon
 * écran, à 1280 px (colonne toujours visible) et à 375 px (derrière le
 * burger, COQUE-375).
 *
 * Même recette d'ouverture de session que `captures-9j20-portail-tarifs
 * .spec.ts` : invitation + premier accès, jamais un cookie fabriqué.
 */
test.describe.configure({ mode: "serial" });

const EMAIL_PORTAIL = "9k02-menu-nav@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k02-menu-nav";

function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        client.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.dejaActif) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
  await page.goto("/portail");
  await expect(page).toHaveURL(/\/portail/);
}

/** Ouvre le burger si et seulement si la colonne n'est pas déjà visible
 * (sous 901 px, COQUE-375) — à 1280 px, la colonne est déjà là. */
async function ouvrirLeMenuSiReplie(
  page: Page,
  largeur: number,
): Promise<void> {
  if (largeur >= 901) return;
  await page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }).click();
  await expect(page.locator("#colonne-navigation")).toBeVisible();
}

test.beforeAll(async () => {
  await preparerLaScene();
});

const ENTREES_ATTENDUES = [
  { libelle: fr["nav.portail_parc"], url: /\/portail$/ },
  {
    libelle: fr["nav.portail_interventions"],
    url: /\/portail\/interventions$/,
  },
  { libelle: fr["nav.portail_demandes"], url: /\/portail\/demandes$/ },
  { libelle: fr["nav.portail_contacts"], url: /\/portail\/contacts$/ },
  { libelle: fr["nav.portail_tarifs"], url: /\/portail\/tarifs$/ },
] as const;

for (const largeur of [1280, 375] as const) {
  test.describe(`le menu du portail, à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    for (const { libelle, url } of ENTREES_ATTENDUES) {
      test(`« ${libelle} » mène au bon écran`, async ({ page }) => {
        await ouvrirLaSessionPortail(page);
        await ouvrirLeMenuSiReplie(page, largeur);
        await page
          .locator("#colonne-navigation")
          .getByRole("link", { name: libelle })
          .click();
        await expect(page).toHaveURL(url);
      });
    }
  });

  test.describe(`les tuiles de l'accueil, à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test("« Signaler une panne » mène au dépôt de demande", async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByRole("link", { name: fr["portail.accueil.signaler_panne"] })
        .click();
      await expect(page).toHaveURL(/\/portail\/demandes$/);
    });

    test("la tuile « Interventions en cours » mène à la liste des interventions", async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByRole("link", {
          name: new RegExp(fr["portail.accueil.interventions_en_cours"]),
        })
        .click();
      await expect(page).toHaveURL(/\/portail\/interventions$/);
    });

    test("la tuile « Demandes en attente » mène à la liste des demandes", async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByRole("link", {
          name: new RegExp(fr["portail.accueil.demandes_en_attente"]),
        })
        .click();
      await expect(page).toHaveURL(/\/portail\/demandes$/);
    });
  });
}
