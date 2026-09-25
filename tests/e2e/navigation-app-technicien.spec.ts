import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * « APP TECHNICIEN » NE MENT PLUS (chantier NAV-1, 20/09/2026).
 *
 * ## Le défaut que ce fichier mesure
 *
 * `lib/navigation/entrees.ts` portait `{ cle: "nav.app_technicien", chemin:
 * null, ouvertePar: "lot 3" }` — une entrée INERTE qui promettait un module
 * « à venir ». **Le module existe** (`app/(mobile)/terrain`, couvert par
 * `tests/e2e/terrain.spec.ts`), et rien n'y menait depuis la barre.
 *
 * ## Ce que ce fichier éprouve, et ce qu'il NE réimplémente PAS
 *
 * 1. Le lien mène désormais à `/terrain` — plus de 404 ni de promesse vide.
 * 2. `/terrain` refuse déjà, PAR LUI-MÊME, un rôle à accès complet (il le
 *    renvoie à `/planning`) — ce test le CONFIRME sans réécrire cette garde,
 *    qui appartient à `perimetreDuPlanning` (`lib/interventions/
 *    perimetre-technicien.ts`) et que `tests/e2e/terrain.spec.ts` éprouve
 *    déjà pour son propre compte.
 * 3. Pour le rôle À QUI le module est destiné — le technicien —, le même
 *    lien, depuis la MÊME barre, mène réellement à sa journée.
 *
 * ## AMENDÉ PAR D132 (23/09/2026, VISUEL-1)
 *
 * **La barre N'EST TOUJOURS PAS un contrôle d'accès** — `/terrain` refuse
 * seule, et aucune logique de droit n'est construite ICI. Mais D132 amende la
 * doctrine « jamais masquée » : la barre du back-office filtre désormais ses
 * entrées par CAPACITÉ (`lib/navigation/entrees.ts`, `entreesAffichables`),
 * et « App technicien » exige `saisir_rapport`. **`adv` — le compte de
 * `ouvrirUneSession`, utilisé ici depuis le premier jour de ce fichier — n'a
 * PAS cette capacité** (`lib/auth/habilitations.ts`, `MATRICE`) : mesuré en
 * rejouant ce fichier après D132, le lien avait disparu pour ce compte, et
 * les deux premiers scénarios rougissaient pour la MEILLEURE raison —
 * `admin_societe`, qui a `saisir_rapport` ET l'accès complet que ces deux
 * scénarios veulent éprouver, le remplace ci-dessous. Le quatrième scénario,
 * neuf, mesure explicitement ce que `adv` a perdu.
 */

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  // Retouché par 99A-ARRIVEE : ce compte n'a qu'UNE société, donc `/arrivee`
  // redirige d'emblée au terrain plutôt que de s'y arrêter.
  await expect(page).toHaveURL(/\/terrain$/);
}

test("le lien « App technicien » existe, et pointe sur /terrain", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/planning");
  const lien = page.getByRole("link", { name: fr["nav.app_technicien"] });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "/terrain");
});

test("un rôle à ACCÈS COMPLET qui clique le lien est renvoyé au planning — confirmé, pas réimplémenté", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/planning");
  await page.getByRole("link", { name: fr["nav.app_technicien"] }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/planning$/);
});

test("un rôle SANS `saisir_rapport` (adv) ne voit plus l'entrée du tout — D132", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/planning");
  await expect(
    page.getByRole("link", { name: fr["nav.app_technicien"] }),
  ).toBeHidden();
  await expect(page.getByText(fr["nav.app_technicien"])).toBeHidden();
});

test("le TECHNICIEN, depuis la MÊME barre, arrive réellement sur sa journée", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  // La barre du back-office n'est pas un contrôle d'accès (voir l'entête) :
  // un compte technicien peut ouvrir un écran du back-office et y voir la
  // même barre que n'importe qui d'autre.
  await page.goto("/planning");
  await page.getByRole("link", { name: fr["nav.app_technicien"] }).click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/terrain$/);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
});
