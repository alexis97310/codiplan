import { expect, test } from "@playwright/test";

import { SOCIETES } from "@/prisma/seed-data";

import { ouvrirUneSession } from "./setup/session";

/**
 * LE SITE D'UN CLIENT INACTIF N'EST PAS PROPOSÉ À LA CRÉATION D'INTERVENTION
 * (RG-PLA-08, D129 ; lot SEMIS-2, 21/09/2026).
 *
 * ## LE DÉFAUT MESURÉ
 *
 * Sur `/interventions/nouvelle` en production, « Ancien client — Ancien
 * chantier (démonstration, inactif) » figurait dans la liste des lieux, alors
 * que RG-PLA-08 masque déjà ce client du planning et du registre par défaut.
 * Une intervention pouvait donc s'y créer sans jamais pouvoir apparaître nulle
 * part ensuite — ni sur `/planning`, ni sur `/interventions` sans cocher
 * « Inclure les clients inactifs ».
 *
 * ## CE QUE LES AUTRES GARDIENS NE PROUVENT PAS
 *
 * `tests/isolation/client-inactif-masque.test.ts` prouve que `listerPlanning`
 * et `listerInterventions` (`lib/interventions/depot.ts`) écartent le client
 * inactif. Il ne prouve rien de `/interventions/nouvelle` : cet écran cherche
 * son site par `/api/recherche/sites?clientActif=1` (SELECTEURS-1,
 * 24/09/2026), qui pose `client_actif: true` sur `rechercherSites` — c'est
 * exactement là que le filtre vivait, avant SELECTEURS-1, comme une SECONDE
 * lecture du même critère (`client.actif`) posée en dur sur cet écran, qui
 * avait divergé de la première en silence (§9, 01/09). Ce fichier éprouve
 * donc L'ÉCRAN de création, pas le dépôt du planning.
 *
 * ## LE TÉMOIN
 *
 * Le site inactif du semis (« Ancien chantier ») est identifié DEPUIS
 * `prisma/seed-data.ts` — jamais un identifiant recopié à la main, qui se
 * périmerait en silence au premier ticket qui renumérote le jeu de
 * démonstration.
 */
test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le site d'un client inactif n'apparaît pas dans la liste des lieux de la création", async ({
  page,
}) => {
  const codimaNC = SOCIETES.find((societe) => societe.code === "CODIMA-NC");
  if (codimaNC === undefined) {
    throw new Error("CODIMA-NC a disparu du jeu de démonstration.");
  }
  const clientInactif = codimaNC.clients.find((client) => !client.actif);
  if (clientInactif === undefined) {
    throw new Error(
      "aucun client inactif dans le jeu de démonstration de CODIMA-NC : ce " +
        "scénario n'a plus de témoin à chercher.",
    );
  }
  const siteInactif = clientInactif.sites[0];
  if (siteInactif === undefined) {
    throw new Error(
      `le client inactif ${clientInactif.id} n'a aucun site : ce scénario ` +
        "n'a plus de témoin à chercher.",
    );
  }

  await page.goto("/interventions/nouvelle");

  // ON CHERCHE PAR LE NOM DU CLIENT INACTIF — exactement ce que la mesure en
  // production montrait (« Ancien client — Ancien chantier »).
  const champ = page.locator('[data-selecteur="site"] input[type="text"]');
  await champ.click();
  await champ.fill(clientInactif.raison_sociale);
  await page.waitForLoadState("networkidle");

  await expect(
    page
      .locator('[data-selecteur="site"] li[role="option"]')
      .filter({ hasText: siteInactif.libelle }),
  ).toHaveCount(0);

  // TÉMOIN : la recherche n'est pas structurellement vide — le filtre écarte
  // le client inactif, il ne vide pas la liste entière (§9, 30/08 : un
  // gardien qui rendrait vert sur rien ne prouve rien).
  await champ.fill("");
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator('[data-selecteur="site"] li[role="option"]'),
  ).not.toHaveCount(0);
});
