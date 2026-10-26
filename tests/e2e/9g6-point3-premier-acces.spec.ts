import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

/**
 * 9G6-FORMULAIRES, point 3 — PREMIER ACCÈS.
 *
 * Trois défauts mesurés sur `/premier-acces` :
 *   1. `autoComplete="current-password"` sur un mot de passe NEUF —
 *      `components/session/formulaire.tsx` (avant ce lot).
 *   2. Les coches « 8 caractères ou plus » / « identique à la confirmation »
 *      restaient TOUJOURS vertes, y compris avant toute saisie.
 *   3. Un refus de saisie s'affichait en gris neutre (`role="status"`),
 *      jamais dans le ton d'une erreur.
 *
 * `?token=` n'a besoin d'être qu'une chaîne non vide : la page ne lit rien
 * en base au GET (voir l'en-tête de `premier-acces/page.tsx`), elle ne
 * décide qu'entre « lien absent » et « formulaire » sur sa seule présence.
 */
test("les deux champs portent new-password, jamais current-password", async ({
  page,
}) => {
  await page.goto("/premier-acces?token=jeton-de-test");
  await expect(
    page.getByLabel(fr["premier_acces.mot_de_passe"]),
  ).toHaveAttribute("autocomplete", "new-password");
  await expect(
    page.getByLabel(fr["premier_acces.confirmation"]),
  ).toHaveAttribute("autocomplete", "new-password");
});

test("les deux règles sont invisibles avant toute saisie, puis apparaissent quand elles sont satisfaites", async ({
  page,
}) => {
  await page.goto("/premier-acces?token=jeton-de-test");
  const regleLongueur = page
    .locator("li")
    .filter({ hasText: fr["premier_acces.regle_longueur"] });
  const regleConfirmation = page
    .locator("li")
    .filter({ hasText: fr["premier_acces.regle_confirmation"] });

  // AVANT TOUTE SAISIE — aucune coche.
  await expect(regleLongueur.locator("svg")).toHaveCount(0);
  await expect(regleConfirmation.locator("svg")).toHaveCount(0);

  // UN MOT DE PASSE TROP COURT — la règle de longueur reste sans coche.
  await page.getByLabel(fr["premier_acces.mot_de_passe"]).fill("court1");
  await expect(regleLongueur.locator("svg")).toHaveCount(0);

  // HUIT CARACTÈRES OU PLUS — la coche apparaît, la confirmation reste nue.
  await page
    .getByLabel(fr["premier_acces.mot_de_passe"])
    .fill("unLongMotDePasse1");
  await expect(regleLongueur.locator("svg")).toHaveCount(1);
  await expect(regleConfirmation.locator("svg")).toHaveCount(0);

  // UNE CONFIRMATION DIFFÉRENTE — toujours sans coche.
  await page.getByLabel(fr["premier_acces.confirmation"]).fill("autre chose");
  await expect(regleConfirmation.locator("svg")).toHaveCount(0);

  // LA MÊME SAISIE DANS LES DEUX CHAMPS — la coche apparaît.
  await page
    .getByLabel(fr["premier_acces.confirmation"])
    .fill("unLongMotDePasse1");
  await expect(regleConfirmation.locator("svg")).toHaveCount(1);
});

test("un refus de saisie s'affiche dans le ton d'une erreur, jamais en gris neutre", async ({
  page,
}) => {
  await page.goto(
    "/premier-acces?token=jeton-de-test&motif=premier_acces.trop_court",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: fr["premier_acces.trop_court"] }),
  ).toBeVisible();
});
