import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9K14-PORTAIL-COPIER-NOUVEAU-LIEN (backlog B7) — « COPIER UN
 * NOUVEAU LIEN » SUR LA CARTE « ACCÈS PORTAIL » DE LA FICHE CLIENT.
 *
 * **APRÈS seulement** (mémoire « captures-avant-apres-e2e »), même raison que
 * `captures-9k01-portail-invitation-revocation.spec.ts` : ce bouton n'existait
 * PAS avant ce ticket — rien à capturer « avant ».
 *
 * Scène propre à ce fichier (préfixe `9k14lien-`) : un compte du portail déjà
 * rattaché (ACTIF) à un client de la société de l'épreuve, posé directement en
 * base plutôt que par l'écran d'invitation — ce chemin est déjà prouvé par
 * `tests/e2e/captures-9k01-portail-invitation-revocation.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9K14 ?? "";
const EMAIL_COMPTE = "9k14lien-compte@codima.test";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

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

let clientId = "";
let utilisateurId = "";

test.beforeAll(async () => {
  const { societeId } = await reperesDeLaScene();
  const base = admin();
  try {
    const client = await base.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    clientId = client.id;

    // IDEMPOTENT — même recette que 9K01/9J21 : un relancement retrouve la
    // même identité plutôt que de buter sur l'unicité du courriel.
    await base.utilisateurClient.deleteMany({
      where: { utilisateur: { email: EMAIL_COMPTE } },
    });
    await base.compte.deleteMany({
      where: { utilisateur: { email: EMAIL_COMPTE } },
    });
    await base.utilisateur.deleteMany({ where: { email: EMAIL_COMPTE } });

    utilisateurId = uuidv7();
    await base.utilisateur.create({
      data: {
        id: utilisateurId,
        nom: "Compte portail 9K14",
        email: EMAIL_COMPTE,
      },
    });
    await base.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
    await base.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        client_id: clientId,
        societe_id: societeId,
        actif: true,
      },
    });
  } finally {
    await base.$disconnect();
  }
});

test.afterAll(async () => {
  if (utilisateurId === "") return;
  const base = admin();
  try {
    await base.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE detail LIKE '%cible:' || $1`,
      utilisateurId,
    );
    await base.utilisateurClient.deleteMany({
      where: { utilisateur_id: utilisateurId },
    });
    await base.compte.deleteMany({ where: { utilisateur_id: utilisateurId } });
    await base.utilisateur.deleteMany({ where: { id: utilisateurId } });
  } finally {
    await base.$disconnect();
  }
});

/** La ligne de CE compte, dans la carte « Accès portail ». */
function ligneDuCompte(page: Page) {
  return page.locator("li").filter({ hasText: EMAIL_COMPTE });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`l'administrateur copie un nouveau lien d'accès du compte portail, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);

      await page.goto(`/clients/${clientId}?onglet=identite`);
      const ligne = ligneDuCompte(page);
      await expect(ligne).toBeVisible();
      const bouton = ligne.getByRole("button", {
        name: fr["clients.acces.copier_nouveau_lien"],
        exact: true,
      });
      await expect(bouton).toBeVisible();
      await capturer(page, "apres-bouton-copier-nouveau-lien", largeur);

      await bouton.click();
      await expect(
        ligne.getByText(fr["equipe.acces.lien_copie"]),
      ).toBeVisible();
      await capturer(page, "apres-lien-copie", largeur);

      const urlCopiee = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(urlCopiee).toMatch(/^https?:\/\//);

      // AUCUNE PAGE NE MONTRE JAMAIS LE LIEN COPIÉ EN CLAIR (D50, même
      // discipline que `tests/e2e/9i6b-lien-acces-a-copier.spec.ts`).
      await page.reload();
      await expect(page.locator("body")).not.toContainText(urlCopiee);
    });

    test(`un ADV ne voit ni la carte « Accès portail » ni le bouton, à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirUneSession(page);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await expect(page.getByText(fr["clients.acces.titre"])).toHaveCount(0);
    });
  });
}
