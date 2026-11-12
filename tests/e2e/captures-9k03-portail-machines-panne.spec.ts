import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
 * LES CAPTURES DE 9K03-PORTAIL-MACHINES-PANNE — même recette que
 * `captures-9k02-portail-menu-accueil.spec.ts` (mémoire « captures-avant-
 * apres-e2e ») : jouée deux fois par `git worktree`, sur le commit précédant
 * ce lot puis sur le code livré, `CAPTURES_9K03_PREFIXE` distinguant les deux
 * passes dans le même dossier de sortie.
 *
 * **AUCUNE FIXTURE DE PARC N'EST CRÉÉE** — le semis de démonstration porte
 * déjà plusieurs machines pour le premier client de la société de l'épreuve.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K03 ?? "";
const PREFIXE = process.env.CAPTURES_9K03_PREFIXE ?? "apres";
const EMAIL_PORTAIL = "9k03-captures-machines-panne@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9k03-captures-machines-panne";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${PREFIXE}-${nom}-${largeur}.png`),
    fullPage: true,
  });
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
      if (!invitation.enAttente) {
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

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de chemin. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
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

test.beforeAll(async () => {
  await preparerLaScene();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — accueil (machines nommées), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await capturer(page, "accueil", largeur);
    });

    test(`capture — fiche machine, à ${largeur}px`, async ({ page }) => {
      await ouvrirLaSessionPortail(page);
      await page
        .getByText(fr["portail.machine.serie"], { exact: false })
        .first()
        .click();
      await expect(page).toHaveURL(/\/portail\/machines\/[0-9a-f-]+/);
      await capturer(page, "fiche-machine", largeur);
    });

    test(`capture — formulaire de dépôt, à ${largeur}px`, async ({ page }) => {
      await ouvrirLaSessionPortail(page);
      await page.goto("/portail/demandes");
      await page
        .locator("summary", {
          hasText: fr["portail.demandes.action.deposer"],
        })
        .click();
      await capturer(page, "formulaire", largeur);
    });
  });
}
