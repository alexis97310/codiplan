import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_EPREUVE,
  COMPTE_MULTI_SOCIETE_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9J10A-NOTIFICATION-LUE-PAR-PERSONNE — « lu par personne »
 * (décision d'Alexis du 05/11/2026), pour DEUX comptes.
 *
 * `COMPTE_EPREUVE` (adv) et `COMPTE_MULTI_SOCIETE_EPREUVE` (adv aussi, sur la
 * MÊME société NC — `ecrireLeCompteMultiSocieteDeLEpreuve`) tiennent la même
 * capacité : une notification COLLECTIVE (`destinataire_id` NULL,
 * `annuler_intervention`) leur est visible à TOUS LES DEUX. C'est le seul
 * couple de comptes de la scène qui le permette sans ajouter de fixture.
 *
 * **Les clés du dictionnaire se lisent PAR NOM** — même garde que
 * `captures-9j10-notifications.spec.ts` (mémoire « captures-avant-apres-e2e »).
 *
 * `COMPTE_MULTI_SOCIETE_EPREUVE` passe par `/arrivee` (deux sociétés, aucune
 * redirection automatique, `arrivee.spec.ts`) : le premier bouton « activer »
 * est CODIMA-NC, la société où la notification de l'épreuve est posée —
 * `ecrireLeCompteMultiSocieteDeLEpreuve` l'habilite sur NC avant EU.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9J10A ?? "";

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

/**
 * Retourne l'identifiant posé — `annuler_intervention` est aussi tenue par
 * `admin_societe` (`lib/auth/habilitations.ts`), donc visible de
 * `captures-9j10-notifications.spec.ts` (même société NC, même base
 * partagée) si elle restait en base : la ligne est donc retirée par
 * `nettoyerLaNotificationDeLEpreuve` une fois le test fini, pour qu'aucune
 * trace ne pollue un fichier voisin exécuté dans la même suite.
 */
async function poserLaNotificationCollectiveDeLEpreuve(): Promise<string> {
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
    const id = uuidv7();
    await client.notification.create({
      data: {
        id,
        societe_id: utilisateurSociete.societe_id,
        intervention_id: intervention.id,
        evenement: "signature_absente_ou_refusee",
        capacite_requise: "annuler_intervention",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function nettoyerLaNotificationDeLEpreuve(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.notification.delete({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

/** `COMPTE_MULTI_SOCIETE_EPREUVE` — même patron que `arrivee.spec.ts`. */
async function entrerSurLaSocieteNc(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page
    .getByLabel(fr["connexion.email"])
    .fill(COMPTE_MULTI_SOCIETE_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
  await page
    .getByRole("button", { name: fr["arrivee.choix.activer"] })
    .first()
    .click();
  await page.getByRole("link", { name: fr["arrivee.entrer.planning"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    // UNE NOTIFICATION FRAÎCHE PAR LARGEUR — la précédente est marquée lue
    // par A pendant le test ; `beforeAll` posé ICI (et non une fois pour tout
    // le fichier) en pose une nouvelle à chaque largeur. Retirée par
    // `afterAll` : voir le commentaire de `poserLaNotificationCollectiveDeLEpreuve`.
    let notificationId = "";
    test.beforeAll(async () => {
      notificationId = await poserLaNotificationCollectiveDeLEpreuve();
    });
    test.afterAll(async () => {
      await nettoyerLaNotificationDeLEpreuve(notificationId);
    });

    test(`capture — A lit SA notification, B ne l'a pas encore lue, à ${largeur}px`, async ({
      browser,
    }) => {
      const pageA = await browser.newPage({
        viewport: { width: largeur, height: 1200 },
      });
      const pageB = await browser.newPage({
        viewport: { width: largeur, height: 1200 },
      });
      try {
        await ouvrirUneSession(pageA);
        await entrerSurLaSocieteNc(pageB);

        // LA CLOCHE — l'entrée « Notifications » de la barre, visible pour
        // les DEUX tant que le total n'est pas nul (`decomptesDuMenu`). À
        // 375px, la barre vit dans un TIROIR fermé par défaut (D121,
        // COQUE-375, voir `captures-9cb-menu.spec.ts`) : l'ouvrir d'abord.
        if (largeur < 1024) {
          await pageA
            .getByRole("button", { name: fr["nav.ouvrir_le_menu"] })
            .click();
          await pageB
            .getByRole("button", { name: fr["nav.ouvrir_le_menu"] })
            .click();
        }
        await expect(
          pageA.getByRole("link", { name: fr["nav.notifications"] }),
        ).toBeVisible();
        await expect(
          pageB.getByRole("link", { name: fr["nav.notifications"] }),
        ).toBeVisible();
        await capturer(pageA, "a-cloche-avant", largeur);
        await capturer(pageB, "b-cloche-avant", largeur);

        await pageA.goto("/notifications");
        await pageB.goto("/notifications");

        // LES DEUX LA VOIENT NON LUE AU DÉPART — même ligne, deux comptes.
        await expect(
          pageA.getByText(fr["notifications.non_lue"]).first(),
        ).toBeVisible();
        await expect(
          pageB.getByText(fr["notifications.non_lue"]).first(),
        ).toBeVisible();

        // A LA MARQUE LUE.
        await pageA
          .getByRole("button", { name: fr["notifications.marquer_lue"] })
          .first()
          .click();
        await pageA.waitForLoadState("networkidle");
        await expect(pageA.getByText(fr["notifications.non_lue"])).toHaveCount(
          0,
        );
        await capturer(pageA, "a-a-lu-sa-notification", largeur);

        // B, LUI, NE L'A PAS LUE — « lu par personne » (9J10A), pas « lu par
        // tous » : la même ligne reste NON LUE pour lui après que A l'a lue.
        await pageB.reload();
        await expect(
          pageB.getByText(fr["notifications.non_lue"]).first(),
        ).toBeVisible();
        await capturer(pageB, "b-navait-pas-lu", largeur);
      } finally {
        await pageA.close();
        await pageB.close();
      }
    });
  });
}
