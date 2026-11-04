import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9J10-NOTIFICATIONS-ECRAN — AVANT/APRÈS (mémoire
 * « captures-avant-apres-e2e ») : un seul fichier, lancé une fois sur le
 * commit qui précède ce ticket (route et entrée de menu absentes — rouge
 * attendu aux assertions, la capture a déjà eu lieu), une fois sur le code
 * livré.
 *
 * **Les clés du dictionnaire se lisent PAR NOM** (`(fr as
 * Record<string,string>)[...]`), jamais `fr["notifications.titre"]` : sur le
 * commit AVANT, cette clé n'existe pas encore et `next build` — que
 * Playwright lance avant `next start` — type-vérifie ce spec contre
 * l'ANCIEN `lib/i18n/fr.ts` (le piège nommé par la mémoire).
 *
 * **UNE NOTIFICATION RÉELLE, posée par la connexion ADMINISTRATEUR** (jamais
 * `avecContexteApplicatif`, qui exigerait une session applicative que ce
 * harnais n'a pas besoin d'ouvrir pour écrire une ligne de scène) — même
 * patron que `ecrireLesComptesRmEtRs` (`tests/e2e/setup/scene.ts`).
 * `preparer_facturation` est la capacité choisie : `adv` (COMPTE_EPREUVE)
 * l'a au ●, `admin_societe` (COMPTE_ADMIN_SOCIETE_EPREUVE) ne l'a jamais
 * (D37 — « il ne lit pas les données financières »), ce qui donne les deux
 * états demandés par le ticket SANS devoir viser un destinataire précis.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J10 ?? "";

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

async function poserLaNotificationDeLEpreuve(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await client.utilisateurSociete.findFirstOrThrow(
      {
        where: { utilisateur_id: utilisateur.id },
        select: { societe_id: true },
      },
    );
    const intervention = await client.intervention.findFirstOrThrow({
      where: { societe_id: utilisateurSociete.societe_id },
      select: { id: true },
    });
    await client.notification.create({
      data: {
        id: uuidv7(),
        societe_id: utilisateurSociete.societe_id,
        intervention_id: intervention.id,
        evenement: "signature_absente_ou_refusee",
        capacite_requise: "preparer_facturation",
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(async () => {
  if (DOSSIER === "") return;
  await poserLaNotificationDeLEpreuve();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — /notifications, avec une notification visible (adv), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirUneSession(page);
      await page.goto("/notifications");
      await capturer(page, "avec-notifications", largeur);
      await expect(
        page.getByRole("heading", {
          name: (fr as Record<string, string>)["notifications.titre"],
        }),
      ).toBeVisible();
    });

    test(`capture — /notifications, vide (admin_societe, sans la capacité posée), à ${largeur}px`, async ({
      page,
    }) => {
      await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
      await page.goto("/notifications");
      await capturer(page, "vide", largeur);
      await expect(
        page.getByText(
          (fr as Record<string, string>)["notifications.vide_texte"],
        ),
      ).toBeVisible();
    });
  });
}
