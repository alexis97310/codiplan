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
 * LES CAPTURES DE 9J20-PORTAIL-GRILLE-TARIFAIRE (CLI-7) — même recette que
 * `captures-9j06-portail-fiche-machine.spec.ts` (mémoire « captures-avant-
 * apres-e2e »).
 *
 * **AVANT = `/portail`**, avec la nouvelle carte « Nos tarifs » — le seul
 * point d'entrée vers l'écran neuf. **APRÈS = `/portail/tarifs`**, le
 * barème lui-même. Aucune fixture de taux ou de forfait n'est posée : le
 * catalogue naît vide par décision d'exploitation (`prisma/seed-data.ts`),
 * et la capture montre donc l'état réel d'une société qui n'a encore rien
 * réglé — « Aucun taux horaire n'est encore réglé », « Aucun forfait n'est
 * actif pour l'instant » —, pas une donnée inventée.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J20 ?? "";
const EMAIL_PORTAIL = "9j20-portail-tarifs@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9j20-portail-tarifs";

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

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow(
      { where: { utilisateur_id: utilisateur.id }, select: { societe_id: true } },
    );
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

test.beforeAll(async () => {
  await preparerLaScene();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture AVANT — /portail, avec la carte « Nos tarifs », à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await expect(page.getByText(fr["portail.tarifs"])).toBeVisible();
      await capturer(page, "avant-portail", largeur);
    });

    test(`capture APRÈS — /portail/tarifs, le barème, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionPortail(page);
      await page.getByText(fr["portail.tarifs"]).click();
      await expect(page).toHaveURL(/\/portail\/tarifs/);
      await expect(
        page.getByRole("heading", { level: 1, name: fr["portail.tarifs.titre"] }),
      ).toBeVisible();
      await capturer(page, "apres-tarifs", largeur);
    });
  });
}
