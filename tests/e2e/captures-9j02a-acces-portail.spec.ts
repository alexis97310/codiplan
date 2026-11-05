import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9J02A-REPRISE-9J02 — AVANT/APRÈS (mémoire
 * « captures-avant-apres-e2e ») : un seul fichier, lancé une fois sur le
 * commit qui précède ce ticket (la carte « Accès portail » n'existe pas
 * encore — rouge attendu aux assertions, la capture a déjà eu lieu), une fois
 * sur le code livré.
 *
 * **Les clés du dictionnaire se lisent PAR NOM**
 * (`(fr as Record<string,string>)[cle]`), jamais `fr["clients.acces.titre"]` :
 * sur le commit AVANT, cette clé n'existe pas encore et `next build` (que
 * Playwright lance avant `next start`) type-vérifierait ce spec contre
 * l'ANCIEN `lib/i18n/fr.ts` — le piège nommé par la mémoire.
 *
 * **DEUX LIGNES POSÉES DIRECTEMENT**, même patron que
 * `poserLaNotificationDeLEpreuve` (`captures-9j10-notifications.spec.ts`) :
 * un compte déjà actif et un compte déjà révoqué, sur le premier client de la
 * société d'ADMIN_SOCIETE_EPREUVE — pour montrer les deux états de la liste
 * sans dépendre du clic « Inviter » (asynchrone, jeton, presse-papiers).
 *
 * **`administrer_utilisateurs` seulement** (D230) : ADV (COMPTE_EPREUVE) voit
 * l'onglet Identité (il a `gerer_client_site`, D130) mais jamais la carte
 * « Accès portail » — c'est la capture « bouton absent » du ticket.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J02A ?? "";
const EMAIL_ACTIF = "9j02a-acces-actif@codima.test";
const EMAIL_REVOQUE = "9j02a-acces-revoque@codima.test";

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

async function clientDeLEpreuve(): Promise<string> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await client.utilisateurSociete.findFirstOrThrow(
      {
        where: { utilisateur_id: utilisateur.id },
        select: { societe_id: true },
      },
    );
    const cible = await client.client.findFirstOrThrow({
      where: { societe_id: utilisateurSociete.societe_id },
      select: { id: true },
    });

    // IDEMPOTENT — un relancement cible (`-g`, après une première série
    // interrompue par un rouge « rouge attendu ») retrouve la même identité
    // plutôt que de buter sur l'unicité du courriel.
    await client.utilisateurClient.deleteMany({
      where: { utilisateur: { email: { in: [EMAIL_ACTIF, EMAIL_REVOQUE] } } },
    });
    await client.utilisateur.deleteMany({
      where: { email: { in: [EMAIL_ACTIF, EMAIL_REVOQUE] } },
    });

    const identiteId = uuidv7();
    await client.utilisateur.create({
      data: {
        id: identiteId,
        nom: "Contact actif 9J02A",
        email: EMAIL_ACTIF,
      },
    });
    await client.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: identiteId,
        client_id: cible.id,
        societe_id: utilisateurSociete.societe_id,
        actif: true,
      },
    });

    const identiteRevoqueeId = uuidv7();
    await client.utilisateur.create({
      data: {
        id: identiteRevoqueeId,
        nom: "Contact révoqué 9J02A",
        email: EMAIL_REVOQUE,
      },
    });
    await client.utilisateurClient.create({
      data: {
        id: uuidv7(),
        utilisateur_id: identiteRevoqueeId,
        client_id: cible.id,
        societe_id: utilisateurSociete.societe_id,
        actif: false,
      },
    });

    return cible.id;
  } finally {
    await client.$disconnect();
  }
}

let clientId = "";

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  clientId = await clientDeLEpreuve();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — fiche client, onglet Identité, la carte « Accès portail » (admin_societe), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await capturer(page, "admin-acces-portail", largeur);
      await expect(
        page.getByRole("heading", {
          name: (fr as Record<string, string>)["clients.acces.titre"],
        }),
      ).toBeVisible();
      await expect(
        page
          .getByText((fr as Record<string, string>)["clients.acces.etat.actif"])
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            (fr as Record<string, string>)["clients.acces.etat.revoque"],
          )
          .first(),
      ).toBeVisible();
    });

    test(`capture — fiche client, onglet Identité, bouton d'invitation ABSENT (adv), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirUneSession(page);
      await page.goto(`/clients/${clientId}?onglet=identite`);
      await capturer(page, "adv-sans-acces-portail", largeur);
      await expect(
        page.getByRole("heading", {
          name: (fr as Record<string, string>)["clients.acces.titre"],
        }),
      ).toHaveCount(0);
    });
  });
}
