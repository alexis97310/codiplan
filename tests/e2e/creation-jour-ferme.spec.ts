import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { SAMEDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE REFUS À LA CRÉATION D'UNE INTERVENTION UN JOUR D'AGENCE FERMÉE
 * (chantier CRÉA-1, 20/09/2026).
 *
 * ## Le défaut que ce fichier mesure
 *
 * `deplacerIntervention` refuse déjà un jour d'agence fermée
 * (`verdictALaPose` → `verdictOuverture`) ; `creerIntervention` ne le
 * faisait PAS — une intervention pouvait NAÎTRE un samedi fermé par le
 * formulaire de création, sans qu'aucun contrôle ne s'y oppose, et **sans
 * qu'aucun écran ne le dise** : `/planning` ne lisait jamais le paramètre
 * `motif` que `versLePlanning` pose pourtant déjà après un refus.
 *
 * ## Pourquoi Koné, pourquoi le samedi
 *
 * **Koné ferme le samedi, Ducos l'ouvre** (`tests/e2e/setup/scene.ts`) :
 * c'est le jour fermé le plus simple à cibler sans dépendre d'un jour férié
 * calculé. La scène de planning n'a besoin d'être écrite pour rien de plus
 * que son site et son agence, déjà posés par le semis lui-même — ce fichier
 * ne réutilise donc pas `ecrireLaScene`, et lit directement l'agence et le
 * site de Koné, comme `tests/e2e/setup/scene.ts` le fait pour lui-même.
 */

async function siteDeKone(): Promise<{
  readonly siteId: string;
  readonly clientId: string;
  readonly societeId: string;
}> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societe.id, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    return { siteId: site.id, clientId: site.client_id, societeId: societe.id };
  } finally {
    await client.$disconnect();
  }
}

async function compterInterventions(
  societeId: string,
  siteId: string,
  jour: Date,
): Promise<number> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    return await client.intervention.count({
      where: { societe_id: societeId, site_id: siteId, date_planifiee: jour },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("créer une intervention un SAMEDI à KONÉ (fermé) est refusé, et /planning le dit", async ({
  page,
}) => {
  const { siteId, clientId, societeId } = await siteDeKone();
  const reperes = await reperesDeLaScene();
  const samedi = jourDeLaScene(reperes, SAMEDI);
  const samediUtc = new Date(
    Date.UTC(samedi.annee, samedi.mois - 1, samedi.jour),
  );

  const avant = await compterInterventions(societeId, siteId, samediUtc);

  await page.goto("/interventions/nouvelle");
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  await page.locator('input[name="date_planifiee"]').fill(cleDeJour(samedi));
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  // LE REFUS ARRIVE SUR /planning, AVEC SA CLÉ (versLePlanning) — jamais un
  // succès déguisé en silence.
  await expect(page).toHaveURL(
    /\/planning\?motif=intervention\.refus\.jour_ferme/,
  );
  const bandeau = page.locator("[data-refus-creation]");
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toHaveAttribute(
    "data-refus-creation",
    "intervention.refus.jour_ferme",
  );
  await expect(bandeau).toHaveText(fr["intervention.refus.jour_ferme"]);
  // `role="alert"` — un refus INTERROMPT, il ne se contente pas d'informer
  // (à la différence de l'avertissement orange, `role="status"`). Vérifié SUR
  // LE BANDEAU LUI-MÊME plutôt que par `getByRole("alert")` sur toute la
  // page : Next.js pose son propre annonceur de route avec `role="alert"`
  // (`#__next-route-announcer__`), et viser le rôle seul viserait deux
  // éléments (mesuré : violation du mode strict).
  await expect(bandeau).toHaveAttribute("role", "alert");

  // AUCUNE INTERVENTION N'A ÉTÉ CRÉÉE — le refus est réel, pas seulement
  // affiché.
  const apres = await compterInterventions(societeId, siteId, samediUtc);
  expect(apres).toBe(avant);
});
